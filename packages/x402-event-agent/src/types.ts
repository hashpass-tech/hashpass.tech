export type TimeRange = { from: string; until: string };
export type AgendaSession = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  language?: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  speakerIds?: string[];
  requiredEntitlement?: string;
};
export type PublicSpeaker = {
  id: string;
  displayName: string;
  role?: string;
  company?: string;
  topics: string[];
  languages?: string[];
};
export type EventContext = {
  id: string;
  name: string;
  sessions: AgendaSession[];
  speakers: PublicSpeaker[];
};
export type PassEntitlements = {
  tier?: string;
  benefits: string[];
  entitlements: string[];
  meetingRequestAllowed: boolean;
};
export interface EventContextRepository {
  getEvent(eventId: string): Promise<EventContext | null>;
}
export interface PassEntitlementRepository {
  getEntitlements(
    eventId: string,
    passReference?: string,
  ): Promise<PassEntitlements>;
}
export type ConciergeInput = {
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
export type AgendaRecommendation = {
  sessionId: string;
  title: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  score: number;
  relevantSpeakers: PublicSpeaker[];
};
export type ConciergeResponse = {
  requestId: string;
  eventId: string;
  eventName: string;
  recommendedAgenda: AgendaRecommendation[];
  speakersToFollow: PublicSpeaker[];
  passBenefits: string[];
  bestNextAction?: { type: "attend_session"; targetId: string; reason: string };
  alternatives: AgendaRecommendation[];
  warnings: string[];
  generatedAt: string;
};
export type NetworkingProfile = {
  profileId: string;
  displayName: string;
  role?: string;
  company?: string;
  interests: string[];
  offers: string[];
  seeks: string[];
  availableSlots?: TimeRange[];
  visible: boolean;
  eventId: string;
  authorizedFields?: string[];
};
export interface NetworkingRepository {
  listVisibleProfiles(
    eventId: string,
    viewerReference?: string,
  ): Promise<NetworkingProfile[]>;
}
export type NetworkingInput = {
  interests: string[];
  goals: string[];
  industry?: string;
  role?: string;
  offers?: string[];
  seeks?: string[];
  attendeeReference?: string;
  passReference?: string;
  preferredMeetingTimes?: TimeRange[];
  limit?: number;
};
export type NetworkingMatch = {
  profileId: string;
  displayName: string;
  role?: string;
  company?: string;
  matchScore: number;
  sharedInterests: string[];
  whyMeet: string;
  suggestedConversation: string;
  availableSlots: TimeRange[];
  meetingRequestAllowed: boolean;
  recommendedFirstMessage: string;
};
export type NetworkingResponse = {
  requestId: string;
  eventId: string;
  matches: NetworkingMatch[];
  generatedAt: string;
};
export type QRStatus =
  | "checked_in"
  | "not_found"
  | "expired"
  | "revoked"
  | "suspended"
  | "already_used"
  | "limit_reached"
  | "event_mismatch"
  | "database_error"
  | "invalid";
export type QRConsumeResult = {
  valid: boolean;
  status: QRStatus;
  eventId?: string;
  passTier?: string;
  checkedInAt?: string;
  qrReference?: string;
};
export interface QRVerificationRepository {
  consume(input: {
    eventId: string;
    token: string;
    checkpointId: string;
    deviceId?: string;
  }): Promise<QRConsumeResult>;
}
export type CheckInResponse = {
  requestId: string;
  valid: boolean;
  status: QRStatus;
  eventId: string;
  passTier?: string;
  checkpointId: string;
  checkedInAt?: string;
  proofDigest?: string;
  paymentTransactionId?: string;
};
export type PaymentRequirement = {
  x402Version: 2;
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
};
export type VerifiedPayment = {
  valid: boolean;
  payer?: string;
  transactionId?: string;
  reason?: string;
};
export interface X402PaymentVerifier {
  verify(
    payload: string,
    requirement: PaymentRequirement,
  ): Promise<VerifiedPayment>;
  settle(
    payload: string,
    requirement: PaymentRequirement,
  ): Promise<VerifiedPayment>;
}
export interface PaidRequestRepository {
  findByIdempotencyKey(key: string): Promise<{ response: unknown } | null>;
  hasTransaction(transactionId: string): Promise<boolean>;
  record(input: {
    serviceType: string;
    eventId?: string;
    idempotencyKey?: string;
    requestHash: string;
    payment: VerifiedPayment;
    requirement: PaymentRequirement;
    resultStatus: string;
    response: unknown;
    qrReference?: string;
    checkpointId?: string;
    proofDigest?: string;
  }): Promise<void>;
}
