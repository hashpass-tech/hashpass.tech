export interface POAPSource { listByOwner(address: string): Promise<unknown[]>; verifyOwner(chainId: number, contractAddress: string, tokenId: string, owner: string): Promise<boolean>; }
