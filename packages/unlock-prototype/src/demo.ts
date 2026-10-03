import { buildUnlockCheckoutUrl, checkUnlockMembership } from './index.js';

const [rpcUrl, lockAddress, memberAddress, networkValue = '8453', redirectUri = 'http://localhost:8081/dashboard/wallet'] = process.argv.slice(2);

if (!lockAddress) {
  console.log('Checkout-only example (replace the lock before sharing):');
  console.log(buildUnlockCheckoutUrl(
    { address: '0x0000000000000000000000000000000000000001', network: Number(networkValue), name: 'HASHPASS event access' },
    redirectUri,
  ));
  console.log('\nLive check: pnpm demo <HTTPS_RPC_URL> <LOCK_ADDRESS> <MEMBER_ADDRESS> [CHAIN_ID] [REDIRECT_URI]');
} else if (!rpcUrl || !memberAddress) {
  throw new Error('rpcUrl, lockAddress, and memberAddress are required together');
} else {
  const lock = { address: lockAddress, network: Number(networkValue), name: 'HASHPASS event access' };
  console.log(JSON.stringify({ checkoutUrl: buildUnlockCheckoutUrl(lock, redirectUri), membership: await checkUnlockMembership({ rpcUrl, lock, memberAddress }) }, null, 2));
}
