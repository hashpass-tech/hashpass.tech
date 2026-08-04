import type { PaymentRequirement, X402PaymentVerifier } from "./types.js";
const enc = (v: unknown) => btoa(JSON.stringify(v));
export function paymentRequired(
  requirement: PaymentRequirement,
  url: string,
  tag: string,
) {
  const body = {
    x402Version: 2,
    resource: {
      url,
      description: "HashPass x402 Event Agent API",
      mimeType: "application/json",
      serviceName: "HashPass Event Agent",
      tags: [tag],
    },
    accepts: [requirement],
  };
  return Response.json(body, {
    status: 402,
    headers: { "payment-required": enc(body), "cache-control": "no-store" },
  });
}
export async function verifyAndSettle(
  request: Request,
  requirement: PaymentRequirement,
  verifier: X402PaymentVerifier,
) {
  const payload =
    request.headers.get("payment-signature") ||
    request.headers.get("x-payment");
  if (!payload)
    return {
      response: paymentRequired(
        requirement,
        request.url,
        "x402-global-challenge",
      ),
    };
  const verified = await verifier.verify(payload, requirement);
  if (!verified.valid)
    return {
      response: Response.json(
        { error: "payment_invalid", message: "Payment verification failed" },
        { status: 402 },
      ),
    };
  const settled = await verifier.settle(payload, requirement);
  if (!settled.valid)
    return {
      response: Response.json(
        { error: "settlement_failed", message: "Payment could not be settled" },
        { status: 402 },
      ),
    };
  return { payment: settled };
}
