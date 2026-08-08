# HashPass celld check-in POC

This POC assigns one Durable Object (a celld "cell") to each HashPass event.
The cell serializes scans, so two gates cannot accept the same pass at the same
time, and stores the event's counter and pass keys in its private SQLite state.

## Run against AWS S3

Use a **dedicated test bucket** and credentials limited to that bucket. Never
reuse production application credentials.

```bash
curl -fsSL https://celld.dev/install.sh | sh
npm install --global esbuild
export CELLD_BUCKET=s3://YOUR-DEDICATED-POC-BUCKET
export AWS_REGION=us-east-2
./packages/infra/celld-poc/run.sh
```

In another shell:

```bash
curl -i -X POST http://127.0.0.1:8080/events/demo/check-ins \
  -H 'content-type: application/json' -d '{"passId":"pass-123"}'
curl -i -X POST http://127.0.0.1:8080/events/demo/check-ins \
  -H 'content-type: application/json' -d '{"passId":"pass-123"}'
curl http://127.0.0.1:8080/events/demo/check-ins
```

The first scan returns `201` and `accepted: true`; the second reports a
duplicate; the final request returns `count: 1`.

Run the fast local behavior tests without AWS or celld:

```bash
node --test packages/infra/celld-poc/test/worker.test.mjs
```

This is an evaluation, not a production deployment. It intentionally omits
authentication, TLS ingress, multi-node failover, observability, backups,
load tests, and pass-data retention/deletion policy.
