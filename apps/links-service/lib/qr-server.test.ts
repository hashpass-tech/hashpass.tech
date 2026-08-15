import test from 'node:test';
import assert from 'node:assert/strict';
import { patchInput, serializeQrLink } from './qr-server';

test('partial updates preserve omitted expiration and campaign fields', () => {
  assert.deepEqual(patchInput({ name: 'Renamed' }), { name: 'Renamed' });
});

test('campaign is only cleared when explicitly supplied', () => {
  assert.deepEqual(patchInput({ campaign: null }), {
    campaign_source: null,
    campaign_medium: null,
    campaign_name: null,
    campaign_term: null,
    campaign_content: null,
  });
});

test('serializes database rows to the public SDK resource contract', () => {
  const resource = serializeQrLink({
    id: 'id', public_slug: 'slug1234', name: 'Link', destination_url: 'https://example.com',
    status: 'active', visual_config: {}, created_at: '2026-01-01', updated_at: '2026-01-02',
    qr_scan_events: [{ count: 12 }],
  });
  assert.equal(resource.publicSlug, 'slug1234');
  assert.equal(resource.destinationUrl, 'https://example.com');
  assert.equal(resource.createdAt, '2026-01-01');
  assert.equal(resource.scanCount, 12);
  assert.equal('destination_url' in resource, false);
});
