export const ARC72_STANDARD = 'ARC-72' as const;
export interface ARC72Token { appId: string; tokenId: string; owner: string; metadataUri: string; }
export function assertArc72Config(config: { network: string; appId?: string }) { if (config.network === 'mainnet') throw new Error('Mainnet deployment requires explicit release approval'); if (!config.appId) throw new Error('ALGORAND_MOMENTS_APP_ID is required'); }
