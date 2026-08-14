import { getSupabaseServerForRequest } from '@/lib/supabase-server';
import { isResolveIdentityError, resolveNotificationIdentity } from '@/lib/server/resolve-notification-identity';
import { listMyMoments } from '@/lib/moments/supabase-repository';
import { requireMomentsEnabled } from '@/lib/moments/flags';
export async function GET(request: Request) { const disabled = requireMomentsEnabled(); if (disabled) return disabled; const identity = await resolveNotificationIdentity(request); if (isResolveIdentityError(identity)) return Response.json({ error: identity.error }, { status: identity.status }); if (!identity.supabaseUserId) return Response.json({ error:'Account not linked' }, { status:403 }); const items = await listMyMoments(getSupabaseServerForRequest(request), identity.supabaseUserId); return Response.json({ items }); }
