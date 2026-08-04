import { sha256 } from "./proof-digest.js";
import type { CheckInResponse, QRVerificationRepository } from "./types.js";
export async function checkIn(
  eventId: string,
  input: { token: string; checkpointId: string; deviceId?: string },
  deps: {
    qr: QRVerificationRepository;
    paymentTransactionId?: string;
    requestId?: () => string;
  },
): Promise<CheckInResponse> {
  const requestId = deps.requestId?.() || crypto.randomUUID();
  let result;
  try {
    result = await deps.qr.consume({ eventId, ...input });
  } catch {
    return {
      requestId,
      valid: false,
      status: "database_error",
      eventId,
      checkpointId: input.checkpointId,
      paymentTransactionId: deps.paymentTransactionId,
    };
  }
  if (!result.valid)
    return {
      requestId,
      valid: false,
      status: result.status,
      eventId,
      checkpointId: input.checkpointId,
      paymentTransactionId: deps.paymentTransactionId,
    };
  const checkedInAt = result.checkedInAt || new Date().toISOString();
  return {
    requestId,
    valid: true,
    status: "checked_in",
    eventId,
    passTier: result.passTier,
    checkpointId: input.checkpointId,
    checkedInAt,
    proofDigest: await sha256(
      [
        eventId,
        result.qrReference || "",
        input.checkpointId,
        checkedInAt,
        deps.paymentTransactionId || "",
      ].join("|"),
    ),
    paymentTransactionId: deps.paymentTransactionId,
  };
}
