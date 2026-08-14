import { createClient } from '@supabase/supabase-js';
import { validateDestination, validateVisualConfig, DEFAULT_QR_VISUAL } from '@hashpass/backend';
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
  const { data } = await adminDb().auth.getUser(token); return data.user;
}
export function normalizeInput(body: Record<string, unknown>) {
  const destinationUrl = validateDestination(String(body.destinationUrl || '')).toString();
  const visual = validateVisualConfig({ ...DEFAULT_QR_VISUAL, ...(body.visualConfig as object || {}) });
  return { name: String(body.name || '').trim(), description: body.description || null, destination_url: destinationUrl,
    expires_at: body.expiresAt || null, status: body.status || 'active', visual_config: visual,
    campaign_source: (body.campaign as Record<string,string>)?.source || null, campaign_medium: (body.campaign as Record<string,string>)?.medium || null,
    campaign_name: (body.campaign as Record<string,string>)?.campaign || null, campaign_term: (body.campaign as Record<string,string>)?.term || null,
    campaign_content: (body.campaign as Record<string,string>)?.content || null };
}
export const publicSlug = () => randomBytes(9).toString('base64url');
export const apiError = (message: string, status = 400) => Response.json({ message }, { status });
