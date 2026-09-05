import { HttpTransport } from "../transport.js";
import type { EventTicket, IssueEventTicketInput } from "./types.js";

export class EventsClient {
  constructor(private readonly transport: HttpTransport) {}

  /** Issues one event ticket. The idempotency key should remain stable for the source order line. */
  issueTicket(eventId: string, input: IssueEventTicketInput, idempotencyKey: string): Promise<EventTicket> {
    return this.transport.request<EventTicket>(
      `api/v1/events/${encodeURIComponent(eventId)}/tickets`,
      { method: "POST", body: input, idempotencyKey },
    );
  }
}
