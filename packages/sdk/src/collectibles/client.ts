interface CollectiblesTransport { request<T>(path: string, options?: unknown): Promise<T>; }
import type { CollectibleSummary, MomentClaimResponse, MomentEligibilityResponse, MomentVerificationResponse, WalletLinkRequest } from '../collectibles-types.js';
export class CollectiblesClient { constructor(private transport: CollectiblesTransport) {}
 listMine() { return this.transport.request<{items: CollectibleSummary[]}>('/api/moments/me', { authenticated: true }); }
 getMoment(momentId: string) { return this.transport.request<CollectibleSummary>(`/api/moments/${encodeURIComponent(momentId)}`, { authenticated: true }); }
 getEligibility(eventId: string) { return this.transport.request<MomentEligibilityResponse>('/api/moments/eligibility', { method:'POST', body:{ eventId }, authenticated:true }); }
 claim(eventId: string, idempotencyKey: string) { return this.transport.request<MomentClaimResponse>(`/api/events/${encodeURIComponent(eventId)}/moments/claim`, { method:'POST', authenticated:true, idempotencyKey, body:{ idempotencyKey } }); }
 verify(proofId: string) { return this.transport.request<MomentVerificationResponse>(`/api/moments/verify/${encodeURIComponent(proofId)}`, { authenticated:false }); }
 linkEvmWallet(request: WalletLinkRequest) { return this.transport.request('/api/moments/wallets/evm/link', { method:'POST', authenticated:true, body: request }); }
 importPOAPs(address: string) { return this.transport.request<{imported:number}>('/api/moments/poaps/import', { method:'POST', authenticated:true, body:{ address } }); }
 linkAlgorandWallet(request: WalletLinkRequest) { return this.transport.request('/api/moments/wallets/algorand/link', { method:'POST', authenticated:true, body: request }); }
 requestOnchainMint(momentId: string) { return this.transport.request(`/api/moments/${encodeURIComponent(momentId)}/onchain`, { method:'POST', authenticated:true }); }
}
