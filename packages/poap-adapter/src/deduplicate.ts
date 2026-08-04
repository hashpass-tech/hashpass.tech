import type { NormalizedPOAP } from './normalize.js';
export function deduplicatePOAPs(items: NormalizedPOAP[]): NormalizedPOAP[] { const map = new Map<string, NormalizedPOAP>(); for (const item of items) { const previous = map.get(item.sourceIdentifier); if (!previous || previous.dataSource === 'chain') map.set(item.sourceIdentifier, item); } return [...map.values()]; }
