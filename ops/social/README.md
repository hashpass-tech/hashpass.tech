# Social Operations & Content Automation

This directory owns versioned editorial policy, schemas, prompts, platform guidance, and reproducible n8n definitions. Plane's **SOCIAL** project remains the operational source of truth; Metricool remains the scheduler and analytics provider. No custom social scheduler or social UI is introduced.

## Flow and hard boundary

`source event → Content Signal → qualification → Plane SOCIAL item → platform drafts → REVIEW → human APPROVED/READY → Metricool → publication → 24h/72h/7d analytics → Plane → optional REPURPOSE candidate`

A signal is a fact worth evaluating, not a post. The code rejects publishing unless the selected draft has provenance and the item is both `READY` and explicitly `APPROVED`. `SOCIAL_AUTOPUBLISH=true` is deliberately rejected in v1.

## Configuration map

- `brand.yaml`, `voice.md`, `content-pillars.yaml`, and `prohibited-claims.yaml`: reviewed policy.
- `platforms/`: distinct platform output requirements.
- `prompts/`: separate qualification, drafting, review, analysis, and repurposing instructions.
- `schemas/`: portable records embedded in Plane descriptions.
- `n8n/`: disabled-by-default orchestration templates. n8n coordinates; the package owns rules.
- `campaigns/`: reviewed, time-bounded campaign configuration.
- `.env.example`: names only; copy into the orchestrator secret store, never commit values.

## Plane SOCIAL bootstrap

1. Create project **SOCIAL**, identifier `SOCIAL`, with restricted company membership.
2. Create states, in order: `IDEA`, `SOURCE VERIFIED`, `DRAFTING`, `REVIEW`, `READY`, `SCHEDULED`, `PUBLISHED`, `ANALYZED`, `REPURPOSE`. Treat READY as an approval-controlled state.
3. Add labels: `source:github`, `source:plane`, `source:frappe`, `source:event`, `source:manual`; `platform:linkedin`, `platform:x`, `platform:instagram`; `maturity:production`, `maturity:prototype`, `maturity:experiment`, `maturity:planned`, `maturity:research`; and pillar labels matching enabled IDs in `content-pillars.yaml`.
4. Store the complete content-item JSON in the work-item description's `data-hashpass-social-schema="1.0"` block. The title begins with the stable content ID. Use the dates, assignee, state, and labels as convenient Plane projections, not competing truth.
5. Create separate least-privilege read and write API identities. The writer needs only SOCIAL work-item/state access. Keep keys in n8n credentials.
6. Upsert using `contentId`; never create blindly on retry. Metricool schedules use `schedule:<contentId>:<platform>:<draftVersion>`.

Required fields are defined by `schemas/content-item.schema.json`, including source, campaign, pillar, objective, platforms, languages, format, owner, dates, approval, drafts, provider references, URLs, analytics, repurposing, evidence, and audit history.

## MCP choices

Plane's current official implementation is [`makeplane/plane-mcp-server`](https://github.com/makeplane/plane-mcp-server), built on `plane-sdk`. For self-hosted Plane use local stdio (`uvx plane-mcp-server stdio`) with `PLANE_BASE_URL`, `PLANE_API_KEY`, and `PLANE_WORKSPACE_SLUG`. Streamable HTTP is preferred over deprecated SSE. Do not expose it without authentication. The REST `PlaneContentStore` exists for deterministic service-to-service upserts; AI access should prefer official MCP.

As of this design review, no official Metricool MCP server could be verified. Community MCP servers exist, but their contracts and security posture must be validated before production. `MetricoolMcpPublisher` therefore uses configurable tool names behind `SocialPublisher`; a reviewed MCP gateway is preferred first, and a future official REST adapter can replace it without changing editorial rules. Direct platform OAuth is out of scope.

## Source support

GitHub merged PRs are implemented. Releases, milestones, selected issues, Plane, Frappe, events, and manual ideas share the schema but are adapters for the next phase. A GitHub PR must be merged and carry `content:public`, `content:technical`, `content:release`, or `content:case-study`; `content:skip` wins. Labels select evaluation, never publication. Security/confidential terms force rejection pending human handling.

## Local checks

```bash
pnpm --filter @hashpass/social-operations test
pnpm --filter @hashpass/social-operations example
node -e "JSON.parse(require('fs').readFileSync('ops/social/n8n/github-merged-pr.json'))"
```
