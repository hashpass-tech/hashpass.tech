import type {
  AgendaSession,
  ConciergeInput,
  PassEntitlements,
  PublicSpeaker,
} from "../types.js";
const words = (v: string) =>
  new Set(
    v
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((x) => x.length > 2),
  );
const overlap = (a: string[], b: string[]) => {
  const right = words(b.join(" "));
  return [...words(a.join(" "))].filter((x) => right.has(x)).length;
};
export function scoreAgenda(
  session: AgendaSession,
  input: ConciergeInput,
  speakers: PublicSpeaker[],
  pass: PassEntitlements,
) {
  const related = speakers.filter((s) => session.speakerIds?.includes(s.id));
  const hay = [
    session.title,
    session.description || "",
    session.category || "",
    ...related.flatMap((s) => s.topics),
  ];
  let score = overlap([...input.interests, ...input.goals], hay) * 12;
  const languageOk =
    !input.preferredLanguages?.length ||
    !session.language ||
    input.preferredLanguages.includes(session.language);
  if (languageOk) score += 8;
  else score -= 20;
  if (input.sessionsAlreadySelected?.includes(session.id)) score -= 30;
  if (input.avoid?.length && overlap(input.avoid, hay)) score -= 50;
  const eligible =
    !session.requiredEntitlement ||
    pass.entitlements.includes(session.requiredEntitlement);
  if (eligible) score += 10;
  else score -= 100;
  return {
    score: Math.max(0, Math.min(100, score)) / 100,
    eligible,
    related,
    reason:
      overlap(input.interests, hay) > 0
        ? "Matches your interests and goals"
        : "Fits your available event window",
  };
}
