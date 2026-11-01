import { getSupabaseServerForRequest } from '@/lib/supabase-server';
import {
  isResolveIdentityError,
  resolveNotificationIdentity,
} from '@/lib/server/resolve-notification-identity';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_KEY_PATTERN = /^[0-9a-f]{64}$/i;
const ENCRYPTED_BACKUP_PATTERN = /^[0-9a-f]{48}:[0-9a-f]{96}$/i;
const SALT_PATTERN = /^[0-9a-f]{32}$/i;
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Vary: 'Authorization',
};

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: PRIVATE_HEADERS });

async function authenticatedUser(request: Request) {
  const identity = await resolveNotificationIdentity(request);
  if (isResolveIdentityError(identity)) {
    return { response: json({ error: identity.error }, identity.status) };
  }
  if (!identity.supabaseUserId || !UUID_PATTERN.test(identity.supabaseUserId)) {
    return { response: json({ error: 'A linked chat identity is required' }, 403) };
  }
  return { userId: identity.supabaseUserId };
}

const isBackupMigrationMissing = (error: { code?: string; message?: string }) =>
  (error.code === '42703' || error.code === 'PGRST204') &&
  /encrypted_private_key_backup|backup_salt|backup_created_at/i.test(error.message || '');

// Chat keys are accessed through the authenticated API so browser clients never
// send user IDs to Supabase RPCs. The caller's own ID always comes from the
// verified server-side identity; only a participant's public key lookup accepts
// a target ID because public keys are intentionally shareable.
export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if ('response' in auth) return auth.response;

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const supabase = getSupabaseServerForRequest(request);

  try {
    if (kind === 'public-key') {
      const participantId = url.searchParams.get('userId') || '';
      if (!UUID_PATTERN.test(participantId)) {
        return json({ error: 'A valid participant ID is required' }, 400);
      }
      const { data, error } = await supabase
        .from('user_chat_keys')
        .select('public_key')
        .eq('user_id', participantId)
        .maybeSingle();
      if (error) throw error;
      return json({
        data: data?.public_key
          ? { success: true, public_key: data.public_key }
          : { success: false, error: 'key_not_found' },
      });
    }

    if (kind !== 'backup') return json({ error: 'A valid chat key query is required' }, 400);

    const { data, error } = await supabase
      .from('user_chat_keys')
      .select('encrypted_private_key_backup,backup_salt,backup_created_at')
      .eq('user_id', auth.userId)
      .maybeSingle();
    if (error) {
      // A production DB may be one migration behind during rollout. The public
      // key table predates backups, so keep first-time chat setup available and
      // treat backup as absent until its migration has been applied.
      if (isBackupMigrationMissing(error)) {
        return json({ data: { success: false, error: 'no_backup', backup_available: false } });
      }
      throw error;
    }

    if (!data?.encrypted_private_key_backup) {
      return json({ data: { success: false, error: 'no_backup', backup_available: true } });
    }
    return json({
      data: {
        success: true,
        encrypted_private_key: data.encrypted_private_key_backup,
        salt: data.backup_salt,
        created_at: data.backup_created_at,
      },
    });
  } catch (error) {
    console.error('[chat-keys] unable to read chat keys:', error);
    return json({ error: 'Unable to load chat keys' }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticatedUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: 'A JSON body is required' }, 400);

  const supabase = getSupabaseServerForRequest(request);
  try {
    if (body.action === 'publish-public-key') {
      if (typeof body.publicKey !== 'string' || !PUBLIC_KEY_PATTERN.test(body.publicKey)) {
        return json({ error: 'A valid X25519 public key is required' }, 400);
      }
      const { data, error } = await supabase.rpc('publish_user_chat_public_key', {
        p_user_id: auth.userId,
        p_public_key: body.publicKey,
      });
      if (error) throw error;
      if (!data?.success) return json({ data }, 400);
      return json({ data });
    }

    if (body.action === 'reset-public-key') {
      if (
        typeof body.expectedPublicKey !== 'string' || !PUBLIC_KEY_PATTERN.test(body.expectedPublicKey) ||
        typeof body.publicKey !== 'string' || !PUBLIC_KEY_PATTERN.test(body.publicKey)
      ) {
        return json({ error: 'Valid current and replacement X25519 public keys are required' }, 400);
      }
      const { data, error } = await supabase.rpc('reset_user_chat_public_key', {
        p_user_id: auth.userId,
        p_expected_public_key: body.expectedPublicKey,
        p_public_key: body.publicKey,
      });
      if (error) throw error;
      if (!data?.success) return json({ data }, 409);
      return json({ data });
    }

    if (body.action !== 'store-backup') return json({ error: 'A valid chat key action is required' }, 400);
    if (
      typeof body.encryptedPrivateKey !== 'string' || !ENCRYPTED_BACKUP_PATTERN.test(body.encryptedPrivateKey) ||
      typeof body.salt !== 'string' || !SALT_PATTERN.test(body.salt)
    ) {
      return json({ error: 'A valid encrypted chat key backup is required' }, 400);
    }

    const { data, error } = await supabase
      .from('user_chat_keys')
      .update({
        encrypted_private_key_backup: body.encryptedPrivateKey,
        backup_salt: body.salt,
        backup_created_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId)
      .select('user_id')
      .maybeSingle();
    if (error) {
      if (isBackupMigrationMissing(error)) {
        return json({ error: 'Chat key backup is not available on this server yet' }, 503);
      }
      throw error;
    }
    if (!data) return json({ data: { success: false, error: 'no_key_pair' } }, 409);
    return json({ data: { success: true } });
  } catch (error) {
    console.error('[chat-keys] unable to save chat keys:', error);
    return json({ error: 'Unable to save chat keys' }, 500);
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticatedUser(request);
  if ('response' in auth) return auth.response;

  try {
    const { error } = await getSupabaseServerForRequest(request)
      .from('user_chat_keys')
      .update({
        encrypted_private_key_backup: null,
        backup_salt: null,
        backup_created_at: null,
      })
      .eq('user_id', auth.userId);
    if (error) {
      if (isBackupMigrationMissing(error)) {
        return json({ error: 'Chat key backup is not available on this server yet' }, 503);
      }
      throw error;
    }
    return json({ data: { success: true } });
  } catch (error) {
    console.error('[chat-keys] unable to delete chat key backup:', error);
    return json({ error: 'Unable to delete chat key backup' }, 500);
  }
}
