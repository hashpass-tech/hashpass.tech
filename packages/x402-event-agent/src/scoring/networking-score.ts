import type { NetworkingInput, NetworkingProfile } from "../types.js";
const norm = (a: string[]) => new Set(a.map((x) => x.trim().toLowerCase()));
const common = (a: string[], b: string[]) => {
  const x = norm(a);
  return b.filter((y) => x.has(y.toLowerCase()));
};
export function scoreNetworking(p: NetworkingProfile, i: NetworkingInput) {
  const shared = common(i.interests, p.interests);
  const complement = [
    ...common(i.seeks || [], p.offers),
    ...common(i.offers || [], p.seeks),
  ];
  const score = Math.min(
    1,
    (shared.length * 25 +
      complement.length * 30 +
      (i.industry && p.company?.toLowerCase().includes(i.industry.toLowerCase())
        ? 10
        : 0)) /
      100,
  );
  return { score, shared, complement };
}
