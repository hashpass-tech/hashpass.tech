import assert from "node:assert/strict";
import test from "node:test";
import worker, { EventCheckIns } from "../src/worker.js";

class MemoryStorage {
  values = new Map();
  get(key) {
    return this.values.get(key);
  }
  put(key, value) {
    this.values.set(key, value);
  }
}

const object = () => new EventCheckIns({ storage: new MemoryStorage() });

test("accepts a pass once and rejects a duplicate", async () => {
  const cell = object();
  const request = () =>
    new Request("http://cell/?eventId=summit", {
      method: "POST",
      body: JSON.stringify({ passId: "pass-123" }),
    });

  const first = await cell.fetch(request());
  assert.equal(first.status, 201);
  assert.deepEqual(
    (({ accepted, duplicate, count }) => ({ accepted, duplicate, count }))(
      await first.json(),
    ),
    { accepted: true, duplicate: false, count: 1 },
  );

  const second = await cell.fetch(request());
  assert.equal(second.status, 200);
  assert.equal((await second.json()).duplicate, true);
});

test("routes each event to a stable, isolated object", async () => {
  const calls = [];
  const env = {
    EVENT_CHECK_INS: {
      idFromName: (name) => `id:${name}`,
      get: (id) => ({
        fetch: (request) => {
          calls.push({ id, url: request.url });
          return new Response("ok");
        },
      }),
    },
  };

  const response = await worker.fetch(
    new Request("https://poc.test/events/event-42/check-ins"),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      id: "id:event-42",
      url: "https://poc.test/events/event-42/check-ins?eventId=event-42",
    },
  ]);
});

test("validates requests and unknown routes", async () => {
  const cell = object();
  const invalid = await cell.fetch(
    new Request("http://cell", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(invalid.status, 400);

  const missing = await worker.fetch(
    new Request("https://poc.test/health"),
    {},
  );
  assert.equal(missing.status, 404);
});
