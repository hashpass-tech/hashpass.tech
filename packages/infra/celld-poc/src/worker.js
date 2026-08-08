const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export class EventCheckIns {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const count = (await this.storage.get("count")) ?? 0;
      return json({ eventId: url.searchParams.get("eventId"), count });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const body = await request.json().catch(() => null);
    if (!body?.passId || typeof body.passId !== "string") {
      return json({ error: "passId_required" }, 400);
    }

    const key = `pass:${body.passId}`;
    const previous = await this.storage.get(key);
    if (previous) {
      return json({ accepted: false, duplicate: true, checkedInAt: previous });
    }

    const checkedInAt = new Date().toISOString();
    const count = ((await this.storage.get("count")) ?? 0) + 1;
    await this.storage.put(key, checkedInAt);
    await this.storage.put("count", count);

    return json({ accepted: true, duplicate: false, checkedInAt, count }, 201);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/events\/([^/]+)\/check-ins$/);
    if (!match) return json({ error: "not_found" }, 404);

    const eventId = decodeURIComponent(match[1]);
    const object = env.EVENT_CHECK_INS.get(
      env.EVENT_CHECK_INS.idFromName(eventId),
    );
    url.searchParams.set("eventId", eventId);
    return object.fetch(new Request(url, request));
  },
};
