import { scoreAgenda } from "./scoring/agenda-score.js";
import type {
  ConciergeInput,
  ConciergeResponse,
  EventContextRepository,
  PassEntitlementRepository,
  AgendaRecommendation,
} from "./types.js";
const mins = (v: string) => {
  const m = v.match(/(?:T|^)(\d{2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : NaN;
};
export async function buildConcierge(
  eventId: string,
  input: ConciergeInput,
  deps: {
    events: EventContextRepository;
    passes: PassEntitlementRepository;
    now?: () => Date;
    requestId?: () => string;
  },
): Promise<ConciergeResponse | null> {
  const event = await deps.events.getEvent(eventId);
  if (!event) return null;
  const pass = await deps.passes.getEntitlements(eventId, input.passReference);
  const from = mins(input.availableFrom),
    until = mins(input.availableUntil);
  const ranked = event.sessions
    .filter((s) => mins(s.startsAt) >= from && mins(s.endsAt) <= until)
    .map((s) => {
      const x = scoreAgenda(s, input, event.speakers, pass);
      return { session: s, ...x };
    })
    .filter((x) => x.eligible)
    .sort(
      (a, b) =>
        b.score - a.score ||
        mins(a.session.startsAt) - mins(b.session.startsAt),
    );
  const chosen: typeof ranked = [];
  const alternatives: typeof ranked = [];
  for (const item of ranked) {
    if (
      chosen.some(
        (x) =>
          mins(item.session.startsAt) < mins(x.session.endsAt) &&
          mins(item.session.endsAt) > mins(x.session.startsAt),
      )
    )
      alternatives.push(item);
    else chosen.push(item);
  }
  const map = (x: (typeof ranked)[number]): AgendaRecommendation => ({
    sessionId: x.session.id,
    title: x.session.title,
    reason: x.reason,
    startsAt: x.session.startsAt,
    endsAt: x.session.endsAt,
    location: x.session.location,
    score: x.score,
    relevantSpeakers: x.related,
  });
  const agenda = chosen.map(map);
  return {
    requestId: deps.requestId?.() || crypto.randomUUID(),
    eventId: event.id,
    eventName: event.name,
    recommendedAgenda: agenda,
    speakersToFollow: [
      ...new Map(
        agenda.flatMap((x) => x.relevantSpeakers).map((x) => [x.id, x]),
      ).values(),
    ].slice(0, 5),
    passBenefits: pass.benefits,
    bestNextAction: agenda[0]
      ? {
          type: "attend_session",
          targetId: agenda[0].sessionId,
          reason: "Highest-ranked conflict-free session in your window",
        }
      : undefined,
    alternatives: alternatives.slice(0, 5).map(map),
    warnings: agenda.length
      ? []
      : ["No eligible sessions fit the requested time window"],
    generatedAt: (deps.now?.() || new Date()).toISOString(),
  };
}
