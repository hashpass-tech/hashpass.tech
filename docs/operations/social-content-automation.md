# Social content automation architecture

## Decisions and boundaries

Plane CE is the editorial system of record and audit surface, Frappe Helpdesk is the support source, n8n is replaceable orchestration glue, an operator-selected LLM drafts against repository prompts, and Metricool exclusively schedules/publishes and supplies analytics. This change does not depend on or modify PR #244; it uses that PR only as architectural context.

```text
GitHub / Plane / Frappe / Events / Manual
  -> immutable Content Signal (stable source-derived ID)
  -> deterministic + AI-assisted qualification
  -> Plane SOCIAL upsert
  -> AI platform drafts with claim provenance
  -> human REVIEW and explicit APPROVED/READY
  -> Metricool adapter
  -> LinkedIn (v1), X / Instagram (contract-ready)
  -> Metricool observations at ~24h, ~72h, ~7d
  -> Plane history and optional unapproved REPURPOSE candidate
```

### Components

| Component | Responsibility | Durable truth |
|---|---|---|
| `@hashpass/social-operations` | IDs, GitHub normalization, qualification safeguards, content transitions, approval guard, provider adapters | Git/reviewed code |
| Plane SOCIAL | ownership, lifecycle, descriptions, approvals, provider references, history | Plane |
| n8n | triggers, retries, calls, timers | execution state only |
| AI provider | structured qualification/drafts/review | never source of facts |
| Metricool | best windows, scheduling, publication references, analytics | Metricool, projected into Plane |

No separate editorial database is required. n8n execution data is operational/transient, and Plane records include append-only audit entries.

## Reliability and security

Signal IDs hash `source:type + stable external identifier`; content IDs derive from the signal. Plane is searched/upserted by content ID. Schedule keys include content ID, platform, and approved draft version. On an ambiguous provider timeout, reconcile that key/reference before retrying. Webhooks must verify GitHub HMAC at ingress; workflow artifacts contain no credentials. Logs should contain opaque IDs, action, result, and timestamps—not full prompts, tokens, customer content, or secrets.

Use separate Plane read/write credentials, a repository-scoped GitHub identity, the single HASHPASS Metricool brand, a drafting-only AI key, and n8n encrypted credentials. Egress-allowlist provider hosts. Back up Plane under the foundation runbook. Never copy Frappe tickets directly: aggregate/rephrase a repeated topic, remove personal/customer data, and require support-owner verification.

Every transition appends one of: `signal.created`, `signal.qualified/rejected`, `content.created`, `draft.generated`, `draft.edited`, `draft.approved`, `schedule.created`, `publication.confirmed`, `analytics.recorded`, `repurpose.proposed`. Provider responses stored in Plane must be reduced to non-secret references and metrics.

## AI contract

The orchestrator loads policy and the appropriate platform prompt at runtime. The model must return structured fields and evidence references. Deterministic code validates allowed pillar, maturity, provenance, lifecycle, and approval after the model responds. LinkedIn is the initial enabled publication target. X and Instagram are modeled but remain disabled until their Metricool accounts and exact content/media contracts pass a sandbox test.

## Analytics and repurposing

Collect supported fields at approximately 24 hours, 72 hours, and 7 days: impressions, reach, comments, shares, reactions, clicks, engagement, video views/watch time, and published URL. Preserve unavailable fields as absent—not zero. Reporting groups observations by pillar, format, hook, channel, and topic; meaningful-conversation measures emphasize comments, shares, and clicks rather than reactions alone. A configurable threshold may create a linked `REPURPOSE` candidate but cannot approve or publish it.

## Scaling path

Keep n8n while volumes are modest. Move to a dedicated stateless worker when execution volume, provider rate limits, or reconciliation complexity justify it. Preserve schemas and adapter interfaces, use a durable queue plus idempotency ledger, and continue projecting all editorial state to Plane. Do not migrate scheduling out of Metricool.
