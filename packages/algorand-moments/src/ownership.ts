export function isOwner(expected: string, actual?: string | null): boolean { return !!actual && expected.trim() === actual.trim(); }
