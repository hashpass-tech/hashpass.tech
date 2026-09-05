# Task: Bitcoin Medellín 2027 — Bull Bitcoin Wallet compatibility and community experience

**Priority:** Near-term proposal / partner discovery
**Status:** Pending — research and organizer/partner validation required before implementation
**Target event:** `btcmedellin2027` (`btcmedellin.hashpass.tech`)
**Owners to confirm:** HashPass product/security, Bitcoin Medellín organizer, Bull Bitcoin Wallet technical contact

## Why this is a pending task

The event demo can provide passes, agenda, check-in and networking today, but HashPass is **not currently integrated with Bull Bitcoin Wallet**. The proposal must not imply an approved partnership, working payment rail, or wallet compatibility before both teams validate the exact interface.

Bull Bitcoin publicly describes its wallet as Bitcoin-only, open source and self-custodial, while its exchange emphasizes bring-your-own-wallet and Lightning compatibility. HashPass should complement that model rather than become a custodian or collect seed phrases.

## Goal

Make HashPass a safe event companion that interoperates with Bull Bitcoin Wallet for Bitcoin Medellín while preserving clear product boundaries:

- **HashPass owns:** event identity, ticket/pass entitlement, agenda, notifications, networking consent, check-in and proof of attendance.
- **Bull Bitcoin Wallet owns:** Bitcoin keys, addresses, balances, signing and Bitcoin/Lightning payment approval.
- **Neither app silently links identities:** connecting a wallet must be optional, purpose-specific, revocable and separated from public attendee profiles.
- **No custody in HashPass:** never import, generate, transmit, log or back up seed phrases/private keys; never represent an event pass as bitcoin.

## Discovery gates — do these before coding

- [ ] Obtain written confirmation from Bull Bitcoin of the supported mobile interfaces and canonical URI formats for the current wallet release.
- [ ] Confirm whether standard `bitcoin:` BIP21, unified on-chain/Lightning QR, Lightning invoices, LNURL, Liquid, PSBT and/or app-specific deep links are supported; do not infer support from marketing copy.
- [ ] Confirm Android/iOS package IDs, universal/app links, return/callback behavior and safe fallback URLs directly with Bull Bitcoin.
- [ ] Ask whether Bull Bitcoin offers a documented partner API or SDK. Do not automate exchange account creation, KYC, trades or withdrawals without an explicit supported API and agreement.
- [ ] Agree on naming/logo usage and whether “Works with Bull Bitcoin Wallet” may appear publicly. Until approved, UI copy must say **“compatibility proposal”**.
- [ ] Threat-model QR replacement, invoice substitution, replay, amount/network mismatch, malicious deep links, callback spoofing and accidental wallet-address disclosure.
- [ ] Confirm the event jurisdiction, merchant settlement model, refund policy and accounting owner before enabling real payments.

## Proposed technical scope

### Phase 1 — open-wallet interoperability (recommended MVP)

1. Add a generic `BitcoinWalletAdapter` interface; do not hard-code event UI directly to one wallet.
2. Parse and validate standard Bitcoin payment requests locally:
   - explicit network (`mainnet` only for production; test networks in development),
   - destination/invoice,
   - amount in sats,
   - human-readable purpose,
   - expiry where applicable.
3. Display a confirmation sheet in HashPass before handing off to an external wallet.
4. Open Bull Bitcoin Wallet only through a partner-confirmed universal/deep link; provide QR and copy fallback without claiming payment success.
5. Treat return-to-app as **intent completion, not settlement**. Verify payment independently through the organizer's payment processor or node before issuing/upgrading a pass.
6. Feature-flag the adapter by event and environment. Default off globally.

### Phase 2 — privacy-preserving wallet proof (optional)

- Support a challenge-signing flow only if Bull Bitcoin confirms a suitable standard.
- Use a short-lived, domain-bound, nonce-based challenge with expiry and replay protection.
- Store the minimum verifier/public-key material needed; never make it a public profile field by default.
- Wallet proof must not be required for a normal ticket, agenda or check-in journey.
- Provide disconnect/delete controls and document retention.

### Phase 3 — verified payment experiences (optional)

- Bitcoin/Lightning ticket checkout with server-side settlement confirmation.
- Merchant vouchers or sats-denominated food/merch offers with signed, single-use claims.
- Refunds initiated by the organizer through the payment provider—not by replaying wallet callbacks.
- Reconciliation dashboard containing order/payment state and pseudonymous payment references, not private wallet data.

## Bitcoin Medellín experience concepts

These are proposal modules for organizer selection, not announced agenda items:

