import {
  loadX402Config,
  paymentRequired,
  type PaymentRequirement,
  type VerifiedPayment,
  type X402PaymentVerifier,
} from "@hashpass/x402-event-agent";
const config = loadX402Config(process.env);
export const x402Config = config;
const amount = (usd: string) => String(Math.round(Number(usd) * 1_000_000));
export function requirement(price: string): PaymentRequirement {
  return {
    x402Version: 2,
    scheme: "exact",
    network: config.network,
    amount: amount(price),
    asset: config.assetId,
    payTo: config.payTo,
    maxTimeoutSeconds: 300,
    extra: {
      name: "USDC",
      decimals: 6,
      facilitator: "GoPlausible",
      challengeTag: config.challengeTag,
    },
  };
}
class GoPlausibleVerifier implements X402PaymentVerifier {
  private async call(
    path: string,
    payload: string,
    req: PaymentRequirement,
  ): Promise<VerifiedPayment> {
    const parsed = parsePayload(payload);
    const response = await fetch(
      `${config.facilitatorUrl.replace(/\/$/, "")}/${path}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          paymentPayload: parsed,
          paymentRequirements: req,
        }),
      },
    );
    if (!response.ok)
      return { valid: false, reason: `facilitator_${response.status}` };
    const body = (await response.json()) as Record<string, unknown>;
    return {
      valid: body.isValid === true || body.success === true,
      payer: typeof body.payer === "string" ? body.payer : undefined,
      transactionId:
        typeof body.transaction === "string"
          ? body.transaction
          : typeof body.transactionId === "string"
            ? body.transactionId
            : undefined,
      reason:
        typeof body.invalidReason === "string" ? body.invalidReason : undefined,
    };
  }
  verify(p: string, r: PaymentRequirement) {
    return this.call("verify", p, r);
  }
  settle(p: string, r: PaymentRequirement) {
    return this.call("settle", p, r);
  }
}
function parsePayload(value: string) {
  try {
    return JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
      ),
    );
  } catch {
    throw new Error("Malformed payment signature");
  }
}
const verifier = new GoPlausibleVerifier();
export async function requireX402(request: Request, price: string) {
  if (!config.enabled)
    return {
      response: Response.json({ error: "x402_disabled" }, { status: 503 }),
    };
  if (!config.payTo)
    return {
      response: Response.json(
        { error: "x402_not_configured" },
        { status: 503 },
      ),
    };
  const req = requirement(price);
  const signature =
    request.headers.get("payment-signature") ||
    request.headers.get("x-payment");
  if (!signature)
    return {
      response: paymentRequired(req, request.url, config.challengeTag),
      requirement: req,
    };
  try {
    const verified = await verifier.verify(signature, req);
    if (!verified.valid)
      return {
        response: paymentRequired(req, request.url, config.challengeTag),
        requirement: req,
      };
    const settled = await verifier.settle(signature, req);
    if (!settled.valid || !settled.transactionId)
      return {
        response: Response.json(
          { error: "payment_settlement_failed" },
          { status: 402 },
        ),
        requirement: req,
      };
    return { payment: settled, requirement: req };
  } catch {
    return {
      response: Response.json(
        { error: "payment_verification_unavailable" },
        { status: 502 },
      ),
      requirement: req,
    };
  }
}
