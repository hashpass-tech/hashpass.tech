# HashPass Links & Dynamic QR

HashPass Links is a shared domain service exposed through `/api/v1`. HashPass Club is its first UI; mobile clients should use `@hashpass/sdk` rather than reimplement URL, visual-safety, analytics, or challenge rules.

## Local development

1. Apply `db/migrations/V079__hashpass_links_dynamic_qr.sql` with `npm run db:migrate`.
2. Set the variables below and run `pnpm --filter hashpass-links-service dev` for the API and `pnpm dev:club` for the static Club UI.
3. Open `/links`. The Club UI calls the separately deployed Links service; it contains no server route handlers and remains compatible with GitHub Pages.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing HashPass Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database/auth access; never expose to a browser. |
| `HASHPASS_LINK_ORIGIN` | Public origin, normally `https://hashpass.link`. |
| `QR_ANALYTICS_SECRET` | At least 32 random characters; rotate on a planned monthly boundary. |
| `NEXT_PUBLIC_HASHPASS_LINKS_API_URL` | Public Links service API origin used by the static Club client. |

## Routing and deployment

Deploy `apps/links-service` to a server-capable Next.js host, point `hashpass.link` and `links-api.hashpass.tech` at that service, and configure `/q/*`, `/auth/*`, and `/api/health/links`. HashPass Club remains a static export consumed by the existing GitHub Pages workflow. Redirects are deliberately `302`, `no-store` error responses are branded, and only the opaque `hashpass.link/q/:slug` URL is encoded. Configure platform/WAF rate limiting for `/q/*` (recommended baseline: 120 requests/minute/IP with bot challenges above that threshold), structured log shipping, TLS, CORS restricted to HashPass clients, and universal/app-link association files before production traffic.

Analytics stores a monthly rotating HMAC identifier, not a raw IP. Country/city values are accepted only from trusted deployment-edge headers. Retention and deletion jobs should remove detailed scan rows according to the published privacy policy while retaining aggregate reports.

## QR authentication

The browser creates a three-minute challenge using a PKCE SHA-256 challenge and receives an HttpOnly browser-binding cookie. The QR contains only `/auth/:id`. An authenticated mobile session explicitly approves or denies; the bound browser polls with `state`, receives a one-time code, and exchanges it with its verifier. The atomic `approved -> consumed` update prevents replay. The exchange endpoint currently returns the verified user identity marker; deployment integration must replace `sessionExchange` with the existing HashPass Club server-side session issuance before enabling the sign-in button.

## Native integration

The typed `QrLinksClient` and resource contracts in `@hashpass/sdk` are stable client boundaries for create/manage/analytics. A future native UI can add the authenticated challenge approval screen and universal-link association without moving business rules out of `@hashpass/backend`.

## Operations

Monitor `/api/health/links`, redirect latency, rejected destinations, scan capture failures, auth expiry/replay events, and audit writes. Service-role credentials must remain server-side. This first migration supports owner permissions; organization membership/roles should be introduced using the existing tenant model before team sharing is exposed.
