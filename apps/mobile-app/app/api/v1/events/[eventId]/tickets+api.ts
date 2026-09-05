import { getSupabaseServerForRequest } from "@/lib/supabase-server";
import { authenticateDeveloperRequest, environmentFor, problem, requestIdFor, verifyPaymentEvidence } from "@/lib/server/developer-api";
import { eventIdFromRequest } from "@/lib/server/event-api";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/;
const TICKET_TYPE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function validBody(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const attendee = body.attendee as Record<string, unknown> | undefined;
  const payment = body.payment as Record<string, unknown> | undefined;
  return typeof body.externalReference === "string" && IDENTIFIER.test(body.externalReference)
    && typeof body.ticketTypeId === "string" && TICKET_TYPE.test(body.ticketTypeId)
    && !!attendee && typeof attendee.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)
    && typeof attendee.fullName === "string" && attendee.fullName.trim().length > 0 && attendee.fullName.length <= 200
    && !!payment && payment.provider === "wompi"
    && typeof payment.transactionId === "string" && IDENTIFIER.test(payment.transactionId)
    && typeof payment.reference === "string" && IDENTIFIER.test(payment.reference)
    && Number.isSafeInteger(payment.amountInCents) && Number(payment.amountInCents) > 0
    && payment.currency === "COP"
    && (body.metadata === undefined || (!!body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)));
}

async function sha256Json(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  const eventId = eventIdFromRequest(request);
  if (!eventId) return problem(400, "invalid_event", "A valid event id is required", requestId);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
    return problem(400, "invalid_idempotency_key", "A valid Idempotency-Key is required", requestId);
  }
  const authentication = await authenticateDeveloperRequest(request, requestId);
  if ("response" in authentication) return authentication.response;

  let body: unknown;
  try { body = await request.json(); } catch { return problem(400, "invalid_json", "A JSON body is required", requestId); }
  if (!validBody(body)) return problem(400, "invalid_request", "The ticket request is invalid", requestId);

  const payment = body.payment as unknown as Parameters<typeof verifyPaymentEvidence>[0];
  const verified = await verifyPaymentEvidence(payment, authentication.environment);
  if (!verified.ok) {
    return problem(verified.retryable ? 503 : 422, verified.reason, "Payment could not be verified", requestId);
  }

  const supabase = getSupabaseServerForRequest(request);
  const { data, error } = await supabase.rpc("issue_developer_ticket", {
    p_secret_hash: authentication.secretHash,
    p_environment: environmentFor(request),
    p_event_id: eventId,
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256Json(body),
    p_external_reference: body.externalReference,
    p_ticket_type_id: body.ticketTypeId,
    p_attendee: body.attendee,
    p_payment: body.payment,
    p_metadata: body.metadata || {},
  });
  if (error) {
    const code = error.code === "28000" ? "invalid_api_key" : error.code === "42501" ? "forbidden" : error.code === "23505" ? "idempotency_conflict" : "issuance_failed";
    const status = code === "invalid_api_key" ? 401 : code === "forbidden" ? 403 : code === "idempotency_conflict" ? 409 : 500;
    if (status === 500) console.error("[developer-ticket-api] issuance failed", { requestId, code: error.code });
    return problem(status, code, status === 500 ? "Ticket issuance failed" : "Ticket issuance rejected", requestId);
  }
  return Response.json(data, {
    status: data?.idempotentReplay ? 200 : 201,
    headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" },
  });
}
