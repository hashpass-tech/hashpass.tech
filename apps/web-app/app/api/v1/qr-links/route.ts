import { adminDb, apiError, authenticatedUser, normalizeInput, publicSlug, shortOrigin } from '../../../../lib/qr-server';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await authenticatedUser(request); if (!user) return apiError('Authentication required', 401);
  const query = new URL(request.url).searchParams; let dbq = adminDb().from('qr_links').select('*,qr_scan_events(count)').eq('owner_id', user.id).is('deleted_at', null);
  if (query.get('status')) dbq = dbq.eq('status', query.get('status')!); if (query.get('search')) dbq = dbq.ilike('name', `%${query.get('search')}%`);
  const { data, error } = await dbq.order('created_at', { ascending: false }); if (error) return apiError('Unable to load QR links', 500);
  return Response.json(data?.map(row => ({ ...row, shortUrl: `${shortOrigin}/q/${row.public_slug}` })));
}
export async function POST(request: Request) {
  const user = await authenticatedUser(request); if (!user) return apiError('Authentication required', 401);
  try { const input = normalizeInput(await request.json()); if (!input.name || input.name.length > 120) return apiError('Name is required and must be under 120 characters');
    const db = adminDb(); const { data, error } = await db.from('qr_links').insert({ ...input, owner_id: user.id, public_slug: publicSlug() }).select().single();
    if (error) return apiError('Unable to create QR link', 500); await db.from('qr_link_audit_events').insert({ qr_link_id: data.id, actor_id: user.id, event_type: 'created', after_summary: { name: data.name, destination_url: data.destination_url } });
    return Response.json({ ...data, shortUrl: `${shortOrigin}/q/${data.public_slug}` }, { status: 201 });
  } catch (error) { return apiError(error instanceof Error ? error.message : 'Invalid request'); }
}
