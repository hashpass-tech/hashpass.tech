import { rateLimitOk } from "@/lib/bsl/rateLimit";

const API_KEY_PATTERN = /^hp_(test|live)_[A-Za-z0-9_-]{32,96}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function problem(status: number, code: string, title: string, requestId: string, detail?: string) {
  return Response.json(
    { type: `https://docs.hashpass.tech/problems/${code}`, title, status, code, requestId, ...(detail ? { detail } : {}) },
    { status, headers: { "Content-Type": "application/problem+json", "X-Request-Id": requestId } },
  );
}

export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 128 ? supplied : crypto.randomUUID();
}

export function environmentFor(request: Request): "test" | "live" {
  const host = new URL(request.url).hostname.toLowerCase();
  return host === "api.hashpass.tech" ? "live" : "test";
}

export async function authenticateDeveloperRequest(request: Request, requestId: string) {
  const authorization = request.headers.get("authorization") || "";
  const rawKey = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!API_KEY_PATTERN.test(rawKey)) {
    return { response: problem(401, "invalid_api_key", "Invalid API key", requestId) } as const;
  }
  const declaredEnvironment = rawKey.startsWith("hp_live_") ? "live" : "test";
  if (declaredEnvironment !== environmentFor(request)) {
    return { response: problem(403, "environment_mismatch", "API key environment mismatch", requestId) } as const;
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  const secretHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (!SHA256_PATTERN.test(secretHash)) throw new Error("Unable to hash API key");
  if (!rateLimitOk(`developer-api:${secretHash.slice(0, 16)}`)) {
    return { response: problem(429, "rate_limited", "Too many requests", requestId) } as const;
  }
  return { secretHash, environment: declaredEnvironment } as const;
}

export interface PaymentEvidence {
  provider: "wompi";
  transactionId: string;
  reference: string;
  amountInCents: number;
  currency: "COP";
}

export async function verifyPaymentEvidence(payment: PaymentEvidence, environment: "test" | "live") {
  const privateKey = environment === "live"
    ? process.env.WOMPI_PRIVATE_KEY
    : process.env.WOMPI_PRIVATE_KEY_DEV;
  if (!privateKey) return { ok: false as const, reason: "payment_verifier_unavailable", retryable: true };
  const baseUrl = environment === "live" ? "https://production.wompi.co" : "https://sandbox.wompi.co";
  let response: Response;
  try {
    // Server-to-server payment verification cannot use the browser/session API client.
    // eslint-disable-next-line no-restricted-syntax
    response = await fetch(`${baseUrl}/v1/transactions/${encodeURIComponent(payment.transactionId)}`, {
      headers: { Authorization: `Bearer ${privateKey}`, Accept: "application/json" },
    });
  } catch {
    return { ok: false as const, reason: "payment_verification_failed", retryable: true };
  }
  if (!response.ok) return { ok: false as const, reason: "payment_verification_failed", retryable: response.status >= 500 };
  let payload: { data?: { status?: string; reference?: string; amount_in_cents?: number; currency?: string } };
  try { payload = await response.json(); } catch {
    return { ok: false as const, reason: "payment_verification_failed", retryable: true };
  }
  const transaction = payload.data;
  const ok = transaction?.status === "APPROVED"
    && transaction.reference === payment.reference
    && transaction.amount_in_cents === payment.amountInCents
    && transaction.currency === payment.currency;
  return ok
    ? { ok: true as const }
    : { ok: false as const, reason: "payment_not_approved_or_mismatch", retryable: false };
}
