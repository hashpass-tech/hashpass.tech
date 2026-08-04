import assert from "node:assert/strict";
import test from "node:test";
import { HashpassError, createHashpass } from "../dist/index.js";

test("requires a public app id", () => {
  assert.throws(
    () => createHashpass({ appId: "" }),
    (error) => {
      assert.equal(error.code, "configuration_error");
      return true;
    },
  );
});

test("creates an AI-assisted support ticket with app and auth headers", async () => {
  let captured;
  const fetch = async (url, init) => {
    captured = { url, init };
    return Response.json({
      id: "ticket_1",
      subject: "Help",
      status: "open",
      priority: "normal",
    });
  };
  const sdk = createHashpass({
    appId: "app_test",
    baseUrl: "https://support.example.test/api/",
    fetch,
    auth: { getAccessToken: () => "access-token" },
  });
  await sdk.support.createTicket({
    subject: "Help",
    message: "Something broke",
    idempotencyKey: "once",
  });

  assert.equal(
    captured.url,
    "https://support.example.test/api/v1/support/tickets",
  );
  assert.equal(captured.init.headers.get("x-hashpass-app-id"), "app_test");
  assert.equal(
    captured.init.headers.get("authorization"),
    "Bearer access-token",
  );
  assert.equal(captured.init.headers.get("idempotency-key"), "once");
  assert.deepEqual(JSON.parse(captured.init.body), {
    aiAssistance: true,
    subject: "Help",
    message: "Something broke",
  });
});

test("returns typed API errors with request correlation", async () => {
  const sdk = createHashpass({
    appId: "app_test",
    fetch: async () =>
      Response.json(
        { message: "Ticket missing", details: { ticketId: "nope" } },
        { status: 404, headers: { "x-request-id": "req_123" } },
      ),
  });
  await assert.rejects(sdk.support.getTicket("nope"), (error) => {
    assert.ok(error instanceof HashpassError);
    assert.equal(error.code, "not_found");
    assert.equal(error.requestId, "req_123");
    return true;
  });
});

test("preserves caller cancellation instead of reporting a timeout", async () => {
  const controller = new AbortController();
  let fetchStarted;
  const fetchReady = new Promise((resolve) => {
    fetchStarted = resolve;
  });
  const sdk = createHashpass({
    appId: "app_test",
    fetch: async (_url, init) => {
      fetchStarted();
      await new Promise((_, reject) => {
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        );
      });
    },
    timeoutMs: 5_000,
  });

  const request = sdk.support
    .watchTicket("ticket_1", { signal: controller.signal })
    .next();
  await fetchReady;
  controller.abort(new Error("caller stopped watching"));
  await assert.rejects(request, (error) => {
    assert.equal(error.message, "caller stopped watching");
    assert.notEqual(error.code, "timeout");
    return true;
  });
});

test("session-backed auth refreshes an expired token", async () => {
  let session = {
    accessToken: "expired",
    refreshToken: "refresh",
    tokenType: "Bearer",
    expiresAt: "2000-01-01T00:00:00.000Z",
    scope: ["support"],
  };
  const sdk = createHashpass({
    appId: "app_test",
    sessionStore: {
      get: () => session,
      set: (next) => {
        session = next;
      },
      clear: () => {
        session = null;
      },
    },
    fetch: async () =>
      Response.json({
        accessToken: "fresh",
        refreshToken: "refresh-2",
        tokenType: "Bearer",
        expiresAt: "2099-01-01T00:00:00.000Z",
        scope: ["support"],
      }),
  });
  assert.equal(await sdk.auth.getAccessToken(), "fresh");
  assert.equal(session.refreshToken, "refresh-2");
});

test("x402 parses 402, preserves idempotency, and retries with payment", async () => {
  const calls = [];
  const client = createHashpass({
    appId: "demo",
    baseUrl: "https://example.test",
    fetch: async (_url, init) => {
      calls.push(init);
      if (calls.length === 1)
        return new Response(
          JSON.stringify({
            x402Version: 2,
            accepts: [
              {
                scheme: "exact",
                network: "algorand:testnet",
                amount: "20000",
                asset: "10458941",
                payTo: "PAYTO",
              },
            ],
          }),
          { status: 402, headers: { "content-type": "application/json" } },
        );
      return Response.json({
        requestId: "r",
        eventId: "e",
        matches: [],
        generatedAt: new Date(0).toISOString(),
      });
    },
  });
  const result = await client.x402.getNetworkingMatches(
    { eventId: "e", interests: [], goals: [] },
    {
      idempotencyKey: "same",
      payment: async () => ({ "payment-signature": "secret" }),
    },
  );
  assert.equal(result.requestId, "r");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.get("idempotency-key"), "same");
  assert.equal(calls[1].headers.get("idempotency-key"), "same");
  assert.equal(calls[1].headers.get("payment-signature"), "secret");
});

test("x402 exposes typed payment-required error without signer", async () => {
  const client = createHashpass({
    appId: "demo",
    baseUrl: "https://example.test",
    fetch: async () =>
      new Response(
        JSON.stringify({
          x402Version: 2,
          accepts: [
            {
              scheme: "exact",
              network: "algorand:testnet",
              amount: "1",
              asset: "10458941",
              payTo: "P",
            },
          ],
        }),
        { status: 402, headers: { "content-type": "application/json" } },
      ),
  });
  await assert.rejects(
    () =>
      client.x402.getEventConcierge({
        eventId: "e",
        interests: [],
        goals: [],
        availableFrom: "09:00",
        availableUntil: "10:00",
      }),
    (e) =>
      e.name === "PaymentRequiredError" &&
      e.requirement.accepts[0].asset === "10458941",
  );
});
