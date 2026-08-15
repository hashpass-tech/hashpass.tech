import { adminDb, apiError, authenticatedUser } from '../../../../../../lib/qr-server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return apiError('Authentication required', 401);
  const { id } = await params;
  const { data, error } = await adminDb().rpc('qr_link_analytics', {
    p_qr_link_id: id,
    p_owner_id: user.id,
  });
  if (error) return apiError('Unable to load analytics', 500);
  if (!data) return apiError('QR link not found', 404);
  return Response.json(data, { headers: { 'cache-control': 'private, max-age=30' } });
}
