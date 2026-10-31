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

  it('passes identity-resolution errors through without querying chat keys', async () => {
    mockResolveIdentity.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/chat/keys+api');

    const response = await GET(new Request('https://api.hashpass.tech/api/chat/keys?kind=backup'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mockFrom).not.toHaveBeenCalled();
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

  it('returns an absent-key result and rejects unknown query kinds', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/chat/keys+api');

    const absentBackup = await GET(new Request('https://api.hashpass.tech/api/chat/keys?kind=backup'));
    expect(await absentBackup.json()).toEqual({
      data: { success: false, error: 'no_backup', backup_available: true },
    });

    const absentPublicKey = await GET(new Request(
      'https://api.hashpass.tech/api/chat/keys?kind=public-key&userId=11111111-1111-4111-8111-111111111111',
    ));
    expect(await absentPublicKey.json()).toEqual({
      data: { success: false, error: 'key_not_found' },
    });

    const invalidKind = await GET(new Request('https://api.hashpass.tech/api/chat/keys?kind=private'));
    expect(invalidKind.status).toBe(400);
  });

  it('returns a stored encrypted backup for the authenticated user', async () => {
    mockFrom.mockReturnValue(makeQuery({
      data: {
        encrypted_private_key_backup: 'ciphertext:nonce',
        backup_salt: 'salt-value',
        backup_created_at: '2026-10-31T00:00:00.000Z',
      },
      error: null,
    }));
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/chat/keys+api');

    const response = await GET(new Request('https://api.hashpass.tech/api/chat/keys?kind=backup'));

    expect(await response.json()).toEqual({
      data: {
        success: true,
        encrypted_private_key: 'ciphertext:nonce',
        salt: 'salt-value',
        created_at: '2026-10-31T00:00:00.000Z',
      },
    });
  });

  it('returns 500 when reading a key fails for a reason other than a pending migration', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: null, error: { code: '57014', message: 'query cancelled' } }));
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/chat/keys+api');

    const response = await GET(new Request('https://api.hashpass.tech/api/chat/keys?kind=backup'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to load chat keys' });
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

  it('validates JSON, public-key, action, and backup payloads before writing', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/chat/keys+api');

    const invalidJson = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: '{',
    }));
    expect(invalidJson.status).toBe(400);

    const invalidPublicKey = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: JSON.stringify({ action: 'publish-public-key', publicKey: 'not-a-key' }),
    }));
    expect(invalidPublicKey.status).toBe(400);

    const invalidAction = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: JSON.stringify({ action: 'rotate' }),
    }));
    expect(invalidAction.status).toBe(400);

    const invalidBackup = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: JSON.stringify({ action: 'store-backup', encryptedPrivateKey: 'bad', salt: 'bad' }),
    }));
    expect(invalidBackup.status).toBe(400);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns publish failures and handles backup conflicts or pending migrations', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: false, error: 'key rejected' }, error: null });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/chat/keys+api');
    const publishResponse = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST',
      body: JSON.stringify({ action: 'publish-public-key', publicKey: 'd'.repeat(64) }),
    }));
    expect(publishResponse.status).toBe(400);
    expect(await publishResponse.json()).toEqual({ data: { success: false, error: 'key rejected' } });

    const body = {
      action: 'store-backup',
      encryptedPrivateKey: `${'a'.repeat(48)}:${'b'.repeat(96)}`,
      salt: 'c'.repeat(32),
    };
    const conflictResponse = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(conflictResponse.status).toBe(409);

    mockFrom.mockReturnValue(makeQuery({
      data: null,
      error: { code: 'PGRST204', message: 'Could not find backup_salt in the schema cache' },
    }));
    const migrationResponse = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(migrationResponse.status).toBe(503);

    mockFrom.mockReturnValue(makeQuery({ data: null, error: { code: '57014', message: 'query cancelled' } }));
    const failedResponse = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(failedResponse.status).toBe(500);
  });

  it('returns a server error when publishing a key RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/chat/keys+api');

    const response = await POST(new Request('https://api.hashpass.tech/api/chat/keys', {
      method: 'POST',
      body: JSON.stringify({ action: 'publish-public-key', publicKey: 'e'.repeat(64) }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to save chat keys' });
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

  it('handles unavailable migrations and database errors while deleting backups', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { DELETE } = require('../../app/api/chat/keys+api');

    mockFrom.mockReturnValue(makeQuery({
      data: null,
      error: { code: '42703', message: 'column encrypted_private_key_backup does not exist' },
    }));
    const migrationResponse = await DELETE(new Request('https://api.hashpass.tech/api/chat/keys', { method: 'DELETE' }));
    expect(migrationResponse.status).toBe(503);

    mockFrom.mockReturnValue(makeQuery({ data: null, error: { code: '57014', message: 'query cancelled' } }));
    const failedResponse = await DELETE(new Request('https://api.hashpass.tech/api/chat/keys', { method: 'DELETE' }));
    expect(failedResponse.status).toBe(500);
    expect(await failedResponse.json()).toEqual({ error: 'Unable to delete chat key backup' });
  });
});
