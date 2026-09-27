import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsObservation, assertPublishable, qualifySignal, signalFromMergedPullRequest, stableExternalId } from '../src/domain.mjs';
import { approveDraft, applyDrafts, contentItemFromSignal } from '../src/pipeline.mjs';

const payload = { action: 'closed', repository: { full_name: 'hashpass-tech/hashpass.tech' }, pull_request: { number: 42, merged: true, merged_at: '2026-01-01T00:00:00Z', html_url: 'https://github.com/hashpass-tech/hashpass.tech/pull/42', title: 'Improve pass verification', body: 'Adds documented validation. Closes #40', user: { login: 'dev' }, labels: [{ name: 'content:technical' }, { name: 'content:public' }], merge_commit_sha: 'abc123' } };
const answers = { isPublic: true, externallyUseful: true, hasEvidence: true, containsSensitiveData: false, distinctFromRecent: true, maturity: 'production', contentPillar: 'product-engineering', actor: 'editor@example.test' };

test('merged labeled PR produces one stable signal', () => {
  assert.equal(signalFromMergedPullRequest(payload).signalId, signalFromMergedPullRequest(payload).signalId);
  assert.equal(stableExternalId('github.pull_request', 'repo#1'), stableExternalId('github.pull_request', 'repo#1'));
});
test('irrelevant, skipped, and sensitive PRs do not qualify', () => {
  assert.equal(signalFromMergedPullRequest({ ...payload, action: 'opened' }), null);
  const skipped = structuredClone(payload); skipped.pull_request.labels = [{ name: 'content:skip' }]; assert.equal(signalFromMergedPullRequest(skipped), null);
  const sensitive = structuredClone(payload); sensitive.pull_request.body = 'Rotates a leaked credential';
  assert.equal(qualifySignal(signalFromMergedPullRequest(sensitive), answers, ['product-engineering']).classification.decision, 'rejected');
});
test('qualification requires every safeguard and configured pillar', () => {
  const signal = signalFromMergedPullRequest(payload);
  assert.equal(qualifySignal(signal, answers, ['product-engineering']).classification.decision, 'qualified');
  assert.equal(qualifySignal(signal, { ...answers, isPublic: false }, ['product-engineering']).classification.decision, 'rejected');
  assert.equal(qualifySignal(signal, answers, ['community']).classification.decision, 'rejected');
});
test('publishing is impossible before explicit human approval', () => {
  const qualified = qualifySignal(signalFromMergedPullRequest(payload), answers, ['product-engineering']);
  const item = contentItemFromSignal(qualified);
  const reviewed = applyDrafts(item, [{ platform: 'linkedin', text: 'A factual update.', provenance: [payload.pull_request.html_url] }], { model: 'test-model', promptVersion: '1' });
  assert.throws(() => assertPublishable(reviewed, 'linkedin'), /READY/);
  const ready = approveDraft(reviewed, 'linkedin', 'human@example.test');
  assert.equal(assertPublishable(ready, 'linkedin').text, 'A factual update.');
});
test('analytics retains only supported finite metrics', () => {
  const snapshot = analyticsObservation({ platform: 'linkedin', observedAt: '2026-01-02T00:00:00Z', window: '24h', publishedUrl: 'https://example.test/post', metrics: { impressions: 10, likes: 99, comments: 2, reach: NaN } });
  assert.deepEqual(snapshot.metrics, { impressions: 10, comments: 2 });
});
