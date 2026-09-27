# Social content automation operator runbook

## Bring-up

1. Bootstrap Plane SOCIAL exactly as documented in `ops/social/README.md` and create least-privilege identities.
2. Copy `.env.example` names into n8n's encrypted credential store. Keep `SOCIAL_AUTOPUBLISH=false`.
3. Install the official Plane MCP locally with a pinned reviewed version; use stdio for AI clients. Test read identity before write identity.
4. Select and security-review a Metricool MCP gateway. Confirm HASHPASS brand ID, connected LinkedIn account, schedule tool, publication lookup, analytics fields, provider idempotency behavior, and rate limits in a non-production test. Override tool names through environment configuration.
5. Import both n8n JSON files **disabled**. Replace template nodes with repository package calls, HMAC verification, Plane credentials, error branches, and provider reconciliation. Activate only after the acceptance drill.
6. Configure GitHub `content:*` labels and route the seven-day artifact/event to authenticated n8n ingestion. The artifact workflow is an event emitter, not the automation engine.

## Acceptance drill

Merge a harmless test PR labeled `content:public` and `content:technical`. Confirm one stable signal after replaying delivery twice; manually record all qualification answers; confirm one Plane item in SOURCE VERIFIED; generate distinct LinkedIn/X drafts with evidence; confirm REVIEW publishes nothing; approve LinkedIn as a named human and move to READY; schedule once in Metricool; save its reference; confirm publication URL; ingest 24h/72h/7d snapshots; move to ANALYZED. If a threshold is met, create one linked REPURPOSE candidate and confirm it remains unapproved.

## Normal operation

- **Daily:** review rejected/ambiguous signals, REVIEW queue, date windows, and failed executions.
- **Before approval:** open every evidence link; verify maturity, factual claims, public asset rights, language, accessibility, and platform-specific copy.
- **After schedule:** compare Metricool reference with Plane and reconcile ambiguous timeouts before retrying.
- **Weekly:** inspect missing analytics windows and meaningful-conversation indicators; sample audit completeness.

## Incident controls

To stop output, deactivate publishing workflow and revoke Metricool gateway credentials; existing Metricool schedules must be paused in Metricool. Revoke approval if facts change. Never solve duplicate risk by deleting the audit record: reconcile by stable ID/key, cancel the duplicate in Metricool, and append an incident action. Rotate any exposed secret immediately and scrub it from n8n execution retention and provider logs.

## Production readiness and limitations

Production-ready locally: schemas/policies, deterministic PR normalization and stable IDs, qualification safety rules, content model, human approval guard, Plane description/upsert adapter, Metricool MCP abstraction, audit model, and tests. Experimental: imported n8n templates, AI provider invocation, community Metricool MCP compatibility, provider field mappings, best-time selection, and repurposing thresholds. External configuration is required for Plane, Metricool, n8n, AI, GitHub webhook ingress, connected social accounts, and approvals.

The local fixture is tested end to end only through approved outbound payload selection; no production Plane, n8n, model, Metricool, LinkedIn, X, Instagram, or Frappe service was called. Initial automatic ingestion covers merged PRs only. GitHub assets require explicit allowlisting. The n8n JSON is a reproducible safe skeleton rather than an activated production workflow. Next: validate Metricool's exact live contract in a sandbox, complete HMAC ingress and Plane state IDs, run the acceptance drill, then add aggregated Frappe/Plane/event/manual adapters.
