# HashPass Moments foundation

## Phase 1 discovery report

- Codebase Memory MCP was unavailable in this container (`codebase-memory-mcp: command not found`), so discovery used direct file reads and `find`/targeted inspection after the failure.
- Git remotes are not configured in this checkout, so latest `main` and `develop` could not be fetched here. The working branch was created from the current local commit.
- Monorepo structure is pnpm workspaces with `apps/*` and `packages/*`. The Expo Router API and web/mobile UI live in `apps/mobile-app`; shared SDK code lives in `packages/sdk`; event catalog data lives in `packages/config`.
- Wallet integration point is `apps/mobile-app/app/(shared)/dashboard/wallet.tsx`, which previously had Tokens, Points, and Tickets tabs and now hosts the Moments section without replacing existing pass wallet components.
- Canonical BSL event IDs are configuration IDs in `packages/config/src/events.ts`: `chile2026` and `colombia2026`. Chile starts `2026-08-05T09:00:00-04:00`; Colombia is represented as the same tour-stop event system.
- Event-scoped API patterns use Expo Router API files under `apps/mobile-app/app/api`, with admin authorization through `authorizeEventAdmin` and identity resolution through `resolveNotificationIdentity`.
- Existing QR/admin and BSL ticket routes are under `apps/mobile-app/app/api/qr` and `apps/mobile-app/app/api/bsl/verify-ticket+api.ts`. The current `verify-ticket` route includes mock verification behavior, so Moments does not trust pass ownership alone and uses explicit `attendance_credentials` instead.
- Highest migration discovered was `V061__admin_pass_usage_editing.sql`; this change adds `V062__hashpass_moments_foundation.sql`.
- SDK extension pattern is an ESM TypeScript client using `HttpTransport`; this change adds `client.collectibles` while preserving existing `auth` and `support` clients.
- Current test commands include root `pnpm test`, `pnpm --filter @hashpass/sdk test`, package-local `pnpm --filter @hashpass/collectibles test`, and mobile Jest through `pnpm --dir apps/mobile-app test`.
- Deployment/release path is governed by `CLAUDE.md`; this feature does not change versions, tags, changelog, Mainnet contracts, or production deployment.

## Architecture

HashPass Moments uses dependency-injected core logic in `@hashpass/collectibles`, optional legacy POAP normalization in `@hashpass/poap-adapter`, and guarded Algorand Testnet issuance helpers in `@hashpass/algorand-moments`. The Expo API layer supplies authentication, event authorization, Supabase access, and feature flags.

The attendee receives an app-level HashPass credential immediately after a successful claim. On-chain state is separately labeled as `claimable_onchain`, `onchain_pending`, `minted_onchain`, or `transferred_to_user_wallet`; the UI must not call an app credential an NFT before transaction confirmation.

## Operating model

- Attendees pay nothing.
- Organizers/admins approve retroactive attendance through audited `attendance_credentials` records.
- Chile MVP uses `chile2026` and supports retroactive approvals without fabricating QR check-ins.
- Colombia uses the same tables and claim service and can attach live QR check-in writes to `attendance_credentials` when the authorized scanner flow is connected.
- POAPs are read, normalized, deduplicated, and displayed as legacy collectibles. They are never reminted automatically.
- x402 and Algorand minting are behind server-side flags.

## Feature flags

Server-side flags: `MOMENTS_ENABLED`, `MOMENTS_CLAIMS_ENABLED`, `MOMENTS_POAP_IMPORT_ENABLED`, `MOMENTS_ALGORAND_MINT_ENABLED`, `MOMENTS_X402_ENABLED`, `ALGORAND_NETWORK`, `ALGORAND_MOMENTS_APP_ID`, `ALGORAND_SPONSOR_ADDRESS`, `ALGORAND_INDEXER_URL`, `POAP_API_ENABLED`, `POAP_API_BASE_URL`, `POAP_GNOSIS_RPC_URL`, and `POAP_ETHEREUM_RPC_URL`.

## Risks and remaining work

- Production Supabase policies should be reviewed against existing RLS conventions before enabling flags.
- Algorand helpers are Testnet-safe foundations; no Mainnet deployment is included.
- The repo checkout lacks remotes, so upstream/main/develop freshness needs verification in the real GitHub checkout before merging.
- Browser screenshot QA was not run because the runnable app server was not started in this implementation pass.
