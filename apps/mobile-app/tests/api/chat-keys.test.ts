/// <reference types="jest" />

const mockResolveIdentity = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();
const linkedUserId = '7f60f5d2-5948-4df1-9670-2f9177cf2fe4';

jest.mock('@/lib/server/resolve-notification-identity', () => ({
  resolveNotificationIdentity: (...args: unknown[]) => mockResolveIdentity(...args),
  isResolveIdentityError: (value: { status?: unknown }) => typeof value?.status === 'number',
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseServerForRequest: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

const makeQuery = (result: { data?: unknown; error?: unknown } = { data: null, error: null }) => {
  const query: Record<string, any> = {
    select: jest.fn(() => query),
    update: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return query;
};

describe('/api/chat/keys', () => {
  beforeEach(() => {
    jest.resetModules();
    mockResolveIdentity.mockReset().mockResolvedValue({ supabaseUserId: linkedUserId });
    mockFrom.mockReset().mockReturnValue(makeQuery());
    mockRpc.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  });

  it('requires a linked authenticated identity before any key operation', async () => {
    mockResolveIdentity.mockResolvedValue({ supabaseUserId: null });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET, POST } = require('../../app/api/chat/keys+api');

    const getResponse = await GET(new Request('https://api.hashpass.tech/api/chat/keys?kind=backup'));
    const postResponse = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: JSON.stringify({ action: 'publish-public-key', publicKey: 'a'.repeat(64) }),
    }));

    expect(getResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('checks the backup for the resolved user and tolerates a pending backup migration', async () => {
    const query = makeQuery({
      data: null,
      error: { code: 'PGRST204', message: 'Could not find backup_created_at in the schema cache' },
    });
    mockFrom.mockReturnValue(query);
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/chat/keys+api');

    const response = await GET(new Request(
      `https://api.hashpass.tech/api/chat/keys?kind=backup&userId=${'11111111-1111-4111-8111-111111111111'}`,
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { success: false, error: 'no_backup', backup_available: false },
    });
    expect(query.eq).toHaveBeenCalledWith('user_id', linkedUserId);
  });

  it('returns a participant public key only for a valid target UUID', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: { public_key: 'b'.repeat(64) }, error: null }));
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/chat/keys+api');

    const invalid = await GET(new Request('https://api.hashpass.tech/api/chat/keys?kind=public-key&userId=not-a-uuid'));
    expect(invalid.status).toBe(400);

    const response = await GET(new Request(
      'https://api.hashpass.tech/api/chat/keys?kind=public-key&userId=11111111-1111-4111-8111-111111111111',
    ));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { success: true, public_key: 'b'.repeat(64) } });
    expect(mockFrom).toHaveBeenCalledWith('user_chat_keys');
  });

  it('publishes a valid public key using the server-resolved owner ID', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/chat/keys+api');
    const response = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST',
      body: JSON.stringify({ action: 'publish-public-key', userId: '11111111-1111-4111-8111-111111111111', publicKey: 'c'.repeat(64) }),
    }));

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('publish_user_chat_public_key', {
      p_user_id: linkedUserId,
      p_public_key: 'c'.repeat(64),
    });
  });

  it('stores and deletes encrypted backup data for the authenticated user', async () => {
    const query = makeQuery({ data: { user_id: linkedUserId }, error: null });
    mockFrom.mockReturnValue(query);
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST, DELETE } = require('../../app/api/chat/keys+api');

    const stored = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST',
      body: JSON.stringify({
        action: 'store-backup',
        userId: '11111111-1111-4111-8111-111111111111',
        encryptedPrivateKey: `${'a'.repeat(48)}:${'b'.repeat(96)}`,
        salt: 'c'.repeat(32),
      }),
    }));
    expect(stored.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      encrypted_private_key_backup: `${'a'.repeat(48)}:${'b'.repeat(96)}`,
      backup_salt: 'c'.repeat(32),
    }));
    expect(query.eq).toHaveBeenCalledWith('user_id', linkedUserId);

    const deleted = await DELETE(new Request('https://api.hashpass.tech/api/chat/keys', { method: 'DELETE' }));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ data: { success: true } });
  });
});
