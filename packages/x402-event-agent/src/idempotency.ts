import type { PaidRequestRepository } from "./types.js";
export async function existingResponse(
  repo: PaidRequestRepository,
  key?: string,
) {
  return key ? repo.findByIdempotencyKey(key) : null;
}
export function requireIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length > 128)
    throw new Error("A valid Idempotency-Key header is required");
  return key;
}
