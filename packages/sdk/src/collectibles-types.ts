export type MomentClaimState = 'not_eligible' | 'eligible' | 'claimable' | 'claimed_in_hashpass' | 'claimable_onchain' | 'onchain_pending' | 'minted_onchain' | 'transferred_to_user_wallet' | 'expired' | 'revoked' | 'failed' | 'duplicate_prevented';
export interface CollectibleSummary { id: string; source: 'hashpass_moment' | 'legacy_poap'; eventName: string; artworkUri?: string; verificationStatus: string; onchainStatus?: string; claimState?: MomentClaimState; publicVerificationUrl?: string; }
export interface MomentEligibilityResponse { eligible: boolean; state: MomentClaimState; eventId: string; collectionId?: string; reason?: string; }
export interface MomentClaimResponse { state: MomentClaimState; moment?: CollectibleSummary; duplicate: boolean; }
export interface MomentVerificationResponse { valid: boolean; type?: 'proof_of_attendance'; issuer?: string; event?: { id: string; name: string }; holder?: { subject: string }; proofDigest?: string; verifiedAt?: string; }
export interface WalletLinkChallengeRequest { address: string; chainFamily: 'EVM' | 'Algorand'; }
export interface WalletLinkRequest extends WalletLinkChallengeRequest { message: string; signature: string; nonce: string; }
