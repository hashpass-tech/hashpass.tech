# Unlock Protocol evaluation and HASHPASS prototype

**Research date:** 2026-09-30. This is a technical/product recommendation, not
legal, tax, or investment advice. Reconfirm vendor terms, network support, fees,
and grant availability before procurement or a production launch.

## Executive recommendation

Use Unlock for a **time-boxed, reversible pilot**, rather than rebuilding a
membership protocol or replacing HASHPASS's canonical pass system today.

The best boundary is:

1. HASHPASS remains the system of record for users, events, entitlements,
   check-in status, refunds, analytics, and support.
2. One Unlock `PublicLock` represents one pilot event or membership tier.
3. Unlock's hosted Checkout handles wallet/card-facing acquisition.
4. A HASHPASS server verifies `getHasValidKey(address)` directly against the
   configured lock and RPC, then maps the result to a revocable HASHPASS
   entitlement. The browser is never the authorization authority.
5. Existing HASHPASS QR rotation and check-in remain unchanged. Do not expose a
   wallet address or static NFT as an admission credential.

This buys mature contracts, expirations, renewals, transfers, hooks, a checkout,
and multi-network tooling while keeping vendor and chain risk outside the core
admission path. Build from scratch only if the pilot proves that Unlock cannot
meet a documented hard requirement (for example a non-EVM chain, unusual
transfer/refund semantics, or a regulatory/custody constraint).

## What Unlock is

Unlock is an EVM membership protocol. Its factory deploys `PublicLock`
contracts; each lock is an independently deployed ERC-721 contract whose
time-bound “keys” represent memberships. A lock manager can set price,
duration, supply, roles, transfer behavior, and optional hooks. Unlock also
provides a hosted checkout, dashboard, JavaScript tooling, metadata/indexing
services, and governance/community infrastructure.

Important distinctions:

- **The protocol is not an event-management backend.** It does not replace
  HASHPASS event data, attendee records, dynamic check-in credentials, fraud
  review, refunds, support, or analytics.
- **Ownership is not always validity.** Use `getHasValidKey`, not a generic NFT
  `ownerOf` check. Expiry and configured hooks affect validity.
- **The chain is public.** Never put attendee names, emails, secrets, QR payloads,
  or private event metadata on-chain. Treat wallet addresses as personal data.
- **Checkout convenience is not trust.** Redirect parameters and client events
  improve UX but must not grant access. The server must independently verify.

