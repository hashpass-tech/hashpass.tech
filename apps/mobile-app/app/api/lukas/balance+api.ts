import { getSupabaseServerForRequest } from '@/lib/supabase-server';
import {
  isResolveIdentityError,
  resolveNotificationIdentity,
} from '@/lib/server/resolve-notification-identity';

const TOKEN_SYMBOL_PATTERN = /^[A-Z0-9]{2,12}$/;

/**
 * Return the signed-in user's reward balance. The user ID is always resolved
 * from the authenticated server-side identity; clients must never provide a
 * Supabase UUID or query user_balances directly.
 */
export async function GET(request: Request) {
  const identity = await resolveNotificationIdentity(request);
  if (isResolveIdentityError(identity)) {
    return Response.json({ error: identity.error }, { status: identity.status });
  }
  if (!identity.supabaseUserId) {
    return Response.json(
      { error: 'Account is not linked to a rewards identity' },
      { status: 403 },
    );
  }

  const tokenSymbol = (new URL(request.url).searchParams.get('tokenSymbol') || 'LUKAS')
    .trim()
    .toUpperCase();
  if (!TOKEN_SYMBOL_PATTERN.test(tokenSymbol)) {
    return Response.json({ error: 'A valid token symbol is required' }, { status: 400 });
  }

  try {
    const { data, error } = await getSupabaseServerForRequest(request)
      .from('user_balances')
      .select('balance')
      .eq('user_id', identity.supabaseUserId)
      .eq('token_symbol', tokenSymbol)
      .maybeSingle();

    if (error) throw error;
    const balance = Number(data?.balance ?? 0);
    if (!Number.isFinite(balance)) throw new Error('Balance is not numeric');

    return Response.json(
      { data: { balance, tokenSymbol } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[lukas-balance] unable to load balance:', error);
    return Response.json({ error: 'Unable to load rewards balance' }, { status: 500 });
  }
}
