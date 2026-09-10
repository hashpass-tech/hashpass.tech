---
title: LiveOps demo
---

# Demo guide

## Local reproduction

1. Run `pnpm install && pnpm dev:liveops` and open `http://localhost:3100/live`.
2. Click **Reset**. Confirm normal gates and zero incidents.
3. Click **Gate surge**. Main Entrance jumps to 68/min and a high incident appears with Secondary Entrance evidence.
4. Open it and click **Approve action**. Routing changes, Main drops to 28/min, and the incident resolves with an audit entry.
5. Trigger **Duplicate pass** and inspect the privacy-safe pass-hash evidence.
6. Trigger **Speaker delay** and inspect the 18-minute readiness warning.
7. Alternatively use **Run full demo** for a seeded, repeatable sequence.

All visible demo records are synthetic and marked simulated. The local preview proves the UX and policies but is not evidence of a hosted Convex connection. For the real challenge demo, configure Convex as described in `apps/liveops/README.md`, replace bootstrap bindings with generated bindings, deploy, and verify reactive updates in two fresh browser sessions.

## 2–3 minute narrative

State the pre-existing/new-work boundary; show normal state; trigger congestion; inspect evidence and recommendation; approve; show improvement and resolution; trigger the security and speaker scenarios; close with “designed for production validation with BSL Bogotá 2026.”
