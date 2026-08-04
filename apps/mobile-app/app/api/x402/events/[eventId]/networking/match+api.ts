import { findNetworkingMatches } from "@hashpass/x402-event-agent";
import {
  loadNetworking,
  loadPass,
  loadEventContext,
} from "@/lib/server/x402-repositories";
import { requireX402, x402Config } from "@/lib/server/x402";
const eventId = (r: Request) =>
  decodeURIComponent(
    new URL(r.url).pathname.split("/events/")[1]?.split("/")[0] || "",
  );
export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.interests) || !Array.isArray(body.goals))
    return Response.json({ error: "validation_error" }, { status: 422 });
  const id = eventId(request);
  if (!(await loadEventContext(request, id)))
    return Response.json({ error: "event_not_found" }, { status: 404 });
  const gate = await requireX402(request, x402Config.prices.networking);
  if (gate.response) return gate.response;
  return Response.json(
    await findNetworkingMatches(id, body, {
      networking: { listVisibleProfiles: () => loadNetworking(request, id) },
      passes: { getEntitlements: (_e, p) => loadPass(request, id, p) },
    }),
  );
}
