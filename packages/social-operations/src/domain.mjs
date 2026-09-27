import { createHash } from 'node:crypto';

export const CONTENT_LABELS = new Set([
  'content:public', 'content:technical', 'content:release', 'content:case-study', 'content:skip',
]);
export const SENSITIVE_TERMS = /\b(secret|credential|password|private key|vulnerabilit|exploit|customer data|security fix|account id)\b/i;

export function stableExternalId(source, sourceId) {
  if (!source || !sourceId) throw new Error('source and sourceId are required');
  return `sig_${createHash('sha256').update(`${source}:${sourceId}`).digest('hex').slice(0, 24)}`;
}

export function signalFromMergedPullRequest(payload) {
  const pr = payload?.pull_request;
  if (payload?.action !== 'closed' || !pr?.merged) return null;
  const labels = (pr.labels ?? []).map((label) => typeof label === 'string' ? label : label.name).filter(Boolean);
  if (labels.includes('content:skip') || !labels.some((label) => CONTENT_LABELS.has(label) && label !== 'content:skip')) return null;
  const repository = payload.repository?.full_name;
  if (!repository || !pr.number || !pr.html_url) throw new Error('incomplete GitHub pull request payload');
  const text = `${pr.title ?? ''}\n${pr.body ?? ''}`;
  return {
    schemaVersion: '1.0',
    signalId: stableExternalId('github.pull_request', `${repository}#${pr.number}`),
    source: { type: 'github.pull_request', externalId: `${repository}#${pr.number}`, url: pr.html_url },
    title: pr.title,
    occurredAt: pr.merged_at,
    facts: {
      author: pr.user?.login, labels, mergeCommitSha: pr.merge_commit_sha,
      summary: (pr.body ?? '').slice(0, 1000), issueReferences: [...text.matchAll(/#(\d+)/g)].map((m) => m[1]),
      publicAssets: [],
    },
    classification: null,
    evidence: [{ kind: 'source-url', reference: pr.html_url }, ...(pr.merge_commit_sha ? [{ kind: 'commit', reference: pr.merge_commit_sha }] : [])],
    safeguards: { sensitiveTermDetected: SENSITIVE_TERMS.test(text) },
    audit: [{ action: 'signal.created', at: payload.__receivedAt ?? new Date().toISOString(), actor: 'github-webhook' }],
  };
}

export function qualifySignal(signal, answers, approvedPillars) {
  const required = ['isPublic', 'externallyUseful', 'hasEvidence', 'containsSensitiveData', 'distinctFromRecent'];
  for (const key of required) if (typeof answers[key] !== 'boolean') throw new Error(`qualification.${key} must be boolean`);
  const maturity = answers.maturity;
  if (!['production', 'prototype', 'experiment', 'planned', 'research'].includes(maturity)) throw new Error('qualification.maturity is invalid');
  const pillarApproved = approvedPillars.includes(answers.contentPillar);
  const blocked = signal.safeguards?.sensitiveTermDetected || !answers.isPublic || !answers.externallyUseful ||
    !answers.hasEvidence || answers.containsSensitiveData || !answers.distinctFromRecent || !pillarApproved;
  return {
    ...signal,
    classification: { ...answers, pillarApproved, decision: blocked ? 'rejected' : 'qualified' },
    audit: [...signal.audit, { action: `signal.${blocked ? 'rejected' : 'qualified'}`, at: new Date().toISOString(), actor: answers.actor ?? 'operator' }],
  };
}

export function assertPublishable(item, platform) {
  if (process.env.SOCIAL_AUTOPUBLISH === 'true') throw new Error('SOCIAL_AUTOPUBLISH must remain disabled in v1');
  if (item.status !== 'READY' || item.approval?.status !== 'APPROVED') throw new Error('content must be READY and explicitly APPROVED');
  const draft = item.drafts?.find((entry) => entry.platform === platform && entry.approved === true);
  if (!draft) throw new Error(`no approved ${platform} draft`);
  if (!draft.provenance?.length) throw new Error('approved draft has no provenance');
  return draft;
}

export function analyticsObservation({ platform, observedAt, window, metrics, publishedUrl }) {
  if (!['24h', '72h', '7d'].includes(window)) throw new Error('unsupported analytics window');
  const allowed = ['impressions', 'reach', 'comments', 'shares', 'reactions', 'clicks', 'engagement', 'videoViews', 'watchTimeSeconds'];
  return { platform, observedAt, window, publishedUrl, metrics: Object.fromEntries(Object.entries(metrics).filter(([key, value]) => allowed.includes(key) && Number.isFinite(value))) };
}
