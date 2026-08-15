import { adminDb, apiError, authenticatedUser, patchInput, serializeQrLink } from '../../../../../lib/qr-server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return apiError('Authentication required', 401);
  const { id } = await params;
  const { data, error } = await adminDb().from('qr_links').select('*').eq('id', id).eq('owner_id', user.id).single();
  return error ? apiError('QR link not found', 404) : Response.json(serializeQrLink(data));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return apiError('Authentication required', 401);
  const { id } = await params;
  const db = adminDb();
  const { data: before } = await db.from('qr_links').select('*').eq('id', id).eq('owner_id', user.id).single();
  if (!before) return apiError('QR link not found', 404);
  try {
    const changes = patchInput(await request.json());
    if (!Object.keys(changes).length) return apiError('No supported changes supplied');
    const { data, error } = await db.from('qr_links').update(changes).eq('id', id).eq('owner_id', user.id).select().single();
    if (error) return apiError('Unable to update QR link', 500);
    await db.from('qr_link_audit_events').insert({
      qr_link_id: id,
      actor_id: user.id,
      event_type: 'updated',
      before_summary: { destination_url: before.destination_url, status: before.status, visual_config: before.visual_config },
      after_summary: { destination_url: data.destination_url, status: data.status, visual_config: data.visual_config },
    });
    return Response.json(serializeQrLink(data));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Invalid request');
  }
}
