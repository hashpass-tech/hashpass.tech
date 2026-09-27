import { stableExternalId } from './domain.mjs';

export function contentItemFromSignal(signal, { platforms = ['linkedin'], languages = ['en'], owner = null } = {}) {
  if (signal.classification?.decision !== 'qualified') throw new Error('only qualified signals can become content items');
  return {
    schemaVersion: '1.0', contentId: `cnt_${stableExternalId('content', signal.signalId).slice(4)}`, brand: 'hashpass-corporate', persona: 'corporate',
    title: signal.title, source: signal.source, campaign: null, contentPillar: signal.classification.contentPillar,
    objective: null, platforms, languages, format: 'text', owner, status: 'SOURCE VERIFIED',
    publicationWindow: { earliest: null, latest: null }, approval: { required: true, status: 'PENDING', approvedBy: null, approvedAt: null },
    drafts: [], metricool: { schedules: [], publications: [] }, publishedUrls: [], analytics: [], repurposingLinks: [], evidence: signal.evidence,
    maturity: signal.classification.maturity, audit: [...signal.audit, { action: 'content.created', at: new Date().toISOString(), actor: 'pipeline' }],
  };
}

export function applyDrafts(item, drafts, { model, promptVersion }) {
  if (!['SOURCE VERIFIED', 'DRAFTING'].includes(item.status)) throw new Error('drafting requires a verified source');
  for (const draft of drafts) {
    if (!item.platforms.includes(draft.platform)) throw new Error(`unexpected platform ${draft.platform}`);
    if (!draft.provenance?.length) throw new Error('every draft requires provenance');
  }
  return { ...item, status: 'REVIEW', drafts: drafts.map((draft, index) => ({ ...draft, version: index + 1, approved: false, generator: { model, promptVersion } })), audit: [...item.audit, { action: 'draft.generated', at: new Date().toISOString(), actor: model }] };
}

export function approveDraft(item, platform, actor) {
  if (item.status !== 'REVIEW') throw new Error('approval requires REVIEW');
  if (!actor) throw new Error('human approver is required');
  let found = false;
  const drafts = item.drafts.map((draft) => draft.platform === platform ? (found = true, { ...draft, approved: true }) : draft);
  if (!found) throw new Error(`no ${platform} draft`);
  const at = new Date().toISOString();
  return { ...item, status: 'READY', drafts, approval: { required: true, status: 'APPROVED', approvedBy: actor, approvedAt: at }, audit: [...item.audit, { action: 'draft.approved', at, actor, platform }] };
}
