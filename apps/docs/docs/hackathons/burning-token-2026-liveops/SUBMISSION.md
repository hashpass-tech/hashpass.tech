---
title: LiveOps submission draft
---

# Submission draft

## HASHPASS LiveOps

**Realtime event operations. Before problems become incidents.**

Physical events generate operational data continuously, but organizers still coordinate incidents manually across scanners, radios, spreadsheets, and messaging apps. HASHPASS LiveOps creates a realtime operational plane that detects problems, explains impact, coordinates an approved next action, and verifies the outcome while the event is happening.

Convex is designed to maintain event-scoped operational events, reactive metrics, incidents, recommendations, actions, simulator runs, and audit history. Deterministic policies detect gate congestion, suspicious duplicate-pass activity, and speaker-readiness risk. A constrained recommendation layer produces structured, evidence-backed proposals with safe fallbacks; human operators approve high-impact actions.

This new capability lives inside the existing HASHPASS monorepo, with the historical boundary fixed at commit `b69ef443f6a1dc55cdaa47135e6fc2c9a641da93`. It does not claim pre-existing HASHPASS capabilities as hackathon work.

- **Demo URL:** Pending deployment—do not submit localhost.
- **Repository access:** Pending judge-access confirmation.
- **Video:** Pending.
- **Team:** Pending official submission entry.
- **Validation:** Pending; no feedback fabricated.
- **Limitations:** Official classified brief unverified; hosted Convex runtime, authentication integration, and public deployment pending.

## Roadmap

Burning Token proves synthetic signals, three incident policies, recommendations, approval, dashboard, and simulator. Next: real event-stream adapter, operator auth/RBAC, notifications, observability, load/failover tests, and configurable thresholds. BSL Bogotá 2026 is a production-validation candidate—not a current deployment. After validation, extend the same event-scoped architecture into a multi-event product.
