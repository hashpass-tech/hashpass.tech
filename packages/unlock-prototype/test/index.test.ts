import assert from 'node:assert/strict';
import test from 'node:test';
import { Interface } from 'ethers';
import { buildUnlockCheckoutUrl, checkUnlockMembership } from '../src/index.js';

const lock = { address: '0x0000000000000000000000000000000000000001', network: 8453, name: 'Conference pass' };
const memberAddress = '0x0000000000000000000000000000000000000002';

test('builds an encoded, pessimistic hosted checkout', () => {
  const url = new URL(buildUnlockCheckoutUrl(lock, 'https://hashpass.tech/dashboard/wallet?event=demo'));
  assert.equal(url.origin + url.pathname, 'https://app.unlock-protocol.com/checkout');
  assert.equal(url.searchParams.get('redirectUri'), 'https://hashpass.tech/dashboard/wallet?event=demo');
  assert.deepEqual(JSON.parse(url.searchParams.get('paywallConfig')!), {
    pessimistic: true,
    skipSelect: true,
    locks: { [lock.address]: { network: 8453, name: 'Conference pass' } },
  });
});

test('rejects unsafe or malformed checkout input', () => {
  assert.throws(() => buildUnlockCheckoutUrl({ ...lock, address: 'nope' }, 'https://hashpass.tech'), /EVM address/);
  assert.throws(() => buildUnlockCheckoutUrl({ ...lock, network: 0 }, 'https://hashpass.tech'), /chain id/);
  assert.throws(() => buildUnlockCheckoutUrl(lock, 'javascript:alert(1)'), /http or https/);
});

test('checks a valid key with a read-only JSON-RPC call', async () => {
  const abi = new Interface(['function getHasValidKey(address) view returns (bool)']);
  let requestBody: any;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ jsonrpc: '2.0', id: 1, result: abi.encodeFunctionResult('getHasValidKey', [true]) });
  };
  const result = await checkUnlockMembership({ rpcUrl: 'https://rpc.example', lock, memberAddress, fetchImpl });
  assert.equal(result.valid, true);
  assert.equal(result.network, 8453);
  assert.equal(requestBody.method, 'eth_call');
  assert.deepEqual(requestBody.params[0].to, lock.address);
  assert.deepEqual(abi.decodeFunctionData('getHasValidKey', requestBody.params[0].data)[0], memberAddress);
});

test('fails closed on transport, contract, and insecure endpoint errors', async () => {
  await assert.rejects(checkUnlockMembership({ rpcUrl: 'http://rpc.example', lock, memberAddress }), /must use https/);
  await assert.rejects(checkUnlockMembership({ rpcUrl: 'https://rpc.example', lock, memberAddress, fetchImpl: async () => Response.json({ error: { message: 'reverted' } }) }), /reverted/);
  await assert.rejects(checkUnlockMembership({ rpcUrl: 'https://rpc.example', lock, memberAddress, fetchImpl: async () => Response.json({ result: '0x01' }) }), /invalid_response/);
});
