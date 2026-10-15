import { Interface, isAddress } from 'ethers';

const publicLock = new Interface([
  'function getHasValidKey(address user) view returns (bool)',
]);

export interface UnlockLock {
  address: string;
  network: number;
  name?: string;
}

export interface MembershipCheck {
  lockAddress: string;
  memberAddress: string;
  network: number;
  valid: boolean;
  checkedAt: string;
}

export type RpcFetch = typeof fetch;

function address(value: string, field: string): string {
  if (!isAddress(value)) throw new TypeError(`${field} must be an EVM address`);
  return value;
}

function chainId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('network must be a positive integer chain id');
  }
  return value;
}

/**
 * Produces a hosted Unlock checkout URL without importing Unlock's web app.
 * The pessimistic flag prevents redirecting before the purchase is mined.
 */
export function buildUnlockCheckoutUrl(lock: UnlockLock, redirectUri: string): string {
  const lockAddress = address(lock.address, 'lock address');
  const network = chainId(lock.network);
  const redirect = new URL(redirectUri);
  if (!['https:', 'http:'].includes(redirect.protocol)) {
    throw new TypeError('redirectUri must use http or https');
  }

  const paywallConfig = {
    pessimistic: true,
    skipSelect: true,
    locks: {
      [lockAddress]: {
        network,
        ...(lock.name ? { name: lock.name } : {}),
      },
    },
  };
  const checkout = new URL('https://app.unlock-protocol.com/checkout');
  checkout.searchParams.set('redirectUri', redirect.toString());
  checkout.searchParams.set('paywallConfig', JSON.stringify(paywallConfig));
  return checkout.toString();
}

/**
 * Reads membership validity directly from a PublicLock over JSON-RPC.
 * Run this on a trusted server: browsers must not be the authority for entry.
 */
export async function checkUnlockMembership(input: {
  rpcUrl: string;
  lock: UnlockLock;
  memberAddress: string;
  fetchImpl?: RpcFetch;
}): Promise<MembershipCheck> {
  const rpc = new URL(input.rpcUrl);
  if (rpc.protocol !== 'https:' && rpc.hostname !== 'localhost' && rpc.hostname !== '127.0.0.1') {
    throw new TypeError('rpcUrl must use https (except local development)');
  }
  const lockAddress = address(input.lock.address, 'lock address');
  const memberAddress = address(input.memberAddress, 'member address');
  const network = chainId(input.lock.network);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: lockAddress, data: publicLock.encodeFunctionData('getHasValidKey', [memberAddress]) }, 'latest'],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`unlock_rpc_http_${response.status}`);
  const payload = await response.json() as { result?: unknown; error?: { message?: string } };
  if (payload.error) throw new Error(`unlock_rpc_error: ${payload.error.message ?? 'unknown error'}`);
  if (typeof payload.result !== 'string') throw new Error('unlock_rpc_invalid_response');
  let valid: boolean;
  try {
    [valid] = publicLock.decodeFunctionResult('getHasValidKey', payload.result) as unknown as [boolean];
  } catch {
    throw new Error('unlock_rpc_invalid_response');
  }
  return { lockAddress, memberAddress, network, valid, checkedAt: new Date().toISOString() };
}
