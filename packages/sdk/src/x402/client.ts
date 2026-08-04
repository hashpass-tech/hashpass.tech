import type { HttpTransport } from "../transport.js";
import { PaymentRequiredError } from "./errors.js";
import type {
  CheckInInput,
  CheckInResponse,
  ConciergeInput,
  ConciergeResponse,
  NetworkingInput,
  NetworkingResponse,
  PaymentCallback,
  X402RequestOptions,
  X402PaymentRequirement,
} from "./types.js";
export class X402Client {
  constructor(
    private readonly transport: HttpTransport,
    private readonly defaultPayment?: PaymentCallback,
  ) {}
  getEventConcierge(input: ConciergeInput, o?: X402RequestOptions) {
    const { eventId, ...body } = input;
    return this.paid<ConciergeResponse>(
      `api/x402/events/${encodeURIComponent(eventId)}/concierge`,
      body,
      o,
    );
  }
  getNetworkingMatches(input: NetworkingInput, o?: X402RequestOptions) {
    const { eventId, ...body } = input;
    return this.paid<NetworkingResponse>(
      `api/x402/events/${encodeURIComponent(eventId)}/networking/match`,
      body,
      o,
    );
  }
  checkIn(input: CheckInInput, o?: X402RequestOptions) {
    const { eventId, ...body } = input;
    return this.paid<CheckInResponse>(
      `api/x402/events/${encodeURIComponent(eventId)}/check-in`,
      body,
      o,
    );
  }
  private async paid<T>(
    path: string,
    body: unknown,
    o: X402RequestOptions = {},
  ) {
    const key = o.idempotencyKey || crypto.randomUUID();
    try {
      return await this.transport.request<T>(path, {
        method: "POST",
        body,
        idempotencyKey: key,
        authenticated: false,
        signal: o.signal,
      });
    } catch (e) {
      const error = e as { status?: number; details?: unknown };
      if (error.status !== 402) throw e;
      const req = parseRequirement(error.details);
      const payment = o.payment || this.defaultPayment;
      if (!payment) throw new PaymentRequiredError(req);
      const headers = await payment(req);
      return this.transport.request<T>(path, {
        method: "POST",
        body,
        idempotencyKey: key,
        authenticated: false,
        signal: o.signal,
        headers,
      });
    }
  }
}
function parseRequirement(value: unknown): X402PaymentRequirement {
  const v = value as Partial<X402PaymentRequirement>;
  if (
    !v ||
    typeof v !== "object" ||
    !Array.isArray(v.accepts) ||
    !v.accepts.length
  )
    throw new PaymentRequiredError({ x402Version: 2, accepts: [] });
  return v as X402PaymentRequirement;
}
