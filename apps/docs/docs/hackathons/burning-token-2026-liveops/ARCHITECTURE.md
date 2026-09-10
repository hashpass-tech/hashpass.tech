---
title: LiveOps architecture
---

# Architecture

```text
Existing HASHPASS domain APIs → EventSourceAdapter → Convex operational plane
                                                     ├─ operational events
                                                     ├─ derived gate/session state
                                                     ├─ deterministic incidents
                                                     ├─ constrained recommendations
                                                     ├─ human-approved actions
                                                     └─ audit + verification
                                                              ↓ subscriptions
                                                     Operator console
```

Existing databases remain the system of record for events, schedules, speakers, passes, and identity. Convex owns ephemeral, event-scoped live operational state. The adapter exposes only explicit reads and privacy-safe ingestion; the demo uses synthetic pass hashes and metadata.

The Convex schema models events, gates, sessions, operational events, incidents, recommendations, actions, agent runs, audit logs, and simulator runs. Reactive `state` queries and mutations close the control loop. Clear anomalies are detected deterministically. An agent may interpret an already-created incident through narrow tools (`getEventState`, gate/session context, evidence, available actions, previous results, proposal, approval request); it never receives a general database mutation tool. Structured results store concise rationale, not private reasoning.

The checked-in failure path creates policy-backed recommendations when model inference is unavailable. Approval is the default autonomy mode. Traffic changes, pass flags, notifications, agenda changes, and room changes remain human controlled. Every decision is audited and the gate-congestion action immediately verifies changed gate metrics and resolves the incident.
