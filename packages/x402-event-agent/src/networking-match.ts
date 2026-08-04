import { scoreNetworking } from "./scoring/networking-score.js";
import type {
  NetworkingInput,
  NetworkingRepository,
  NetworkingResponse,
  PassEntitlementRepository,
} from "./types.js";
export async function findNetworkingMatches(
  eventId: string,
  input: NetworkingInput,
  deps: {
    networking: NetworkingRepository;
    passes: PassEntitlementRepository;
    now?: () => Date;
    requestId?: () => string;
  },
): Promise<NetworkingResponse> {
  const [profiles, pass] = await Promise.all([
    deps.networking.listVisibleProfiles(eventId, input.attendeeReference),
    deps.passes.getEntitlements(eventId, input.passReference),
  ]);
  const limit = Math.max(1, Math.min(10, input.limit || 3));
  const matches = profiles
    .filter((p) => p.visible && p.eventId === eventId)
    .map((p) => ({ p, ...scoreNetworking(p, input) }))
    .sort(
      (a, b) => b.score - a.score || a.p.profileId.localeCompare(b.p.profileId),
    )
    .slice(0, limit)
    .map(({ p, score, shared, complement }) => ({
      profileId: p.profileId,
      displayName: p.displayName,
      role: p.role,
      company: p.company,
      matchScore: score,
      sharedInterests: shared,
      whyMeet: complement.length
        ? `Complementary needs: ${complement.join(", ")}`
        : `Shared focus on ${shared.join(", ") || "event collaboration"}`,
      suggestedConversation: `Discuss ${[...shared, ...complement][0] || "potential collaboration"} at this event.`,
      availableSlots: p.availableSlots || [],
      meetingRequestAllowed: pass.meetingRequestAllowed,
      recommendedFirstMessage: `Hi ${p.displayName}, our event goals overlap around ${shared[0] || "collaboration"}. Would you be open to connecting?`,
    }));
  return {
    requestId: deps.requestId?.() || crypto.randomUUID(),
    eventId,
    matches,
    generatedAt: (deps.now?.() || new Date()).toISOString(),
  };
}
