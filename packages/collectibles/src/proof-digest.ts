import { createHash } from 'node:crypto';
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k, stable(v)])); return value; }
export function stableJson(value: unknown): string { return JSON.stringify(stable(value)); }
export function createProofDigest(input: unknown): string { return `sha256:${createHash('sha256').update(stableJson(input)).digest('hex')}`; }
export function pseudonymousHolderSubject(userId: string, eventId: string, salt: string): string { return createProofDigest({ userId, eventId, salt }).replace('sha256:', 'holder:'); }
