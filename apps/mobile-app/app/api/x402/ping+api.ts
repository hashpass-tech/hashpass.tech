import { requireX402, x402Config } from "@/lib/server/x402";
export async function GET(request: Request) {
  const gate = await requireX402(request, x402Config.prices.ping);
  if (gate.response) return gate.response;
  return Response.json(
    {
      ok: true,
      service: "HashPass x402 Event Agent API",
      message: "Paid request unlocked",
      paymentTransactionId: gate.payment?.transactionId,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
export const POST = GET;
