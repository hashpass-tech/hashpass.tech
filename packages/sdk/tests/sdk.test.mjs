import assert from "node:assert/strict";
import test from "node:test";
import { HashpassError, createHashpass } from "../dist/index.js";

test("requires a public app id", () => {
  assert.throws(() => createHashpass({ appId: "" }), (error) => {
    assert.equal(error.code, "configuration_error");
    return true;
  });
});

test("creates an AI-assisted support ticket with app and auth headers", async () => {
  let captured;
  const fetch = async (url, init) => {
    captured = { url, init };
    return Response.json({ id: "ticket_1", subject: "Help", status: "open", priority: "normal" });
  };
  const sdk = createHashpass({
    appId: "app_test",
    baseUrl: "https://support.example.test/api/",
    fetch,
    auth: { getAccessToken: () => "access-token" },
  });
  await sdk.support.createTicket({ subject: "Help", message: "Something broke", idempotencyKey: "once" });

  assert.equal(captured.url, "https://support.example.test/api/v1/support/tickets");
  assert.equal(captured.init.headers.get("x-hashpass-app-id"), "app_test");
  assert.equal(captured.init.headers.get("authorization"), "Bearer access-token");
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
    fetch: async () => Response.json(
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
  const fetchReady = new Promise((resolve) => { fetchStarted = resolve; });
  const sdk = createHashpass({
    appId: "app_test",
    fetch: async (_url, init) => {
      fetchStarted();
      await new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      });
    },
    timeoutMs: 5_000,
  });

  const request = sdk.support.watchTicket("ticket_1", { signal: controller.signal }).next();
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
    sessionStore: { get: () => session, set: (next) => { session = next; }, clear: () => { session = null; } },
    fetch: async () => Response.json({
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

test("exposes support MVP contract extensions", async () => {
  const calls = [];
  const sdk = createHashpass({
    appId: "app_test",
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (String(url).includes("widget-config")) return Response.json({ appId: "app_test", locale: "en", position: "bottom-right", greeting: "Hi" });
      if (String(url).includes("/messages") && init.method !== "POST") return Response.json({ items: [], nextCursor: "m_1" });
      if (String(url).includes("/events")) return Response.json({ items: [], nextCursor: "e_1" });
      return Response.json({ id: "ticket_1", subject: "Help", status: "open", priority: "normal" });
    },
  });
  await sdk.support.getWidgetConfiguration("app_test");
  await sdk.support.listMessages("ticket_1", { cursor: "m_0", limit: 20 });
  await sdk.support.getTicketEvents("ticket_1", "e_0");
  await sdk.support.markTicketRead("ticket_1", { cursor: "e_1" });
  await sdk.support.reopenTicket("ticket_1");
  assert.equal(calls[0].url, "https://api.hashpass.tech/v1/support/widget-config?appId=app_test");
  assert.equal(calls[1].url, "https://api.hashpass.tech/v1/support/tickets/ticket_1/messages?cursor=m_0&limit=20");
  assert.equal(calls[2].url, "https://api.hashpass.tech/v1/support/tickets/ticket_1/events?cursor=e_0");
  assert.equal(calls[3].init.headers.get("idempotency-key"), "read:ticket_1:e_1");
  assert.deepEqual(JSON.parse(calls[4].init.body), { status: "open" });
});
