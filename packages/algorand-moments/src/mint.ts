import { assertStableMetadataUri } from './metadata-uri.js';
export interface MintRecord { tokenId:string; transactionId:string; ownerAddress:string; metadataUri:string; }
export function prepareMint(input: { tokenId:string; ownerAddress:string; metadataUri:string; existingTransactionId?: string | null }): MintRecord { if (input.existingTransactionId) throw new Error('duplicate mint prevented'); return { tokenId: input.tokenId, ownerAddress: input.ownerAddress, metadataUri: assertStableMetadataUri(input.metadataUri), transactionId: `pending:${input.tokenId}` }; }
