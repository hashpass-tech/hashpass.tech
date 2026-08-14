export interface POAPNetworkConfig { chainId: 1 | 100; name: string; rpcUrl?: string; poapContract: string; explorerBaseUrl: string; enabled: boolean; }
export const POAP_NETWORKS: POAPNetworkConfig[] = [
 { chainId:1, name:'Ethereum Mainnet', poapContract:'0x22c1f6050e56d2876009903609a2cc3fef83b415', explorerBaseUrl:'https://etherscan.io/token', enabled:true },
 { chainId:100, name:'Gnosis Chain', poapContract:'0x22c1f6050e56d2876009903609a2cc3fef83b415', explorerBaseUrl:'https://gnosisscan.io/token', enabled:true },
];
export function poapConfigFromEnv(env: Record<string,string|undefined> = process.env): POAPNetworkConfig[] { return POAP_NETWORKS.map(n => ({ ...n, rpcUrl: n.chainId === 1 ? env.POAP_ETHEREUM_RPC_URL : env.POAP_GNOSIS_RPC_URL, enabled: env.POAP_API_ENABLED !== 'false' && n.enabled })); }
