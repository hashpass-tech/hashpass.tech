# HASHPASS LiveOps

HASHPASS LiveOps converts live event signals into operational incidents and recommended actions in realtime. It is a desktop-first operator console and a new capability built on—not a replacement for—the existing HASHPASS event platform.

## Local development

Requirements: Node 22.22.2 and pnpm 9.15.5.

```bash
pnpm install
pnpm dev:liveops
```

Open `http://localhost:3100/live`. Use **Run full demo** or the deterministic controls. All included data is synthetic and visibly marked.

## Convex setup

```bash
cd apps/liveops
pnpm exec convex dev
```

Convex creates a development deployment, generates typed API bindings, and writes `NEXT_PUBLIC_CONVEX_URL`. The checked-in `convex/` implementation is the operational plane: ingestion, reactive state, incidents, recommendations, approvals/actions, agent-run summaries, simulator runs, and audit logs. Existing HASHPASS domain data stays behind `EventSourceAdapter`.

The UI's local deterministic preview keeps a demo reviewable without credentials; it uses the same tested policy module and is explicitly not represented as the deployed Convex runtime. Connect generated Convex bindings before public judging deployment.

## Checks

```bash
pnpm test:liveops
pnpm --filter hashpass-liveops typecheck
pnpm build:liveops
```
