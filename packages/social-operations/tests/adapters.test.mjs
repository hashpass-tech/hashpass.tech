import test from 'node:test';
import assert from 'node:assert/strict';
import { MetricoolMcpPublisher, renderPlaneDescription } from '../src/adapters.mjs';

const readyItem = { contentId: 'cnt_123', status: 'READY', approval: { status: 'APPROVED' }, drafts: [{ platform: 'linkedin', text: 'Verified text', version: 2, approved: true, provenance: ['https://evidence.test'] }] };

test('Plane rendering escapes source-controlled HTML', () => {
  const html = renderPlaneDescription({ ...readyItem, source: { url: 'https://example.test/\" onmouseover=\"bad', type: '<github>' } });
  assert.doesNotMatch(html, /<github>|onmouseover="bad/);
  assert.match(html, /&lt;github&gt;/);
});

test('Metricool adapter sends approved LinkedIn draft with stable idempotency key', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ jsonrpc: '2.0', result: { reference: 'planner-1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const publisher = new MetricoolMcpPublisher({ endpoint: 'https://metricool-mcp.test', bearerToken: 'not-a-real-token', brandId: 'brand-1' });
  const result = await publisher.schedule(readyItem, 'linkedin', '2026-10-01T12:00:00Z');
  assert.equal(result.idempotencyKey, 'schedule:cnt_123:linkedin:2');
  assert.equal(calls[0].params.arguments.text, 'Verified text');
});

test('Metricool adapter refuses unapproved content before network access', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => assert.fail('network must not be called'));
  const publisher = new MetricoolMcpPublisher({ endpoint: 'https://metricool-mcp.test', bearerToken: 'token', brandId: 'brand-1' });
  await assert.rejects(publisher.schedule({ ...readyItem, status: 'REVIEW' }, 'linkedin', '2026-10-01T12:00:00Z'), /READY/);
  assert.equal(fetchMock.mock.callCount(), 0);
});
