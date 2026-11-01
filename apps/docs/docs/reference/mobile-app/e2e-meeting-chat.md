# End-to-end encrypted, persistent meeting chat

Shipped 2026-08-02, replacing an entirely broadcast-only, unpersisted chat
implementation. Migration: `db/migrations/V053__e2e_encrypted_persistent_meeting_chat.sql`
(group `meeting-chat-e2e` in `database-profiles.json`). Optional encrypted
key backup and restore was added later in
`db/migrations/V075__chat_key_backup_restore.sql`; the completed migration
record is archived at `archive/docs/E2E_CHAT_ENCRYPTION_UPGRADE.md`. The
authenticated API boundary and key-rotation guard are in
`db/migrations/V161__authenticate_meeting_chat_api_access.sql`.

## What was actually broken before this

`hooks/useRealtimeChat.ts` used Supabase Realtime **broadcast** exclusively —
an ephemeral pub/sub channel. Messages only ever lived in React state
(`useState<ChatMessage[]>`), never written to any table. Consequences:

- A message only reached the other participant if they were **connected to
  the channel at the exact moment it was sent**. Reload the screen, or open
  it a minute later, and the message was gone — there was no "async"
  messaging at all, despite `meeting_chat_messages`, `get_meeting_chat_messages`,
  and `send_meeting_chat_message` all already existing in the schema.
- Those persistence RPCs *were* being called (`lib/store-messages.ts`, via a
  confusingly-named second `storeMessagesFn` from `useMessagesQuery` that was
  destructured but never actually invoked — a copy/paste leftover), but
  confirmed via `SELECT count(*) FROM meeting_chat_messages` on production:
  **0 rows**, ever. Given `meetings` themselves couldn't be created on
  production until the same session's `V051` fix (see
  `db/migrations/V051__fix_meetings_speaker_id_write_type_divergence.sql`),
  it's likely this path was simply never exercised end-to-end in production.
- `meeting_chat_messages.sender_id`'s FK pointed at the `public.user` registry
  on dev while every RLS policy and RPC compared against `auth.uid()` — the
  same registry-vs-auth-id class of bug as `V046`/`V050` earlier in this
  session. A compliant insert (`sender_id = auth.uid()`) would have violated
  the FK on dev.
- Chat-message notifications were routed through `notification.type ===
  'chat_message'` → `networking/meeting-detail?...&openChat=true` (both in
  `notifications.tsx` and `NotificationContext.tsx`'s web browser-notification
  handler) — but `meeting-detail.tsx` never reads `openChat`. The link landed
  on the plain meeting detail screen with no way to reach chat from there.
  Fixed to route straight to `networking/meeting-chat` instead.
- `app/events/[eventSlug]/networking/meeting-chat.tsx` (the route wrapper,
  not the `MeetingChat.tsx` component) compared `meetingData.requester_id ===
  user.id` — Better Auth's own id, not a real Supabase uuid. Missed in the
  original [`dbUserId` audit](./db-user-id-pattern.md) from v1.8.273, which
  fixed this exact bug in every other chat-adjacent file. Fixed to use
  `dbUserId`.

None of this was covered by any test before this change.

## Design

Each user holds a device-local **X25519 keypair**. The private key never
leaves the device (SecureStore on native, `localStorage` on web — same
platform-branch pattern as `lib/auth/providers/directus.ts`'s session
storage). Only the public key is published to `public.user_chat_keys`
(`user_id uuid PK → auth.users`). The browser calls the authenticated chat-key
API; its server resolves the signed-in account before reading or publishing
keys. Public keys are not secret, but callers cannot choose another account
when publishing a key.

A message is encrypted with **XChaCha20-Poly1305**, using a key derived via
**HKDF-SHA256** from the **X25519 ECDH shared secret** between the two
participants' keys. Because ECDH is symmetric —
`getSharedSecret(myPriv, theirPub) === getSharedSecret(theirPriv, myPub)` —
a single derived key decrypts every message in the conversation regardless
of which side sent it; there's no per-message key exchange. The server
(`meeting_chat_messages.ciphertext`/`.nonce`) only ever sees ciphertext — it
cannot decrypt messages even with full DB access, and `send_meeting_chat_message`
notifies the recipient (`create_notification(..., 'chat_message', 'New
message', "{sender} sent you a message.", ...)`) without ever touching the
plaintext.

