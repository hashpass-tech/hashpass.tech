export interface EventTicketAttendee {
  email: string;
  fullName: string;
  phone?: string;
  locale?: string;
}

export interface WompiPaymentEvidence {
  provider: "wompi";
  transactionId: string;
  reference: string;
  amountInCents: number;
  currency: "COP";
}

export interface IssueEventTicketInput {
  externalReference: string;
  ticketTypeId: string;
  attendee: EventTicketAttendee;
  payment: WompiPaymentEvidence;
  metadata?: Record<string, unknown>;
}

export interface EventTicket {
  id: string;
  eventId: string;
  externalReference: string;
  ticketTypeId: string;
  attendee: EventTicketAttendee;
  status: "active" | "checked_in" | "revoked";
  createdAt: string;
  idempotentReplay: boolean;
}
