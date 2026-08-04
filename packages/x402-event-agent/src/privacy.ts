const SENSITIVE = new Set([
  "email",
  "phone",
  "telephone",
  "user_id",
  "userId",
  "token",
  "authorization",
  "signature",
  "seed",
  "privateKey",
]);
export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !SENSITIVE.has(k))
        .map(([k, v]) => [k, redactSensitive(v)]),
    );
  return value;
}
