import type { X402PaymentRequirement } from "./types.js";
export class PaymentRequiredError extends Error {
  readonly status = 402;
  constructor(readonly requirement: X402PaymentRequirement) {
    super("Payment is required to access this HashPass service");
    this.name = "PaymentRequiredError";
  }
}
export class MalformedX402ResponseError extends Error {
  constructor() {
    super("The HashPass x402 response was malformed");
    this.name = "MalformedX402ResponseError";
  }
}
