import type { NormalizedPOAP } from './normalize.js';
export interface POAPChainReader { listByOwner(address: string): Promise<NormalizedPOAP[]>; ownerOf(tokenId: string): Promise<string | null>; }
export async function fallbackToChain(apiRead: () => Promise<NormalizedPOAP[]>, chainRead: () => Promise<NormalizedPOAP[]>): Promise<NormalizedPOAP[]> { try { return await apiRead(); } catch { return chainRead(); } }
