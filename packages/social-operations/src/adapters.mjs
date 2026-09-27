import { assertPublishable } from './domain.mjs';

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error(`request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}

export class PlaneContentStore {
  constructor({ baseUrl, workspaceSlug, projectId, apiKey }) {
    Object.assign(this, { baseUrl: baseUrl.replace(/\/$/, ''), workspaceSlug, projectId, apiKey });
  }
  get endpoint() { return `${this.baseUrl}/api/v1/workspaces/${encodeURIComponent(this.workspaceSlug)}/projects/${encodeURIComponent(this.projectId)}/work-items`; }
  async findByContentId(contentId) {
    const result = await jsonRequest(`${this.endpoint}/?search=${encodeURIComponent(contentId)}`, { headers: { 'x-api-key': this.apiKey } });
    return (result.results ?? result ?? []).find((item) => `${item.name}\n${item.description_html ?? ''}`.includes(contentId)) ?? null;
  }
  async upsert(item) {
    const existing = await this.findByContentId(item.contentId);
    const body = { name: `[${item.contentId}] ${item.title}`, description_html: renderPlaneDescription(item) };
    return jsonRequest(existing ? `${this.endpoint}/${existing.id}/` : `${this.endpoint}/`, {
      method: existing ? 'PATCH' : 'POST', headers: { 'x-api-key': this.apiKey }, body: JSON.stringify(body),
    });
  }
}

export function renderPlaneDescription(item) {
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const safe = JSON.stringify(item).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<h2>Social content record</h2><p><strong>Content ID:</strong> ${escape(item.contentId)}</p><p><strong>Source:</strong> <a href="${escape(item.source.url)}">${escape(item.source.type)}</a></p><p><strong>Status:</strong> ${escape(item.status)}</p><h3>Machine-readable record</h3><pre data-hashpass-social-schema="1.0">${safe}</pre>`;
}

export class SocialPublisher { async schedule() { throw new Error('not implemented'); } async publication() { throw new Error('not implemented'); } async analytics() { throw new Error('not implemented'); } }

export class MetricoolMcpPublisher extends SocialPublisher {
  constructor({ endpoint, bearerToken, brandId, tools = {} }) { super(); Object.assign(this, { endpoint, bearerToken, brandId, tools: { schedule: 'schedule_post', publication: 'get_post', analytics: 'get_post_analytics', bestTimes: 'get_best_times', ...tools } }); }
  async call(tool, args) {
    const response = await jsonRequest(this.endpoint, { method: 'POST', headers: { authorization: `Bearer ${this.bearerToken}` }, body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name: tool, arguments: args } }) });
    if (response.error) throw new Error(`Metricool MCP error: ${response.error.message ?? response.error.code}`);
    return response;
  }
  async schedule(item, platform, publishAt) {
    const draft = assertPublishable(item, platform);
    const idempotencyKey = `schedule:${item.contentId}:${platform}:${draft.version}`;
    const result = await this.call(this.tools.schedule, { brandId: this.brandId, platform, text: draft.text, media: draft.media ?? [], publishAt, idempotencyKey });
    return { provider: 'metricool', idempotencyKey, response: result.result ?? result };
  }
  publication(reference) { return this.call(this.tools.publication, { brandId: this.brandId, reference }); }
  analytics(reference) { return this.call(this.tools.analytics, { brandId: this.brandId, reference }); }
  bestTimes(platform) { return this.call(this.tools.bestTimes, { brandId: this.brandId, platform }); }
}
