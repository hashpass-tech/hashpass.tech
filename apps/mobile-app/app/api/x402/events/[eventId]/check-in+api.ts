import { checkIn, sha256 } from "@hashpass/x402-event-agent";
import { consumeQR, loadEventContext } from "@/lib/server/x402-repositories";
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
  if (
    typeof body.token !== "string" ||
    body.token.length < 8 ||
    body.token.length > 4096 ||
    typeof body.checkpointId !== "string"
  )
    return Response.json({ error: "validation_error" }, { status: 422 });
  const id = eventId(request);
  if (!(await loadEventContext(request, id)))
    return Response.json({ error: "event_not_found" }, { status: 404 });
  const gate = await requireX402(request, x402Config.prices.checkIn);
  if (gate.response) return gate.response;
  console.info("[x402-check-in]", {
    eventId: id,
    checkpointId: body.checkpointId,
    qrReference: await sha256(body.token),
  });
  return Response.json(
    await checkIn(id, body, {
      qr: { consume: (i) => consumeQR(request, i) },
      paymentTransactionId: gate.payment?.transactionId,
    }),
  );
}
