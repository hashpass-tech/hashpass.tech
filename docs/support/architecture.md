# HashPass Support Architecture and Gap Report

_Last audited: 2026-08-05. Baseline: `origin/develop` at `d7788113` (`chore: release v1.8.326`)._

## What already exists

- `@hashpass/sdk` is the canonical framework-neutral customer contract with `HashpassClient`, `SupportClient`, auth/session plumbing, idempotency headers, retry behavior, and cursor polling.
- `@hashpass/sdk-cli` already exposes the backward-compatible `support create|list|show|reply|handoff|resolve` commands.
- `packages/backend` is a provider abstraction over Supabase/Directus, not a deployed HTTP route implementation for support tickets.
- Database migrations live in `db/migrations` and use opaque UUID-oriented relational patterns with RLS.
- Mobile has Expo SecureStore available and existing docs for event-scoped API and persistent chat patterns.
- Infrastructure targets include Directus/GCP, static web hosting, and API Gateway/Lambda Terraform modules, but no support-specific API stack yet.

## Current architectural differences from the product specification

- The reserved `/v1/support/*` routes are SDK contracts only in this checkout; no matching backend HTTP handlers were found.
- There is no support persistence schema, durable outbox, Kapso webhook endpoint, AI draft table/state machine, approval token lifecycle, or admin support API yet.
- No standalone support widget, React wrapper, React Native support UI package, or server-only Kapso package existed before this branch.
- The repository currently has no remote configured in the initial worktree; `origin` was added to fetch `develop`.
- The requested end-to-end public MVP is larger than a single safe changeset; this branch establishes contracts and secure adapter/widget foundations without deploying or sending WhatsApp messages.

## Reuse plan

- Keep all customer clients on `@hashpass/sdk`; widgets and native adapters must not create ad hoc ticket fetchers.
- Extend `SupportClient` for sessions, widget config, messages, events, read cursors, visitor identity, and reopening while preserving existing methods.
- Use the existing migration style for support tables in the next backend phase.
- Use a server-only Kapso package for HMAC verification, idempotency extraction, payload redaction, and 24-hour-window routing before wiring route handlers.

## Backend implementation plan

1. Add relational support tables and RLS policies for applications, visitors, sessions, tickets, messages, drafts, admins, approval actions, webhooks, outbox, and audit events.
2. Implement `/v1/support/*` route handlers following the API deployment convention chosen by the existing infra stack.
3. Enforce tenant isolation from app ID + scoped session/authenticated user claims.
4. Create an outbox worker so ticket creation never synchronously depends on Kapso availability.
5. Add Kapso webhook handler with raw body preservation, HMAC verification, idempotency persistence, and async processing.
6. Add provider-neutral AI drafting with an approval-only transition that is the only path to customer-visible agent messages.

## Kapso documentation verification

Kapso docs checked on 2026-08-05 state that webhooks use HMAC-SHA256 in `X-Webhook-Signature`, use `X-Idempotency-Key` for deduplication, and the TypeScript SDK can target `https://api.kapso.ai/meta/whatsapp`.
