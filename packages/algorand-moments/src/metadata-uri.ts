export function assertStableMetadataUri(uri: string): string { if (!/^(ipfs|ar|https):\/\//.test(uri)) throw new Error('metadata URI must be durable'); return uri; }
