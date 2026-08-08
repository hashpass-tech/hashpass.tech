export interface MetadataCache { get(uri: string): Promise<unknown | null>; put(uri: string, value: unknown): Promise<void>; }
