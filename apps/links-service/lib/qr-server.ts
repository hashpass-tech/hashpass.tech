import { createClient } from '@supabase/supabase-js';
import { DEFAULT_QR_VISUAL, validateDestination, validateVisualConfig } from '@hashpass/backend';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const shortOrigin = process.env.HASHPASS_LINK_ORIGIN || 'https://hashpass.link';

export function adminDb() {
  if (!url || !serviceKey) throw new Error('QR service is not configured');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticatedUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await adminDb().auth.getUser(token);
  return data.user;
}

export function createInput(body: Record<string, unknown>) {
  const destinationUrl = validateDestination(String(body.destinationUrl || '')).toString();
  const visualConfig = validateVisualConfig({
    ...DEFAULT_QR_VISUAL,
    ...((body.visualConfig as object | undefined) || {}),
  });
  const campaign = (body.campaign as Record<string, string | undefined> | undefined) || {};
  return {
    name: String(body.name || '').trim(),
    description: body.description || null,
    destination_url: destinationUrl,
    expires_at: body.expiresAt || null,
    status: body.status || 'active',
    visual_config: visualConfig,
    campaign_source: campaign.source || null,
    campaign_medium: campaign.medium || null,
    campaign_name: campaign.campaign || null,
    campaign_term: campaign.term || null,
    campaign_content: campaign.content || null,
  };
}

export function patchInput(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if ('name' in body) patch.name = String(body.name || '').trim();
  if ('description' in body) patch.description = body.description || null;
  if ('destinationUrl' in body) patch.destination_url = validateDestination(String(body.destinationUrl)).toString();
  if ('expiresAt' in body) patch.expires_at = body.expiresAt || null;
  if ('status' in body) patch.status = body.status;
  if ('visualConfig' in body) {
    patch.visual_config = validateVisualConfig({
      ...DEFAULT_QR_VISUAL,
      ...(body.visualConfig as object),
    });
  }
  if ('campaign' in body) {
    const campaign = (body.campaign as Record<string, string | undefined> | null) || {};
    patch.campaign_source = campaign.source || null;
    patch.campaign_medium = campaign.medium || null;
    patch.campaign_name = campaign.campaign || null;
    patch.campaign_term = campaign.term || null;
    patch.campaign_content = campaign.content || null;
  }
  return patch;
}

type QrRow = Record<string, any>;
export function serializeQrLink(row: QrRow) {
  const nestedCount = Array.isArray(row.qr_scan_events) ? row.qr_scan_events[0]?.count : undefined;
  return {
    id: row.id,
    publicSlug: row.public_slug,
    shortUrl: `${shortOrigin}/q/${row.public_slug}`,
    name: row.name,
    description: row.description ?? undefined,
    destinationUrl: row.destination_url,
    status: row.status,
    expiresAt: row.expires_at ?? undefined,
    campaign: {
      source: row.campaign_source ?? undefined,
      medium: row.campaign_medium ?? undefined,
      campaign: row.campaign_name ?? undefined,
      term: row.campaign_term ?? undefined,
      content: row.campaign_content ?? undefined,
    },
    visualConfig: row.visual_config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scanCount: Number(row.scan_count ?? nestedCount ?? 0),
    lastScanAt: row.last_scan_at ?? undefined,
  };
}

export const publicSlug = () => randomBytes(9).toString('base64url');
export const apiError = (message: string, status = 400) => Response.json({ message }, { status });
