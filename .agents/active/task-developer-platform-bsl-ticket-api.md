# Task: Developer Platform + BSL ticket issuance API

**Priority:** P0 / High
**Status:** In progress — forensic report and public contract foundation drafted 2026-09-05; runtime and portal not yet production-ready.

## Mission

Deliver a secure, scalable and accessible developer platform so BSL can issue HashPass tickets from its in-house Wompi checkout without coupling either system to the other's internals.

## Foundation completed

- [x] Black-box review from public event page through BSL checkout to the Wompi payment-method screen; no payment attempted.
- [x] Spanish stakeholder report with architecture, risks, ownership model, rollout and acceptance criteria.
- [x] Bilingual Docusaurus developer quickstart and draft OpenAPI 3.1 contract.
- [x] Initial contract covers environment separation, scoped auth, idempotent issue/list/get/revoke, RFC 9457-style problems, cursor pagination and rate limiting.

## P0 — pilot blocker

- [ ] Review the contract with BSL and freeze `/v1` semantics.
- [ ] Implement organization/application/key tables; store only Argon2id/HMAC-derived hashes and show secrets once.
- [ ] Implement per-event scopes and tenant isolation with deny-by-default policy tests.
- [ ] Implement ticket issue/get/list/revoke against the existing audited event-admin mutation boundary.
- [ ] Verify Wompi approval server-to-server; never trust browser redirects or caller-supplied `status` alone.
- [ ] Add atomic idempotency storage and payload-fingerprint conflict detection.
- [ ] Add signed webhook delivery, replay protection, dead-letter queue and replay UI.
- [ ] Create BSL test tenant/app/key; run contract and concurrency tests before live credentials.
- [ ] Ask BSL to canonicalize Wompi return URL from the Vercel hostname to `bsl.blckchn.xyz`.

## P1 — developer/admin experience

- [ ] Build `developers.hashpass.tech`: apps, test/live keys, scopes, rotation/revocation, webhooks, request log and usage.
- [ ] Keep operational event management in the existing Club admin; share SSO, organization/event RBAC and audit log.
- [ ] Add metrics: request/error rate, p50/p95/p99, quota, idempotency conflicts, webhook health, payment-to-issue latency and reconciliation.
- [ ] Generate TypeScript SDK methods from the reviewed contract; add curl, JavaScript, Python and PHP examples.
- [ ] Publish English and Spanish guides, webhook verification and migration/runbooks; add WCAG 2.2 AA checks.

## P2 — industrialization

- [ ] OAuth2 client credentials, key IP allowlists, mTLS option for enterprise clients and automated secret rotation.
- [ ] SLOs, multi-region failure strategy, load/soak tests, chaos tests and incident playbooks.
- [ ] External security review, threat model, privacy retention/redaction controls and evidence package.
- [ ] Version/deprecation headers, changelog, SDK compatibility matrix and non-breaking contract CI.

## Exit criteria

The BSL pilot is complete only when sandbox and production are isolated, duplicate issuance is impossible under concurrent retries, key rotation has no downtime, all cross-tenant negative tests pass, webhook replay is rejected, payment-to-ticket reconciliation alerts work, and production use is explicitly approved after security review.
