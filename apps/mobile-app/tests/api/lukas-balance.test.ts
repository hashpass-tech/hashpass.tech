/// <reference types="jest" />

const mockResolveIdentity = jest.fn();
const mockIsIdentityError = jest.fn();
const mockFrom = jest.fn();

let queryResult: { data: { balance: string | number } | null; error: unknown };
let filters: [string, unknown][];

jest.mock('@/lib/server/resolve-notification-identity', () => ({
  resolveNotificationIdentity: (request: Request) => mockResolveIdentity(request),
  isResolveIdentityError: (identity: unknown) => mockIsIdentityError(identity),
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseServerForRequest: () => ({ from: mockFrom }),
}));

describe('LUKAS balance API', () => {
  beforeEach(() => {
    jest.resetModules();
    mockResolveIdentity.mockReset();
    mockIsIdentityError.mockReset();
    filters = [];
    queryResult = { data: { balance: '12.5' }, error: null };
    const query: any = {
      select: jest.fn(() => query),
      eq: jest.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      }),
      maybeSingle: jest.fn(async () => queryResult),
    };
    mockFrom.mockReset().mockReturnValue(query);
  });

  it('resolves the database UUID on the server and ignores client identity parameters', async () => {
    mockResolveIdentity.mockResolvedValue({
      supabaseUserId: '11111111-1111-4111-8111-111111111111',
      registryUserId: 'registry-user-1',
      email: 'person@example.com',
    });
    mockIsIdentityError.mockReturnValue(false);

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/lukas/balance+api');
    const response = await GET(new Request(
      'https://api.hashpass.tech/api/lukas/balance?tokenSymbol=lukas&userId=attacker-controlled',
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { balance: 12.5, tokenSymbol: 'LUKAS' } });
    expect(filters).toEqual([
      ['user_id', '11111111-1111-4111-8111-111111111111'],
      ['token_symbol', 'LUKAS'],
    ]);
  });

  it('does not query data when authentication fails or has no linked database identity', async () => {
    mockResolveIdentity.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    mockIsIdentityError.mockReturnValue(true);

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/lukas/balance+api');
    const unauthorized = await GET(new Request('https://api.hashpass.tech/api/lukas/balance'));
    expect(unauthorized.status).toBe(401);

    mockResolveIdentity.mockResolvedValue({ supabaseUserId: null, registryUserId: 'registry-1' });
    mockIsIdentityError.mockReturnValue(false);
    const unlinked = await GET(new Request('https://api.hashpass.tech/api/lukas/balance'));
    expect(unlinked.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns zero when the authenticated user has no balance row', async () => {
    mockResolveIdentity.mockResolvedValue({ supabaseUserId: '11111111-1111-4111-8111-111111111111' });
    mockIsIdentityError.mockReturnValue(false);
    queryResult = { data: null, error: null };

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/lukas/balance+api');
    const response = await GET(new Request('https://api.hashpass.tech/api/lukas/balance'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { balance: 0, tokenSymbol: 'LUKAS' } });
  });

  it('validates token symbols before querying the database', async () => {
    mockResolveIdentity.mockResolvedValue({ supabaseUserId: '11111111-1111-4111-8111-111111111111' });
    mockIsIdentityError.mockReturnValue(false);

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/lukas/balance+api');
    const response = await GET(new Request('https://api.hashpass.tech/api/lukas/balance?tokenSymbol=LUKAS%3BDROP'));

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
