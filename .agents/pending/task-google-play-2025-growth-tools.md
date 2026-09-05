# Task: Adopt the highest-value Google Play 2025 tools for HASHPASS

## Status

**Pending** — start with the verified Android App Links workstream. Treat the
localization and Engage SDK workstreams as gated follow-ups, not as reasons to
delay link reliability.

## Source reviewed

- Android Developers Blog, **“New tools and programs to accelerate your
  success on Google Play”** (October 2025):
  https://android-developers.googleblog.com/2025/10/new-tools-and-programs-to-accelerate.html
- Play Console Help, **“Verify and maintain deep links”**:
  https://support.google.com/googleplay/android-developer/answer/12463044?hl=en
- Google Play, **Engage SDK program page**:
  https://play.google.com/console/about/programs/EngageSDK/

The post announces six relevant capabilities: a Play Console deep-link
emulator, no-cost Gemini-powered app-string translation with preview/edit
controls, Gemini chart summaries, objective-based growth reporting, Engage
SDK content in the Play Store **You** tab, and expanded one-time-product/Play
Points tooling.

## Recommendation

### Highest benefit now: verified Android App Links + Play Console validation

This is the best first implementation for HASHPASS. The product's critical
journeys begin with links and QR codes—sign-in callbacks, magic links, event
passes, invitations, and web-to-app handoff—so a link that opens the browser,
the wrong screen, or no app has an outsized effect on activation and event-day
reliability. The new Play Console emulator makes these paths cheap to validate
against the actual Play artifact, but its value is greatest after HASHPASS
adds standard HTTPS Android App Links.

Current repo evidence:

- `apps/mobile-app/app.json` declares only the custom `hashpass` scheme; its
  Android config has no `intentFilters`/`autoVerify` HTTPS App Link mapping.
- `apps/web-app/app/components/SignInModal.tsx` explicitly says the web-to-app
  QR flow relies on `hashpass://` because `assetlinks.json`/universal links are
  not configured.
- `apps/docs/docs/auth/MAGIC_LINK_NATIVE_FLOW.md` documents special Android
  intent-URL handling needed because custom schemes can be blocked in Chrome
  Custom Tabs.
- Existing auth and local-debug tests already exercise `hashpass://` paths,
  providing a useful regression baseline while HTTPS links are introduced.

Expected benefit: fewer auth and QR handoff failures, safer release validation,
ordinary shareable HTTPS URLs that degrade gracefully when the app is absent,
and a foundation that the You tab or any future Play re-engagement surface can
deep-link into safely.

### Second: pilot Gemini localization without replacing repo-owned copy

HASHPASS already supports `en`, `es`, `ko`, `fr`, `pt`, and `de` through
Lingui and repo-owned runtime dictionaries. Free Play translation could make
new-market experiments faster, but automatically translating an uploaded app
bundle can create a second source of truth and can bypass terminology, legal,
and event-copy review. Use it only as a preview/proposal workflow for one new
locale, then import reviewed copy into the normal Lingui catalogs. Do not let
Play-only translations silently diverge from web, email, and OTA-delivered
mobile copy.

### Third: run an Engage SDK eligibility and data-model spike

The You tab is strategically aligned with HASHPASS: it could re-engage users
with an upcoming event, their next agenda session, a pending meeting, or a pass
that needs action. It may ultimately create more growth than link tooling, but
it is not the first task because access/eligibility must be confirmed, the
Expo/React Native integration needs investigation, personalized content has
privacy implications, and every card still needs a dependable destination.
Build it only after verified App Links exist and the product owner selects the
specific re-engagement objects.

### Observe only: chart summaries, growth overview, products, and Play Points

- Enable/use chart summaries and the Grow users overview operationally; they
  require no app implementation. Record decisions from the insights rather
  than copying Gemini summaries into product analytics as authoritative data.
- One-time products, rentals/pre-orders, and Play Points are low priority while
  HASHPASS has no approved Play Billing catalog/use case. Do not invent a
  monetization model merely to consume the feature.

## Workstream A — Verified Android App Links (P0)

1. Inventory canonical HTTPS destinations for authentication, passes, events,
   invitations, meetings, and web-to-app connection. For each, document the
   installed-app destination and browser fallback. Do not expose auth tokens or
   attendee/pass secrets in test artifacts.
2. Choose the production and development hosts deliberately. Start with
   `https://hashpass.tech`; do not associate every tenant/event hostname by
   wildcard. Confirm whether `dev.hashpass.tech` should open production,
   development, or never open an installed production build.
3. Add Expo Android `intentFilters` with `autoVerify: true` for the approved
   HTTPS host/path prefixes while retaining `hashpass://` compatibility for
   existing emails, QR codes, and OAuth callbacks during migration.
4. Serve `/.well-known/assetlinks.json` from each approved host with
   `com.hashpass.tech` and the **Google Play app-signing** SHA-256 certificate
   fingerprint. Do not use the local upload/debug signing key and do not commit
   private signing material.
5. Centralize URL-to-route parsing so custom-scheme URLs, HTTPS App Links, cold
   starts, and warm `Linking` events resolve through the same allowlisted path
   and parameter validation. Reject open redirects and unrecognized routes.
6. Add unit/integration coverage for every route class, malformed URLs,
   encoded parameters, cold start, warm start, logged-out continuation, and
   browser fallback.
