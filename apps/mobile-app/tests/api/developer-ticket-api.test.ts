/// <reference types="jest" />

const mockRpc = jest.fn();
const mockRateLimitOk = jest.fn((_key: string) => true);

jest.mock("@/lib/supabase-server", () => ({
  getSupabaseServerForRequest: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }),
}));
jest.mock("@/lib/bsl/rateLimit", () => ({ rateLimitOk: (key: string) => mockRateLimitOk(key) }));

const testKey = `hp_test_${"a".repeat(43)}`;
const requestBody = {
  externalReference: "order-123-ticket-1",
  ticketTypeId: "general",
  attendee: { email: "ada@example.com", fullName: "Ada Example" },
  payment: {
    provider: "wompi",
    transactionId: "txn-123",
    reference: "order-123",
    amountInCents: 8900000,
    currency: "COP",
  },
};

function post(body: unknown = requestBody, headers: Record<string, string> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { POST } = require("../../app/api/v1/events/[eventId]/tickets+api");
  return POST(new Request("https://api-dev.hashpass.tech/api/v1/events/colombia2026/tickets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testKey}`,
      "Idempotency-Key": "order-123-ticket-1",
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

describe("POST /api/v1/events/:eventId/tickets", () => {
  beforeEach(() => {
    jest.resetModules();
    mockRpc.mockReset();
    mockRateLimitOk.mockReturnValue(true);
    process.env.WOMPI_PRIVATE_KEY_DEV = "test_private_key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "APPROVED", reference: "order-123", amount_in_cents: 8900000, currency: "COP" } }),
    });
  });

  afterEach(() => { delete process.env.WOMPI_PRIVATE_KEY_DEV; });

  it("rejects missing credentials and idempotency before database access", async () => {
    expect((await post(requestBody, { Authorization: "" })).status).toBe(401);
    expect((await post(requestBody, { "Idempotency-Key": "short" })).status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects a live key on the test endpoint", async () => {
    const response = await post(requestBody, { Authorization: `Bearer hp_live_${"b".repeat(43)}` });
    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads before payment verification", async () => {
    expect((await post({ ...requestBody, attendee: { email: "invalid", fullName: "" } })).status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("requires Wompi to confirm status, reference, amount and currency", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: "APPROVED", reference: "another-order", amount_in_cents: 8900000, currency: "COP" } }),
    });
    const response = await post();
    expect(response.status).toBe(422);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 503 when the payment verifier is not configured", async () => {
    delete process.env.WOMPI_PRIVATE_KEY_DEV;
    expect((await post()).status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("issues a verified ticket through the atomic database RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "tkt_123", idempotentReplay: false }, error: null });
    const response = await post();
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockRpc).toHaveBeenCalledWith("issue_developer_ticket", expect.objectContaining({
      p_environment: "test",
      p_event_id: "colombia2026",
      p_idempotency_key: "order-123-ticket-1",
      p_external_reference: "order-123-ticket-1",
      p_payment: requestBody.payment,
    }));
  });

  it("returns the prior response for an idempotent replay", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "tkt_123", idempotentReplay: true }, error: null });
    expect((await post()).status).toBe(200);
  });

  it.each([
    ["28000", 401], ["42501", 403], ["23505", 409], ["XX000", 500],
  ])("maps database error %s to HTTP %s", async (code, status) => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code } });
    expect((await post()).status).toBe(status);
  });
});
