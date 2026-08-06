# celld on AWS: HashPass use case, costs, and POC decision

_Pricing researched 2026-08-06; USD, us-east-2 where applicable, excluding
tax, support, engineering/on-call labor, and internet egress._

## Quick use case

Use one cell per event for **atomic admission/check-in**. Every gate sends a
pass scan to the same event cell. Its single-writer SQLite state accepts a pass
once, rejects simultaneous duplicate scans, maintains a live attendance count,
and can later push updates over WebSockets. This is a better fit than replacing
the existing stateless web/API stack: celld is valuable where HashPass needs
coordinated, stateful, per-event concurrency.

The runnable POC is in `packages/infra/celld-poc`. It uses standard Durable
Object code, a dedicated S3 bucket, and celld's S3-backed replication. No
production route or infrastructure is changed.

## What HashPass pays today

The repository's latest billing audit records an **$80 monthly ceiling**, a
previous-month total of **$51.84**, and an unreconciled **$238.98 forecast**.
It also says the target account's runtime consists primarily of two Lambda
functions behind API Gateway and small 14-day CloudWatch log groups, with no
running EC2, ECS, or NAT gateway at audit time. A stopped `t3a.xlarge` Android
build runner still has an 80 GiB gp3 volume. The forecast spans billing
views/accounts and has not been attributed, so it is not a defensible celld
baseline.

celld would **add** an always-on compute floor; it does not replace static S3,
CloudFront, release runners, Supabase, or ordinary stateless Lambda endpoints.
Therefore it will not make today's low-traffic AWS architecture cheaper.

## Monthly comparison

| Option                                |                                  Fixed monthly floor |                  Example at 100 resident event cells | Example at 1,000 resident event cells | HashPass interpretation                                                                                 |
| ------------------------------------- | ---------------------------------------------------: | ---------------------------------------------------: | ------------------------------------: | ------------------------------------------------------------------------------------------------------- |
| Actual AWS, prior complete month      |                                $51.84 recorded total | Same baseline unless a new stateful service is added |            Same baseline unless added | Best available actual, but across services and not yet reconciled                                       |
| Actual AWS, current forecast          |                                     $238.98 forecast |                              Not workload-comparable |               Not workload-comparable | Investigate account/service scope; do not use for ROI                                                   |
| Current AWS Lambda + API Gateway      | Near $0 at low traffic after free tiers; usage based |   Depends on requests/duration, not resident objects |          Depends on requests/duration | Remains cheapest for stateless, bursty API routes                                                       |
| Cloudflare Durable Objects, paid plan |                                   $5 Workers minimum |                                           about $415 |                          about $4,150 | Based on celld's published model, including the paid plan's included duration; requests/storage extra   |
| celld, one 8 GiB node                 |                                    about $49 compute |                               about $49 + S3/traffic |                about $49 + S3/traffic | Cheapest modeled stateful option once roughly 12 cells remain resident continuously; one node is not HA |
| celld, two 8 GiB nodes                |                                    about $98 compute |                            about $98 + S3/LB/traffic |             about $98 + S3/LB/traffic | Minimum sensible failover POC; still requires private networking and TLS ingress                        |

The celld figures deliberately reuse its published density/model (1,000
resident cells per 8 GiB node and roughly $49 per node-month). They are **not
an AWS quote**. On AWS, add EC2/ECS pricing, S3 storage and request charges,
load balancer, logs, data transfer, backups, and at least two nodes for an
availability claim. Cloudflare billing also charges requests, storage, and
storage operations; duration dominates only for continuously resident cells.

### Break-even model

For continuously resident objects, celld's comparison is:

`Cloudflare ≈ $5 + ($4.15 × resident cell-months above included duration)`

`celld ≈ $49 × ceil(resident cells / 1,000) + S3 + ingress + operations`

One $49 node crosses the Cloudflare duration-only line at approximately 12
resident cells. A production-like two-node floor crosses at about 24 cells
before AWS extras. Inactive or briefly active cells
do not justify this comparison; measure actual object active duration first.

## Recommendation

1. Keep the current S3/static, API Gateway, and Lambda architecture. There is
   no evidence celld can reduce the current total AWS bill.
2. Run this POC only for event check-in concurrency, using synthetic pass IDs
   and a separate bucket. Load-test duplicate scans and recovery with one node
   killed after acknowledged writes.
3. Instrument four numbers for a real event: peak requests/second, concurrent
   resident event cells, stored bytes/write operations, and required recovery
   time. Compare those measurements—not registered users—to both providers.
4. Proceed to a two-node AWS trial only if the feature needs Durable Object
   semantics and the modeled monthly Cloudflare duration cost is materially
   above the full AWS celld cost plus an operations allowance.

## Risks before production

- celld is currently alpha, has one application per fleet, manual updates, no
  managed ingress/TLS or global placement, and pressure shedding is opt-in.
- The S3 credentials are fleet-administrator credentials and require a narrow
  IAM policy. Peer traffic must remain on a trusted private network.
- celld supports Durable Objects, Workers, assets, and a subset of APIs; it is
  not a replacement for Cloudflare KV/R2/Cache, cron, Workers AI, or all Node
  APIs.
- HashPass must add authentication/authorization, encryption and deletion
  controls, metrics/alerts, restore drills, capacity tests, and an HA design.

## Sources

- HashPass actual-cost signal and inventory: `.agents/pending/task-aws-cost-audit-and-controls.md`.
- Current HashPass deployment surfaces: `packages/infra/README.md`.
- celld architecture, density, cost model, and operational docs: <https://celld.dev/> and <https://celld.dev/docs>.
- celld compatibility and alpha limitations: <https://celld.dev/docs/cloudflare-compat> and <https://celld.dev/docs/limitations>.
- Cloudflare Durable Objects pricing: <https://developers.cloudflare.com/durable-objects/platform/pricing/>.
- AWS on-demand service pricing: <https://aws.amazon.com/ec2/pricing/on-demand/>, <https://aws.amazon.com/s3/pricing/>, <https://aws.amazon.com/lambda/pricing/>, and <https://aws.amazon.com/api-gateway/pricing/>.