All primitives come from the pure-JS `@noble/*` suite (`@noble/curves/ed25519`'s
`x25519`, `@noble/hashes/hkdf`+`sha2`, `@noble/ciphers/chacha.js`'s
`xchacha20poly1305`) rather than a native crypto module — see
[Why pure-JS crypto](#why-pure-js-crypto-and-the-one-native-adjacent-exception) below.
Both `HKDF_INFO` and `BACKUP_KDF_INFO` are explicitly UTF-8 encoded
(`utf8ToBytes(...)`) before being passed as the `info` argument to `hkdf()`,
matching the same explicit-encoding pattern `deriveBackupKey()` already used
for the password itself, rather than handing `hkdf()` a raw JS string.

### Optional encrypted key backup and restore

The original V053 design was device-local, but V075 adds optional continuity
for reinstall and new-device flows. The private key is encrypted on the
client with a user-provided password before storage; the server stores only
the encrypted backup and salt. There is no password reset or server-side key
escrow.

When a device has no local key but an encrypted backup exists, the chat UI
requires restore before sending. A different key cannot replace an already
registered key: doing so would make existing messages unreadable for both
participants. Re-publishing the same key preserves its backup. If the private
key and its backup are both lost, existing ciphertext cannot be recovered; a
participant or server cannot recreate the private key. When the current key is
available but has no backup, the chat offers an encrypted-backup setup prompt.

`decryptChatMessage()` returns `null` (never throws) on decryption failure,
so the UI renders a per-message `[Unable to decrypt this message]` placeholder
rather than crashing or hiding the whole conversation. The detailed migration
schema, user flows, and security record is archived at
`archive/docs/E2E_CHAT_ENCRYPTION_UPGRADE.md`.

### Schema

`meeting_chat_messages` (existing table, redesigned columns) and the
`user_chat_keys` table — see `V053` for the core DDL and `V075` for the
encrypted backup columns and RPCs. Also cleaned up in the same
migration: prod had accumulated a vestigial `meeting_request_id` column and
a second, older set of RLS policies referencing it
(`chat_select_participant`/`chat_insert_participant`) alongside newer
`meeting_id`-based ones; dev never had that legacy column but had
`sender_id`'s (and `chat_last_seen.user_id`'s) FK pointed at the registry
table instead of `auth.users`. Both environments converge on one clean shape
now. `chat_last_seen` also diverged in an unrelated way: prod's table never
had an `updated_at` column (dev's does, via its own trigger) — `V053`'s
`update_chat_last_seen()` simply doesn't touch that column, since
`last_seen_at` is the only one the feature actually depends on.

Database RPCs (all uuid-typed now; the old `(text, text, ...)` signatures were
dropped outright since callers changed in the same commit). The browser no
longer calls these directly. The app API authenticates the user and verifies
meeting membership, then calls the RPCs using its service-role client. V161
revokes browser roles and grants execution to `service_role`:

- `send_meeting_chat_message(p_meeting_id, p_sender_id, p_ciphertext, p_nonce, p_message_type)`
  — re-validates participancy explicitly (SECURITY DEFINER bypasses RLS, so
  the table's own INSERT policy predicate is duplicated inside the function
  body), then notifies the other participant.
- `get_meeting_chat_messages(p_meeting_id, p_user_id)` — same participancy
  check, returns raw ciphertext/nonce rows for client-side decryption.
- `get_user_chat_public_key(p_user_id)` / `publish_user_chat_public_key(p_user_id, p_public_key)`
  — the public-key directory read/write.
- `update_chat_last_seen(p_user_id, p_meeting_id)` / `get_chat_last_seen(p_user_id, p_meeting_id)`
  — unchanged presence-adjacent "last seen" tracking, just retyped.

### Delivery and authentication

The hook (`hooks/useRealtimeChat.ts`) uses the authenticated app API for all
chat operations:

- Loads ciphertext history through `GET /api/meetings/chat` after both keys
  are ready, then decrypts it on-device. History refreshes every five seconds
  so messages arrive without opening a browser-originated Realtime channel.
- Encrypts each message on-device and sends only ciphertext and nonce through
  `POST /api/meetings/chat`. The API resolves identity from the signed-in
  session, checks meeting membership, validates the encrypted payload, and
  then persists it.
- Updates last-seen through that same authenticated API. Presence is derived
  from the stored last-seen timestamp; the chat does not POST to Supabase's
  Realtime broadcast endpoint.

The `GET /api/meetings/chat?kind=participants` response also resolves the
speaker and requester profile names and photos on the server. This supports
Better Auth sessions that have no Supabase browser JWT and keeps each side's
avatar tied to the matching profile.

### Key-readiness UI state

`otherKeyMissing` (from the hook) is true when the other participant has
never opened chat on any device, so no public key has been published for
them yet — sending would have nothing to encrypt against.
`RealtimeChat.tsx` disables the composer and shows an inline banner in this
state, rather than letting a send silently fail. API authentication failures
are reported as chat load errors instead of being mistaken for an unpublished
participant key. `keyMismatch` means this device does not have the private key
that matches its account's published public key; sending remains paused until
the matching key is restored.

## Why pure-JS crypto (and the one native-adjacent exception)

`@noble/curves`, `@noble/ciphers`, and `@noble/hashes` are pure JavaScript —
no native module, no impact on OTA-vs-native-build classification (see
[eas-update-ota.md](./eas-update-ota.md) and CLAUDE.md's "Mobile Android
Release Workflow" section on `detect-mobile-native-change.js`). `@noble/ed25519`
was already a direct dependency (used server-side, in `app/api/auth/wallet/solana+api.ts`);
`@noble/curves`, `@noble/ciphers`, and `@noble/hashes` were already present
transitively but are now declared explicitly in `package.json` since
`lib/chat-encryption.ts` imports from them directly.

One exception: `@noble`'s RNG (used for keypair generation and per-message
nonces) requires `globalThis.crypto.getRandomValues`, which Hermes/React
Native doesn't provide. Rather than adding `react-native-get-random-values`
(a real native module with iOS/Android code, which *would* trip the
native-build guard), `lib/chat-encryption.ts` polyfills it from `expo-crypto`'s
`getRandomValues` — already part of the Expo SDK's linked native modules
(autolinked into every build regardless of whether it was previously
imported), so declaring it as a direct dependency adds no new native
surface, even though it does add a `package.json` diff.

**Practical note:** `detect-mobile-native-change.js`'s guard is a simple
package.json-diff heuristic — it can't distinguish "this dependency change
is functionally native" from "this dependency was already linked, only the
declaration changed." The PR that ships this change *will* trigger a full
native build rather than an OTA-only release, purely because `package.json`
changed, even though `expo-crypto` and the three `@noble/*` packages don't
add any genuinely new native code to the app. This is expected, not a bug in
the guard worth working around.

## Testing

- `tests/lib/chat-encryption.test.ts` — the actual crypto: round-trip
  encrypt/decrypt, ECDH symmetry (sender can decrypt their own sent
  message), unique nonce per call, AEAD tamper detection (corrupted
  ciphertext → `null`, not a throw), wrong-keypair decryption → `null`,
  key generation/publish/reuse, public-key fetch (found / not-found /
  RPC-error cases), encrypted backup/restore, and wrong-password handling.
- `tests/hooks/useRealtimeChat.test.tsx` — hook orchestration with the
  crypto functions mocked: key setup sequencing, history load + decrypt,
  authenticated API history refresh and send, `otherKeyMissing` gating,
  backup restore/setup states, and participant-key API errors.
- `tests/api/meeting-chat.test.ts` — authenticated identity checks, meeting
  membership, encrypted send validation, presence, and participant profile
  resolution.
- Both migration RPCs verified end-to-end against **live dev and prod** via
  rolled-back transactions (`BEGIN; ...; ROLLBACK;`) covering: key
  publish/fetch, a real participant sending a message, a non-participant
  being rejected, message read-back, the `chat_message` notification
  actually being created, and last-seen read/write — following the same
  verification pattern used for `V050`/`V051` earlier in this session.

### A latent, unrelated bug found while writing `useRealtimeChat.test.tsx`

`packages/utils/src/performance-utils.ts` schedules a real `setInterval`
(image-cache cleanup, every 5 minutes) at **module-evaluation time**, gated
only on `typeof window !== 'undefined'` — unlike its sibling
`memory-manager.ts`'s cleanup interval, which also checks `Platform.OS ===
'web'`. In this repo's Jest environment `window` is defined even when
`Platform.OS` is mocked to `'android'`, so any test that transitively
imports `@hashpass/utils` for the first time schedules a real timer that
`jest.useFakeTimers()` can't retroactively cancel if it's called *after* the
import (imports are hoisted ahead of any inline statement). Worked around
locally in the test file by calling `jest.useFakeTimers()` before a
`require()` of the hook (instead of a plain top-level `import`), but the
root cause in `performance-utils.ts` is still live for the next test file
that imports `@hashpass/utils` fresh. Not fixed here (out of scope for this
change) — worth a follow-up `Platform.OS === 'web'` guard to match
`memory-manager.ts`.
