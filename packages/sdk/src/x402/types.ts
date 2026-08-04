export type X402PaymentRequirement = {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    amount?: string;
    maxAmountRequired?: string;
    asset: string;
    payTo: string;
  }>;
  resource?: { url: string; description?: string };
};
export type PaymentAuthorization = Record<string, string>;
export type PaymentCallback = (
  requirement: X402PaymentRequirement,
) => Promise<PaymentAuthorization>;
export type X402RequestOptions = {
  idempotencyKey?: string;
  payment?: PaymentCallback;
  signal?: AbortSignal;
};
export type ConciergeInput = {
  eventId: string;
  interests: string[];
  goals: string[];
  availableFrom: string;
  availableUntil: string;
  preferredLanguages?: string[];
  passReference?: string;
  sessionsAlreadySelected?: string[];
  avoid?: string[];
  accessibilityPreferences?: string[];
  pacing?: "relaxed" | "balanced" | "packed";
};
export type ConciergeResponse = {
  requestId: string;
  eventId: string;
  eventName: string;
  recommendedAgenda: Array<{
    sessionId: string;
    title: string;
    reason: string;
    startsAt: string;
    endsAt: string;
    score: number;
  }>;
  alternatives: unknown[];
  warnings: string[];
  generatedAt: string;
};
export type NetworkingInput = {
  eventId: string;
  interests: string[];
  goals: string[];
  industry?: string;
  role?: string;
  offers?: string[];
  seeks?: string[];
  limit?: number;
};
export type NetworkingResponse = {
  requestId: string;
  eventId: string;
  matches: Array<{
    profileId: string;
    displayName: string;
    matchScore: number;
    whyMeet: string;
  }>;
  generatedAt: string;
};
export type CheckInInput = {
  eventId: string;
  token: string;
  checkpointId: string;
  deviceId?: string;
};
export type CheckInResponse = {
  requestId: string;
  valid: boolean;
  status: string;
  eventId: string;
  checkpointId: string;
  checkedInAt?: string;
  proofDigest?: string;
  paymentTransactionId?: string;
};
