export class CollectiblesError extends Error { constructor(message: string, readonly code: string, readonly status = 400) { super(message); this.name = 'CollectiblesError'; } }
export const redactSignature = (value: string) => value ? `${value.slice(0, 10)}…[redacted]` : value;