Primary references: [Unlock repository](https://github.com/unlock-protocol/unlock),
[PublicLock documentation](https://docs.unlock-protocol.com/core-protocol/public-lock/),
[Checkout configuration](https://docs.unlock-protocol.com/tools/checkout/configuration/),
and [supported networks](https://docs.unlock-protocol.com/core-protocol/unlock/networks/).

## Is it open source, and can HASHPASS use it commercially?

The main `unlock-protocol/unlock` repository declares the **MIT License** and
states that it includes the deployed contracts and web application. The MIT
grant expressly permits using, copying, modifying, distributing,
sublicensing, and selling the software, including commercial use, provided the
copyright and permission notice is retained in copies or substantial portions.
It is provided without warranty. See the repository's current
[LICENSE](https://github.com/unlock-protocol/unlock/blob/master/LICENSE) and
[README](https://github.com/unlock-protocol/unlock#readme).

That means commercial reuse is generally allowed; it does **not** mean
“anything associated with Unlock is free to exploit.” Before copying code:

- run a dependency/license and source-file-header audit because dependencies,
  media, fonts, brands, hosted APIs, and third-party services can have different
  terms;
- preserve MIT notices and add attribution to HASHPASS's `NOTICE` distribution;
- do not imply affiliation or reuse Unlock names/logos without trademark review;
- review hosted-service terms separately from source-code rights;
- obtain counsel for consumer sales, refunds, taxes, privacy, sanctions,
  securities, and NFT rules in launch jurisdictions;
- keep a software bill of materials and pin audited contract versions.

The recommended prototype below **uses the public contract interface and hosted
checkout; it copies no Unlock source code**. This sharply reduces maintenance
and attribution complexity.

## Proposed user and system flow

### Purchase / claim

1. Organizer creates a lock on a low-fee supported EVM network and records the
   chain ID, checksummed lock address, contract version, manager multisig, tier,
   and event ID in a reviewed server-side registry.
2. HASHPASS creates a Checkout URL with `pessimistic: true`, a single known lock,
   and a HASHPASS HTTPS return URL.
3. Attendee checks out. Card availability, currencies, fees, and geography must
   be validated with Unlock for the chosen network; do not promise them solely
   because Checkout renders.
4. On return, HASHPASS authenticates its own user, takes the enrolled public EVM
   address (never a client-supplied user mapping), and performs `eth_call` to
   `getHasValidKey` through its server-side RPC.
5. When confirmed, HASHPASS stores an idempotent external-entitlement record:
   `provider`, `chain_id`, `lock_address`, `wallet_address`, observed block,
   validity, and timestamps. It issues the normal HASHPASS pass/check-in QR.

### Entry

1. Staff scan the normal rotating HASHPASS QR.
2. HASHPASS validates its signed, expiring credential and current pass state.
3. Chain refresh happens asynchronously or before the event; the door does not
   depend on a public RPC round trip. Define an outage/cache policy in advance.
4. Revocation, transfer, expiry, refund, and reorg reconciliation update the
   mapped entitlement. Every transition is auditable and idempotent.

### Security and operations gates

- manager rights in a multisig; hardware-backed signers; least-privilege roles;
- allowlisted chain IDs and lock addresses only—never accept arbitrary contracts;
- two independent RPC providers for production, finalized-block policy, bounded
  timeouts, rate limiting, and circuit-breaker metrics;
- webhook/event ingestion as an accelerator only; periodic direct-chain
  reconciliation is authoritative;
- signed checkout state/nonce tied to user and event to prevent confused-deputy
  account linking;
- explicit transfer/refund policy and customer-support runbook;
- accessibility and a wallet-optional/card path; never make Web3 knowledge a
  condition of attending;
- contract/version audit review and a testnet load/failure exercise before money.

## Working prototype

`packages/unlock-prototype` implements two useful seams:

- `buildUnlockCheckoutUrl()` creates a URL-encoded, single-lock hosted Checkout
  with mined-transaction waiting enabled.
- `checkUnlockMembership()` validates addresses and chain ID, enforces HTTPS RPC
  (except localhost), makes a bounded read-only `eth_call`, decodes
  `getHasValidKey`, and fails closed on malformed responses.

Run the deterministic checkout example:

```bash
pnpm --filter @hashpass/unlock-prototype demo
```

Run a real read against a lock (do not commit an RPC key):

```bash
pnpm --filter @hashpass/unlock-prototype demo \
  'https://YOUR_PRIVATE_RPC_ENDPOINT' \
  '0xLOCK_ADDRESS' \
  '0xMEMBER_ADDRESS' \
  8453 \
  'https://hashpass.tech/dashboard/wallet'
```

This proves URL generation and direct membership reads. It deliberately does
not deploy a contract, move funds, retain attendee data, or claim a production
wallet integration. Production work still needs the authenticated account
binding, registry/database, reconciliation worker, admin UI, observability,
privacy review, and on-chain test deployment described above.

## Market comparison

“Best” depends on the problem. This shortlist compares current product shapes;
commercial terms and capabilities must be reconfirmed in a vendor evaluation.

| Option | Strongest fit | Advantages | Trade-offs for HASHPASS |
| --- | --- | --- | --- |
| **Unlock Protocol** | Open, programmable EVM memberships and event keys | MIT monorepo; deployed membership contracts; expirations, renewals and hooks; hosted checkout; direct on-chain verification; low lock-in at the contract layer | EVM-only architecture; public wallet graph; chain/RPC/support complexity; hosted layers can still be dependencies; HASHPASS must retain real check-in and support controls |
| **OPEN / GET Protocol ecosystem** | Web3-native ticket lifecycle and ticketing infrastructure | Ticketing-specific positioning and ecosystem rather than a generic membership primitive | A larger product/platform commitment; verify APIs, licensing, geography, fees, custody, migration, and current self-hosting rights. Start at [onopen.xyz](https://onopen.xyz/) |
| **Crossmint** | Fast mainstream UX: embedded wallets, card payments, minting and APIs | Managed developer platform can hide blockchain complexity and shorten implementation | Proprietary vendor/API dependence and recurring commercial cost; less protocol sovereignty. Review [Crossmint documentation](https://docs.crossmint.com/) |
| **tokenproof** | Proving token ownership for physical/online experiences | Event-access focus and wallet-safety/user-experience emphasis | Primarily a managed access partner rather than an open membership contract stack; evaluate integration access, SLA, data terms, and pricing at [tokenproof.xyz](https://tokenproof.xyz/) |
| **Guild** | Community roles, allowlists, quests, and multi-platform token gating | Good composable community gating and many integrations | Not a complete paid-ticketing/check-in backend; managed dependencies remain. Review [Guild documentation](https://help.guild.xyz/) |
| **Build all contracts and Web3 from scratch** | A truly unique protocol requirement with funded security/operations ownership | Maximum control over semantics, chain choice, upgrade policy, and UX | Highest audit, incident, indexer, checkout, payments, compliance, upgrade, and long-term maintenance cost; duplicates solved primitives and increases key/funds risk |

### Decision

Unlock is the best **first experiment** among these options if HASHPASS wants
portable EVM memberships and source-level freedom. It is not automatically the
best complete ticketing vendor, and it should not replace the current pass
system. Crossmint is more attractive if the overriding goal is managed,
wallet-invisible onboarding; OPEN merits a dedicated evaluation if full ticket
lifecycle infrastructure is the goal; tokenproof/Guild fit narrower gating and
community use cases.

Do **not** build the entire contract and Web3 stack from scratch now. A thin
HASHPASS adapter around a standard protocol preserves the option to change
providers. Reconsider custom contracts only after a 4–6 week pilot documents
unmet requirements and projected volume justifies audits and 24/7 operations.

## Support and grants

Unlock publishes community and technical support routes and documents an Unlock
DAO grants process. Its grants material says integrations, applications,
education, and events that increase protocol usage/visibility may be eligible,
with an application/discussion, milestones, public delivery, and DAO governance
process. Funding is **possible, not promised**; an old handbook or an accepted
conversation is not an award. Start with the current
[grants overview](https://docs.unlock-protocol.com/governance/grants-bounties/),
[grantee handbook](https://docs.unlock-protocol.com/governance/grants-bounties/udt-grantee-handbook/),
[GitHub issues](https://github.com/unlock-protocol/unlock/issues), and
[Unlock community forum](https://unlock.community/).

A strong HASHPASS proposal should request a milestone-based pilot, not general
operating funds:

1. open-source adapter plus direct-chain verifier and documentation;
2. one testnet event and security/threat-model review;
3. one opt-in production event with wallet-optional checkout;
4. published metrics: successful claims, paid/comped tickets, checkout
   completion, support rate, reconciliation lag, and check-in success;
5. reusable upstream improvements and a public retrospective.

Ask Unlock before building for: a named technical contact, recommended current
PublicLock version/network, audit artifacts, card/on-ramp coverage, fee schedule,
rate limits/SLA for hosted services, webhook semantics, production references,
and whether grants are presently accepting applications and paid in tokens or
another denomination. Budget as if the grant is zero until a proposal formally
passes and funds are received.

## Pilot scorecard and exit criteria

Proceed only if the pilot achieves all of the following:

- at least 99.9% successful server membership reads outside injected outages;
- no duplicate entitlement or unauthorized check-in in retry/reorg/transfer tests;
- checkout completion and support burden are no worse than the current flow;
- RPC/vendor outage does not stop cached, valid door admission;
- organizer can reconcile sales/refunds and support a non-wallet user;
- legal/privacy review accepts the chain, data map, terms, and refund model;
- total projected provider, gas, RPC, audit, support, and engineering cost beats
  a managed alternative for the required capabilities.

Exit cleanly if these fail: disable new Unlock sales, retain the on-chain keys,
keep HASHPASS entitlements through their promised term, export reconciliation
records, and return checkout to the existing pass flow. The adapter boundary
makes this possible without migrating the rest of the platform.
