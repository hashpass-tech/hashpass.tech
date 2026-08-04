import { buildConcierge } from "@hashpass/x402-event-agent";
import { loadEventContext, loadPass } from "@/lib/server/x402-repositories";
import { requireX402, x402Config } from "@/lib/server/x402";
const eventId = (r: Request) =>
  decodeURIComponent(
    new URL(r.url).pathname.split("/events/")[1]?.split("/")[0] || "",
  );
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 16384)
    return Response.json({ error: "request_too_large" }, { status: 413 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !Array.isArray(body.interests) ||
    !Array.isArray(body.goals) ||
    !/^\d{2}:\d{2}$/.test(body.availableFrom) ||
    !/^\d{2}:\d{2}$/.test(body.availableUntil)
  )
    return Response.json({ error: "validation_error" }, { status: 422 });
  const id = eventId(request);
  const gate = await requireX402(request, x402Config.prices.concierge);
  if (gate.response) return gate.response;
  const result = await buildConcierge(id, body, {
    events: { getEvent: () => loadEventContext(request, id) },
    passes: { getEntitlements: (_e, p) => loadPass(request, id, p) },
  });
  return result
    ? Response.json(result)
    : Response.json({ error: "event_not_found" }, { status: 404 });
}
