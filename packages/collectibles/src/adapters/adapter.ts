export interface CollectibleSourceAdapter<T = unknown> { readonly source: string; normalize(input: T): unknown; }