7. Validate the uploaded internal-track artifact in Play Console's deep-link
   page and built-in emulator. Capture a sanitized result matrix (URL, Play
   artifact version, expected screen, actual screen, pass/fail) in repo docs.
8. Add a release check that validates the public association file and runs an
   Android link smoke test. Because `app.json` changes are native-sensitive,
   follow the native Android release path described in `CLAUDE.md`; do not
   assume an OTA update can ship this configuration.

### Acceptance criteria

- [ ] Approved `https://hashpass.tech/...` links open the correct screen from
      cold and warm states in a Play-installed Android build.
- [ ] The same URLs render a useful web fallback when the app is absent.
- [ ] `assetlinks.json` is publicly reachable with the correct content type,
      package name, and Play app-signing SHA-256 fingerprint.
- [ ] Existing supported `hashpass://` auth/magic-link/QR paths still work.
- [ ] Unknown paths, attacker-controlled return URLs, and malformed/expired
      credentials fail closed without leaking sensitive values.
- [ ] Play Console reports the selected domains and representative links as
      verified, and the built-in emulator matrix passes.
- [ ] Automated tests cover route mapping plus cold/warm link handling.
- [ ] The link inventory and sanitized Play Console validation procedure are
      documented for future releases.

## Workstream B — Gemini localization pilot (P1, gated)

1. Run `pnpm run i18n:check` and quantify missing/fallback English messages in
   the six supported locales before adding a seventh locale.
2. Pick one target locale using real Play acquisition/store-listing data, not
   intuition. Exclude legal/privacy/auth copy from automatic approval.
3. Generate a Play translation preview for an internal-track bundle and review
   key auth, pass, event, meeting, error, accessibility, truncation, plural,
   date, and RTL scenarios with a fluent reviewer.
4. Import approved translations into `i18n/locales/<locale>.json`, then use the
   documented extract/compile/check workflow so the repository remains the
   source of truth across Android, web, email, and OTA updates.
5. Compare activation/retention and support/error rates against a baseline
   before expanding to another locale.

### Acceptance criteria

- [ ] The selected locale and success metric are justified by Play data.
- [ ] No production language exists only in Play Console.
- [ ] Legal, privacy, security, and auth copy has human approval.
- [ ] `pnpm run i18n:extract`, `pnpm run i18n:compile`, and
      `pnpm run i18n:check` pass.
- [ ] Emulator/device QA covers representative small and large screens.

## Workstream C — Engage SDK spike (P2, gated by Workstream A)

1. Confirm current program eligibility/access in Play Console and obtain the
   current official Android integration contract before coding.
2. Determine whether an Expo config plugin/native module is required and make
   a minimal internal-track proof of concept. Do not add an unmaintained
   third-party bridge without a security and maintenance review.
3. Propose only these candidate content types, with product-owner selection:
   upcoming event, next saved agenda session, pending/accepted meeting, and
   pass requiring action. Define expiry, deduplication, ranking, empty-state,
   and deletion behavior for each.
4. Minimize data shared with Play. Do not publish QR payloads, pass secrets,
   private attendee data, meeting messages, or precise behavioral history.
5. Point every item at an allowlisted verified HTTPS App Link and define a
   logged-out continuation plus a useful browser fallback.
6. Instrument impressions/opens/destination completion with consent-aware,
   non-sensitive analytics. Compare 7/30-day re-engagement with a holdout; add
   a remote kill switch before production rollout.

### Acceptance criteria

- [ ] Eligibility and official SDK support requirements are documented.
- [ ] Privacy/security review approves the exact fields and retention model.
- [ ] Each item expires correctly and opens its verified destination in cold,
      warm, logged-in, and logged-out states.
- [ ] The integration has a kill switch and does not block app startup.
- [ ] A measured rollout demonstrates benefit before broad enablement.

## Likely files to touch when picked up

| File/area | Expected change |
|---|---|
| `apps/mobile-app/app.json` | Add narrowly scoped Android verified-link intent filters (native-sensitive change) |
| `apps/mobile-app/app/(shared)/auth/callback.tsx` and link-routing helpers | Unify/validate HTTPS and custom-scheme routing |
| `apps/mobile-app/hooks/useAuth.ts` | Preserve auth continuation for HTTPS cold/warm link entry |
| `apps/mobile-app/tests/` | Route, auth continuation, malformed-link, cold/warm-start coverage |
| Hashpass web/static routing or infrastructure | Serve `/.well-known/assetlinks.json` and useful HTTPS fallbacks |
| `apps/docs/docs/auth/` and `apps/docs/docs/reference/mobile-app/` | Link inventory, threat model, and Play Console emulator runbook |
| `apps/mobile-app/i18n/locales/` and `i18n/catalogs/` | Reviewed localization pilot output only |
| A reviewed native module/config plugin, if required | Engage SDK proof of concept after eligibility confirmation |

## Out of scope / guardrails

- Do not remove `hashpass://` until deployed links and emails have aged out and
  telemetry proves migration is safe.
- Do not commit screenshots containing attendee data, tokens, account IDs,
  cookies, or private Play Console details.
- Do not use Play-generated translation as the production source of truth.
- Do not add Play Billing products, rentals, pre-orders, or Play Points without
  a separately approved product and compliance plan.
- Do not manually release after implementation; use the protected release flow
  in `CLAUDE.md`.
