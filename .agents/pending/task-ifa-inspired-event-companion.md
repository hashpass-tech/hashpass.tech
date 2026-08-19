# Task: Build the HashPass Event Companion (IFA + Grip Product Benchmark)

**Status:** 🕒 PENDING  
**Priority:** 🟠 High  
**App:** HashPass mobile app + mobile web/PWA + event APIs  
**Created:** 2026-08-19  
**Research targets:** [Official IFA App 2026 page](https://www.ifa-berlin.com/app),
[Grip event platform](https://www.grip.events/), and the public shell of the
[IFA 2026 Grip networking route](https://matchmaking.grip.events/ifa26/app/home/network/list/130056?page=1&sort=group)

## Goal

Turn HashPass from a strong event pass, agenda, speaker-booking, and chat app
into a complete on-site event companion. Preserve the features HashPass already
does well, then add the two clear gaps exposed by the IFA app comparison:

1. **Exhibitor/product discovery** with one cross-content saved list.
2. **Venue wayfinding** that connects a saved session, exhibitor, service, or
   meeting directly to a map and route.

Ship this as an event-configurable platform capability, not a one-off BSL
feature and not a visual clone of IFA.

## Research Summary

Research was performed on 2026-08-19 against the public IFA product page, its
linked Apple App Store metadata, its linked Google Play listing, Grip's public
product material, and the unauthenticated shell returned by the supplied IFA
2026 Grip networking route.

### What IFA communicates well

The official page reduces the product to four visitor jobs:

| Visitor job | IFA capability | Product lesson for HashPass |
|---|---|---|
| Discover | Browse brands, products, startups, stages, and highlights; save favourites | Search should span all event content, not only agenda and speakers |
| Navigate | Interactive hall/floor map, live blue-dot position, and fastest route | Every location label should become an actionable destination |
| Plan | Five-day personal agenda, saved sessions, reminders, and live updates | Saving is only useful if the app proactively keeps the attendee on track |
| Connect | Goal-based people search, direct messages, and meeting request management for eligible pass types | HashPass can build on its existing pass-tiered networking rather than replace it |

The onboarding proposition is also unusually simple: download, identify the
ticket type, and claim the account with registered email plus badge ID. The
important lesson is not to copy badge-ID authentication, but to make the
relationship among identity, ticket/pass, event access, and networking
eligibility obvious during activation.

### Additional store-listing evidence

- The linked store descriptions reinforce interactive maps/floor plans,
  exhibitor lookup before arrival, agenda bookmarks and alerts, programme
  discovery, and meeting scheduling as the app's core loop.
- The Apple listing was version `10.41.1`, updated 2026-08-18, and categorized
  under Business and Social Networking when checked.
- The Apple storefront exposed a low aggregate rating (about 1.47/5 from 96
  ratings when checked). Treat that as a warning that a broad feature list is
  not enough: HashPass must instrument reliability, offline behavior, startup
  time, map accuracy, and notification usefulness from the first rollout.

### What the Grip platform adds to the comparison

IFA describes the attendee experience; Grip exposes the broader platform and
organizer model behind it. Its public material groups the product into a
connected lifecycle rather than a collection of attendee screens:

| Layer | Public Grip proposition | HashPass lesson |
|---|---|---|
| Engage | White-label home feed, agenda, directories, chat, recommendations, floor plans, notifications | Build reusable event modules and a configurable event home, not event-specific forks |
| Match | Learn from explicit and implicit preferences, recommend relevant people, then arrange a meeting | Treat discovery feedback and meeting outcomes as a controlled recommendation loop |
| Schedule | Self-arranged and organizer-facilitated meetings, including one-to-one, group, hosted-buyer, roundtable, and VIP formats | Generalize the current speaker/requester model before adding AI matching |
| On site | Registration, badge printing/scanning, access control, smart badges, lead retrieval, and optional location tracking | Join pass identity, entry, networking, and exhibitor follow-up through auditable consent-aware workflows |
| Operate | Exhibitor/sponsor, speaker, submission, side-event, integrations, and campaign tooling | Organizer data quality and workflow controls are product features, not back-office afterthoughts |
| Monetize | Sponsorship placements, meeting packages, exhibitor leads, and measurable event ROI | Design entitlement and attribution primitives first; do not expose attendee behavior by default |
| Extend | Persistent community/content between event dates | Use event lifecycle states and opt-in communities rather than making every event disappear at closing time |

Grip also advertises several operating practices worth testing rather than
blindly adopting:

- Launch exhibitor access early and track activation/readiness before attendee
  launch. Grip claims a six-week exhibitor launch performs better than four;
  HashPass must validate that claim with its own events.
- Protect high-value participants with visibility rules and pending-request
  limits. A bounded queue can reduce spam and encourage thoughtful requests.
- Keep integrations modular so organizers can retain registration, CRM, or
  polling systems instead of requiring a full migration.
- Make offline reliability part of the adoption strategy, not merely a failure
  fallback.
- Support notes, qualification, and lead scoring only with a transparent
  attendee-to-exhibitor contact exchange; scanning a badge must not silently
  grant access to unrelated profile or behavioral data.

### Supplied IFA 2026 networking-route observation

The supplied URL has an event-scoped, deep-linkable shape containing the event
slug (`ifa26`), a network list, a list identifier (`130056`), pagination, and a
group sort. In an unauthenticated fetch it returned only the JavaScript web-app
shell titled **Web Networking**; it did not expose participant records or the
rendered list. Therefore this task does **not** claim to have inspected private
profiles, filters, ranking, or authenticated interactions.

Useful lessons from the observable contract are still concrete:

- Networking views should have durable, shareable in-app routes that preserve a
  directory/segment, page or cursor, sort, and filters.
- On authentication, preserve the intended safe destination and restore it only
  after verifying event membership and pass eligibility.
- Never place private filter values, contact details, access tokens, or ranking
  signals in URLs; use opaque server-owned segment IDs where saved lists are
  needed.
- Prefer cursor pagination for mutable directories, while retaining accessible
  back/forward navigation and stable sort semantics.

### Sources

- [IFA App 2026 product page](https://www.ifa-berlin.com/app)
- [IFA Berlin 2026 on Apple App Store](https://apps.apple.com/de/app/ifa-berlin-2025/id6451202270?l=en-GB)
- [IFA Berlin 2026 on Google Play](https://play.google.com/store/apps/details?id=events.grip.ifa932)
- [Grip event technology platform](https://www.grip.events/)
- [Grip mobile event app](https://www.grip.events/products/mobile-event-app)
- [Grip event matchmaking](https://www.grip.events/products/event-matchmaking)
- [Grip pre-scheduled meetings](https://www.grip.events/products/pre-scheduled-meetings)
- [IFA 2026 Grip networking route supplied for review](https://matchmaking.grip.events/ifa26/app/home/network/list/130056?page=1&sort=group)

The comparison records public product claims, not reverse-engineered behavior.
Validate map vendors, venue data rights, positioning accuracy, notification
consent rules, and accessibility on a real pilot venue before committing to a
production architecture.

## HashPass Baseline and Gap Analysis

### Already present: retain and integrate

- Multi-event shells with event-specific agenda, speakers, event information,
  passes, and branding.
- Agenda search/filtering, session favorites, attendance state, and a personal
  schedule with a read-only public share token.
- Speaker discovery, meeting requests, bookings, conflict resolution, meeting
  detail, and encrypted meeting chat.
- Pass-tier configuration plus pass-gated event rooms, direct messages, and
  live presence.
- Notifications, event chat, wallet/pass display, and admin event controls.

### Partial or missing

| Area | Current HashPass state | Needed capability |
|---|---|---|
| Exhibitors and products | No first-class attendee directory/routes found | Event-scoped exhibitors, booths, products, categories, search, filters, and detail screens |
| Unified saves | Agenda favorites exist | One "My Event" collection for sessions, speakers, exhibitors, products, and meetings |
| Venue maps | Event info opens an external map for the venue address | Indoor floor/hall plans, services/POIs, booth/stage pins, and deep links from every location |
| Indoor positioning | No blue-dot venue experience found | Optional consented positioning with confidence and a graceful static-map fallback |
| Routing | Meeting/session locations are text | Accessible indoor routes, travel-time estimates, and "leave now" prompts |
| Proactive plan | Agenda status/favorites exist | Local/push reminders, schedule-change alerts, conflict/travel warnings, and quiet controls |
| Goal-based discovery | Networking is strongest around speakers and meetings | Opt-in attendee goals/interests and explainable recommendations across people and exhibitors |
| Meeting formats | Current requests are centered on attendee-to-speaker meetings | Participant-to-participant, buyer/supplier, group, roundtable, VIP, and organizer-facilitated formats |
| Networking feedback | Requests and outcomes exist, but no explicit relevance-feedback loop was found | Interested/not-relevant feedback with transparent recommendation reasons and reset controls |
| Networking protection | Pass tiers and meeting limits exist | Visibility matrix, pending-request caps, cooldowns, block/report enforcement, and VIP protection |
| Organizer readiness | Admin controls exist across several surfaces | Launch checklist for data completeness, exhibitor activation, meeting capacity, map validity, and notification readiness |
| Lead exchange | QR/pass functionality exists, but no attendee-controlled exhibitor lead workflow was found | Explicit contact exchange, scan receipt, notes, consent scope, export audit, and deletion controls |
| Activation | Auth, passes, and QR are separate concepts in the UI | A single claim/check flow that explains event access and tier-enabled features |
| Web parity/offline | Expo web exists, but no companion-specific offline contract | Installable/responsive companion surfaces and a cached read-only event pack |

## Product Principles

1. **Do not clone IFA or Grip.** Use the visitor-job model while keeping
   HashPass's identity, pass entitlements, privacy, and event portability.
2. **Progressive enhancement.** A static accessible floor plan must work before
   positioning; positioning must fall back safely when accuracy is weak.
3. **Location is optional.** Never make foreground/background location a
   condition of ticket, agenda, or networking access.
4. **One event graph.** Sessions, speakers, exhibitors, products, meetings,
   stages, booths, and services reference canonical venue locations.
5. **Offline first for essentials.** The attendee must retain the pass, saved
   plan, directory, and static maps during congested or unavailable venue Wi-Fi.
6. **Entitlements remain server-side.** UI feature flags improve presentation;
   APIs still enforce event and pass-tier authorization.

## Prioritized Delivery Plan

### Phase 0 — Validate the model and pilot (P0)

- Choose one event and obtain organizer-approved exhibitor, product, floor-plan,
  POI, and schedule data.
- Interview attendees, exhibitors, and event operations; validate the four jobs
  and establish baseline success metrics.
- Define canonical IDs and import/versioning rules. Extend the existing event
  ingestion path instead of embedding event data in screens.
- Decide map delivery format after a vendor/build/buy evaluation. Require web,
  iOS, Android, offline, accessibility, licensing, and export support.
- Run a venue positioning proof of concept before promising "blue dot." Compare
  GPS, venue Wi-Fi, BLE beacons, QR checkpoints, and manual "you are here"
  selection. Record accuracy, cost, battery use, and operations burden.

**Exit gate:** approved data rights, pilot dataset, architecture decision
record, privacy review, measured baseline, and positioning go/no-go decision.

### Phase 1 — Discovery and "My Event" (P0, first shippable value)

- Add event-scoped `exhibitors`, `exhibitor_locations`, `products`,
  `event_locations`, and polymorphic `user_event_saves` models with RLS and
  tenant/event isolation.
- Extend ingestion with idempotent upsert, source provenance, soft deletion,
  import preview, validation errors, and rollback/version support.
- Add exhibitor and product directory/detail routes with full-text search and
  filters for category, hall, country, startup status, and accessibility.
- Create a universal search entry point for sessions, speakers, exhibitors,
  products, stages, and services with typed result groups.
- Replace the agenda-only mental model with a "My Event" view that combines
  favorites, attendance choices, and meetings in chronological and collection
  modes. Preserve existing agenda APIs during migration.

**Acceptance criteria**

- [ ] An organizer can import/update at least 5,000 exhibitors and 20,000
      products idempotently without cross-event leakage.
- [ ] An attendee can find and save a session, speaker, exhibitor, or product in
      three interactions or fewer from universal search.
- [ ] Saved items sync across authenticated devices and expose useful offline
      cached data without leaking private meeting details.
- [ ] Search/filter APIs are paginated, event-scoped, rate-limited, and tested
      for empty, stale, duplicate, and withdrawn records.
- [ ] Existing agenda favorites and shared schedules continue to work.

### Phase 2 — Actionable maps and routing (P0)

- Add an event map route with floor switching, zoom/pan, searchable POIs,
  accessible text alternatives, and downloadable static maps.
- Link every booth, stage, room, meeting point, entrance, help desk, restroom,
  food point, and accessibility service to a canonical location.
- Add "Show on map" from agenda, exhibitor/product detail, meeting detail,
  search results, and My Event.
- Add origin selection, accessible-route preferences, route steps, distance,
  and estimated travel time. Start with fixed graph routing.
- Use travel time to surface conflicts between consecutive saved activities;
  never silently alter the attendee's plan.

**Acceptance criteria**

- [ ] Static maps, location search, and destination deep links work on native
      and responsive web without location permission.
- [ ] Route generation never crosses closed/restricted edges and supports an
      organizer-authored step-free route.
- [ ] A location/floor-plan revision is versioned and clients cannot combine
      incompatible map and routing graph versions.
- [ ] Core maps and saved destinations remain readable offline.
- [ ] Map controls, pins, route steps, and text alternatives pass keyboard,
      screen-reader, contrast, text-scaling, and reduced-motion checks.

### Phase 3 — Reminders and live operations (P1)

- Add attendee-configurable reminders for saved sessions and meetings.
- Send schedule/location/cancellation notices only to affected users, with a
  clear source, event-local time, and action to open the new destination.
- Calculate a "leave by" suggestion from route time plus an attendee-set buffer.
- Add notification categories, quiet hours, timezone-safe scheduling,
  deduplication, and an in-app notification center fallback.
- Give event operators an audited preview/target/confirm flow and emergency
  kill switch for live updates.

**Acceptance criteria**

- [ ] Changes are deduplicated and stale/cancelled reminders cannot fire.
- [ ] Deep links open the exact session, meeting, exhibitor, or route.
- [ ] Push-denied users receive equivalent in-app state without nag loops.
- [ ] Organizer targeting is event-scoped, entitlement-aware, audited, and
      covered by authorization tests.

### Phase 4 — Consented positioning (P1, conditional)

- Implement blue-dot positioning only if Phase 0 meets the agreed accuracy,
  cost, battery, and venue-operations thresholds.
- Request foreground permission just in time, explain the benefit, display an
  accuracy/confidence state, and support manual correction.
- Keep raw location on device wherever possible. Do not retain movement history
  by default or use it for attendee analytics without separate explicit consent.
- Fall back to last-known entrance, QR checkpoint, manually chosen origin, or
  static map when a fix is unavailable or unreliable.

**Acceptance criteria**

- [ ] The UI never presents low-confidence positioning as precise.
- [ ] Denying/revoking permission leaves all non-positioning features usable.
- [ ] Pilot accuracy, route completion, crash-free sessions, battery impact,
      and opt-out metrics meet the ADR thresholds before general release.

### Phase 5 — Explainable smart discovery (P2)

- Add optional profile goals, interests, languages, industries, and meeting
  availability with field-level visibility controls.
- Recommend people, exhibitors, products, and sessions using explicit event
  data first; show "why this match" and provide dismiss/block controls.
- Reuse HashPass meeting requests and chat rather than creating a second
  networking stack.
- Add safety/reporting, organizer moderation, and anti-spam/rate limits before
  opening attendee-to-attendee discovery broadly.
- Add explicit `interested`, `not relevant`, and `hide` feedback. Keep the
  original reason and model/ruleset version so recommendations can be audited.
- Add an event-configurable visibility matrix and request policy by participant
  type (for example attendee, buyer, supplier, exhibitor, speaker, investor, or
  VIP), including pending caps, cooldowns, and allowed meeting formats.
- Generalize meeting participants and resources so one-to-one, one-to-many,
  group, hosted-buyer, roundtable, and organizer-facilitated schedules do not
  require separate meeting tables.
- Provide an organizer scheduling preview that shows impossible constraints,
  participant conflicts, capacity, travel time, and a reversible proposed
  schedule before publishing. AI may rank proposals but must not bypass hard
  constraints or silently publish meetings.

**Acceptance criteria**

- [ ] Recommendations reveal no private profile field and work only for opted-in
      users with eligible passes.
- [ ] Every recommendation is explainable, dismissible, and measurable.
- [ ] Blocking/reporting applies consistently to discovery, requests, and chat.
- [ ] Users can inspect why a match appeared, correct preferences, clear learned
      feedback, and opt out without losing ordinary directory search.
- [ ] Visibility and request caps are enforced by APIs, not only hidden in UI,
      with authorization tests for every participant-type pairing.
- [ ] Facilitated schedule generation is deterministic for the same inputs and
      ruleset, identifies unsatisfied constraints, supports operator edits, and
      requires an audited publish action.

### Phase 5B — Consented contact exchange and exhibitor ROI (P2)

- Add attendee-initiated QR/NFC contact exchange and exhibitor scanning with a
  clear confirmation of which profile fields will be shared.
- Give exhibitors private notes, qualification status, and follow-up tasks;
  separate these from the attendee's canonical profile and HashPass analytics.
- Provide the attendee a receipt/history of organizations they shared with and
  a revocation/deletion request path, subject to documented legal obligations.
- Add organizer-configured sponsorship placements that are visibly labeled and
  cannot alter organic search or matchmaking without disclosure.
- Export only consented fields, watermark/audit exports, rate limit bulk access,
  and prevent cross-event reuse unless the attendee separately opts into a
  persistent community.

**Acceptance criteria**

- [ ] A badge/pass scan never shares contact data without an explicit event
      policy and attendee-facing consent established before or during exchange.
- [ ] Exhibitors cannot query another exhibitor's leads, notes, or exports.
- [ ] Attendees can see who received their data and the fields shared.
- [ ] Sponsored results are labeled, entitlement-controlled, and reported
      separately from organic recommendation quality.

### Phase 6 — Unified activation and PWA parity (P2)

- Create one event-entry flow: authenticate/claim, resolve the pass, explain
  tier capabilities, finish the minimum profile, and enter the event home.
- Support deep links from organizer email/QR while preventing account
  enumeration and badge/pass replay.
- Make discovery, My Event, maps, and the read-only offline pack responsive and
  installable on mobile web; document native-only limitations.
- Add role-specific, skippable tutorials and contextual help rather than a long
  mandatory carousel.

## Proposed Data and API Contracts

Final names require a schema review, but implementations should cover:

- `event_locations`: event, venue, floor, type, label, geometry/coordinates,
  accessibility metadata, operating window, map version.
- `venue_route_nodes` / `venue_route_edges`: floor-aware routing graph,
  restrictions, step-free flags, distance, validity window.
- `exhibitors` / `exhibitor_locations`: normalized organization plus its booths
  at a specific event.
- `products`: event/exhibitor-scoped launches and highlights with provenance.
- `user_event_saves`: user, event, entity type/id, collection, timestamps.
- `attendee_discovery_profiles`: opt-in goals and field visibility; keep this
  separate from canonical identity/profile records.
- `network_visibility_rules` / `network_request_policies`: event-scoped
  participant-type permissions, request caps, cooldowns, and meeting formats.
- `recommendation_impressions` / `recommendation_feedback`: reason code,
  ruleset/model version, feedback, and privacy-safe measurement.
- `meeting_series`, `meeting_participants`, and `meeting_resources`: generalized
  self-arranged and facilitated meeting formats with rooms/tables/capacity.
- `contact_exchanges` / `exhibitor_lead_notes`: consent snapshot, shared-field
  scope, scan receipt, ownership, retention, and export audit state.
- Versioned endpoints under `/api/events/:eventId/` for `search`, `exhibitors`,
  `products`, `locations`, `maps`, `routes`, `saves`, and `recommendations`.

Do not accept arbitrary client-provided table names or entity types. Validate
against a server-side registry and verify that the referenced entity belongs to
the path event before reads or writes.

## Cross-Cutting Requirements

### Privacy and security

- Complete a threat model for venue maps, location permission, attendee
  discovery, recommendation feedback, contact exchange, public schedule shares,
  pass claims, organizer scheduling, exports, and organizer broadcasts.
- Minimize precise-location collection; publish retention/deletion behavior and
  provide consent revocation.
- Apply RLS/service authorization, event/tenant isolation, least privilege,
  input validation, rate limits, audit logs, and abuse reporting.
- Never expose attendee position, saved items, or recommendation signals to
  exhibitors or organizers as person-level analytics without explicit consent.

### Offline, performance, and reliability

- Define a signed/versioned event-pack manifest for directory, agenda, POIs,
  static maps, and the user's saved plan. Use stale-while-revalidate with visible
  "last updated" state.
- Set budgets for cold start, search latency, map load, pack size, memory,
  battery, crash-free sessions, and API availability on representative devices.
- Load test event-opening peaks and notification fan-out. Provide degraded modes
  when search, routing, positioning, or push vendors fail.

### Accessibility and internationalization

- All content and route instructions must be localizable and event-timezone
  aware. Avoid text embedded only in floor-plan images.
- Test screen readers, keyboard/web navigation, switch control, 200% text,
  color-independent map semantics, reduced motion, and step-free routing.

### Analytics and rollout

- Measure search success, zero-result rate, save-to-visit actions, map-route
  starts/completions, reminder opens, missed/conflicting plan items, meeting
  acceptance and attendance, recommendation-to-request conversion, request spam,
  schedule constraint satisfaction, consented contact exchanges, exhibitor
  follow-up, opt-in/opt-out, crash-free sessions, and offline recovery.
- Use event feature flags and staged cohorts. Do not enable positioning,
  recommendations, or broad live messaging globally by default.
- Add organizer-facing data quality diagnostics; most discovery/map failures
  should be repairable without an app release.

## Definition of Done

- [ ] Phase-specific acceptance criteria and automated authorization/isolation
      tests pass on API, native, and web surfaces in scope.
- [ ] Event ingestion, schema changes, rollback, runbooks, and data ownership are
      documented and exercised against a pilot copy.
- [ ] Offline, accessibility, localization, privacy, security, load, and degraded
      mode checks have explicit results rather than assumed coverage.
- [ ] Metrics dashboards and alert thresholds exist before pilot launch.
- [ ] A real-event pilot has organizer and attendee sign-off; findings are
      recorded before wider rollout.

## Non-Goals

- Copying IFA branding, wording, screen designs, proprietary venue data, or
  vendor-specific implementation details.
- Shipping indoor positioning before a measured venue proof of concept.
- Replacing HashPass passes, existing meeting requests, chats, agenda status,
  or schedule-sharing contracts without a migration plan.
- Passive or undisclosed lead capture, sale of attendee behavior, exhibitor
  access to unrelated attendee activity, or background movement tracking.
- Treating Grip's marketing metrics, neural-network claims, or launch timing as
  HashPass requirements without an independently measured pilot.
- Hard-coding BSL data or building a separate app per event.

## Likely Areas to Change

| Area | Expected work |
|---|---|
| `db/migrations/` | Event discovery, location/routing, saves, consent, RLS, and indexes |
| `packages/event-ingestion/` | Versioned exhibitor/product/venue imports and validation |
| `apps/mobile-app/app/api/events/[eventId]/` | Search, directory, map, route, save, reminder, and discovery APIs |
| `apps/mobile-app/app/events/[eventSlug]/` | Universal search, exhibitors/products, My Event, map, and activation UX |
| `apps/mobile-app/components/` | Shared result cards, save controls, map/route UI, offline/update states |
| `packages/types/` and `packages/config/` | Canonical contracts, entity registries, and per-event feature flags |
| `packages/i18n/` | Localized discovery, wayfinding, reminder, consent, and error copy |
| `packages/infra/` | Map assets/CDN, notification fan-out, observability, secrets, and vendor config |
| `apps/mobile-app/tests/` | API auth, tenant isolation, offline, deep-link, accessibility, and E2E pilot tests |
