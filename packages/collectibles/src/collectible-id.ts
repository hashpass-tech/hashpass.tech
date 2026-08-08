export function normalizeAddress(address: string): string { return address.trim().toLowerCase(); }
export function poapSourceIdentifier(chainId: number, contractAddress: string, tokenId: string | number): string { return `poap:${chainId}:${normalizeAddress(contractAddress)}:${String(tokenId)}`; }
export function hashpassAlgorandSourceIdentifier(appId: string | number, tokenId: string | number): string { return `hashpass:algorand:${String(appId)}:${String(tokenId)}`; }
