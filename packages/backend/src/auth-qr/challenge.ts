import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const QR_AUTH_TTL_SECONDS = 180;
export const opaqueToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const challengeHash = (value: string) => createHash('sha256').update(value).digest('base64url');
export function verifyCodeVerifier(verifier: string, expected: string): boolean {
  const actual = Buffer.from(challengeHash(verifier)); const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
