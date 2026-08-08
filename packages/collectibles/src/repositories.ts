import type { AttendanceCredential, ClaimRequest, CollectibleItem, Collection } from './types.js';
export interface CollectionRepository { findPublishedByEvent(eventId: string): Promise<Collection | null>; findById(collectionId: string): Promise<Collection | null>; }
export interface AttendanceRepository { listEligibleForUser(eventId: string, userId: string): Promise<AttendanceCredential[]>; }
export interface ClaimRepository { findByIdempotencyKey(key: string): Promise<CollectibleItem | null>; findMomentForUser(collectionId: string, userId: string): Promise<CollectibleItem | null>; createClaimedMoment(request: ClaimRequest, credential: AttendanceCredential, item: Omit<CollectibleItem, 'id' | 'createdAt'>): Promise<CollectibleItem>; }
export interface WalletLinkRepository { findVerified(userId: string, chainFamily: string): Promise<{ address: string; chainFamily: string } | null>; }
export interface OnchainMomentIssuer { mint(input: { item: CollectibleItem; ownerAddress: string; metadataUri: string }): Promise<{ tokenId: string; transactionId: string }>; }
export interface MomentMetadataStore { put(metadata: unknown): Promise<{ uri: string }>; }
export interface ProofVerifier { verify(proofId: string): Promise<CollectibleItem | null>; }
export interface SponsoredTransactionRepository { consumeCapacity(eventId: string, amount: number): Promise<void>; }