1. **Sovereignty onboarding lane** — guided wallet install/backup education; attendees complete a safety checklist without exposing their seed.
2. **Wallet interoperability lab** — scan a testnet/regtest request, inspect amount/network/expiry, hand off to a wallet and learn why callback ≠ settlement.
3. **Lightning merchant trail** — participating Plaza Mayor vendors, small purchases, live merchant map and opt-in badges after independently verified payments.
4. **Proof-of-attendance passport** — a non-transferable HashPass event credential, clearly separate from a Bitcoin wallet or financial asset.
5. **Proof-of-work check-in** — fast rotating signed QR credentials, offline-capable scanner queue and duplicate-entry protection; no on-chain transaction required.
6. **Builder pavilion passport** — opt-in QR stamps for visiting open-source projects, with rewards that are event perks rather than speculative tokens.
7. **Privacy-first networking** — pseudonymous display name, Nostr contact sharing as an optional proposal, per-connection consent and one-tap revoke.
8. **Mining telemetry wall** — educational hashrate/energy dashboard using public or organizer-approved data; never imply pool earnings.
9. **Bitcoin-only agenda mode** — tracks for self-custody, Lightning commerce, mining, open source, privacy, circular economies and Spanish-first newcomer education.
10. **Emergency wallet clinic** — scheduled education/support triage with strict rules: staff never see or handle seed words and never take device custody.
11. **Community pulse** — opt-in session questions, polls and moderated Q&A without tying wallet addresses to responses.
12. **Post-event continuity** — recordings/resources, local meetup calendar and revocable attendee connections in the HashPass pass wallet.

## Security and privacy requirements

- [ ] No seed phrase/private key input anywhere in HashPass, including support forms, analytics, logs and crash reports.
- [ ] Reject unknown URI parameters, non-HTTPS callbacks and unexpected Bitcoin networks.
- [ ] Show destination, network, exact sats and expiry before external-wallet handoff.
- [ ] Never infer payment success from app focus, deep-link callback, screenshot or client-side state.
- [ ] Verify settlement server-side and make pass issuance idempotent.
- [ ] Keep event entitlement identifiers separate from transaction IDs and wallet addresses.
- [ ] Redact payment requests and addresses from telemetry by default.
- [ ] Add abuse/rate limits, invoice expiry, replay protection and an auditable organizer refund/reconciliation flow.
- [ ] Complete mobile deep-link security review, dependency review and privacy-policy update before production enablement.

## Acceptance criteria

- [ ] Bull Bitcoin confirms the integration contract and public compatibility wording in writing.
- [ ] A feature-flagged adapter works on supported Android and iOS versions, with QR/copy fallback.
- [ ] Mainnet/testnet mismatch, malformed URI, expired invoice, callback spoof and replay tests pass.
- [ ] No secret material or full payment request appears in logs, analytics or support payloads.
- [ ] Pass issuance happens only after trusted server-side settlement and is idempotent.
- [ ] Attendees can use every non-payment event feature without connecting a Bitcoin wallet.
- [ ] Accessibility, Spanish copy, low-connectivity and offline check-in paths are tested at event scale.
- [ ] Organizer runbook covers support boundaries, incident response, refunds and vendor onboarding.
- [ ] Public demo retains “proposal” labeling until organizer and Bull Bitcoin approvals are complete.

## Suggested validation matrix

| Area | Minimum checks |
|---|---|
| URI parsing | valid/invalid BIP21, encoded labels, duplicate params, huge amounts, wrong network |
| Wallet handoff | installed/not installed, cancelled, backgrounded, forged callback, no callback |
| Settlement | pending, paid, under/overpaid, expired, duplicate notification, reorg policy |
| Pass issuance | one payment → one entitlement; retries do not duplicate passes |
| Privacy | analytics/log snapshots contain no address, invoice, seed or payment memo |
| Event operations | offline scanner, queue recovery, duplicate entry, revoked/refunded pass |
| UX | Spanish/English, screen reader, large text, low-end Android, weak venue network |

## Source notes checked 2026-09-03

- Existing event reference: <https://btcmedellin.com/> — the current published edition describes a Bitcoin-only event at Plaza Mayor with content, builders/mining, community, tickets, speakers, closing party, venue and lodging sections.
- Bull Bitcoin: <https://www.bullbitcoin.com/> — describes bring-your-own-wallet, non-custodial exchange behavior and Lightning compatibility.
- Bull Bitcoin Wallet: <https://wallet.bullbitcoin.com/> — describes the wallet as self-custodial, open source and Bitcoin-only.

These are discovery inputs, not proof of an integration contract. Revalidate before implementation because wallet capabilities and interfaces can change.
