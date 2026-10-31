import { getSupabaseServerForRequest } from '@/lib/supabase-server';
import {
  isResolveIdentityError,
  resolveNotificationIdentity,
} from '@/lib/server/resolve-notification-identity';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_PATTERN = /^[0-9a-f]+$/i;
const NONCE_PATTERN = /^[0-9a-f]{48}$/i;
const MAX_CIPHERTEXT_LENGTH = 8192;
const MESSAGE_TYPES = new Set(['text', 'system', 'meeting_update']);
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Vary: 'Authorization',
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: PRIVATE_HEADERS });

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

async function requireMeetingParticipant(supabase: any, meetingId: string, userId: string) {
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('id,requester_id,host_id,attendee_id,speaker_id')
    .eq('id', meetingId)
    .maybeSingle();
  if (error) throw error;
  if (!meeting) return json({ error: 'Meeting not found' }, 404);

  if ([meeting.requester_id, meeting.host_id, meeting.attendee_id].includes(userId)) {
    return null;
  }

  if (meeting.speaker_id) {
    const { data: speaker, error: speakerError } = await supabase
      .from('bsl_speakers')
      .select('user_id')
      .eq('id', meeting.speaker_id)
      .maybeSingle();
    if (speakerError) throw speakerError;
    if (speaker?.user_id === userId) return null;
  }

  return json({ error: 'Not a meeting participant' }, 403);
}

// GET /api/meetings/chat?meetingId=<uuid>&kind=messages|last-seen|participants
// The browser receives ciphertext only. Both identity and meeting membership
// are resolved here before the service-role client invokes a database RPC.
export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if ('response' in auth) return auth.response;

  const url = new URL(request.url);
  const meetingId = url.searchParams.get('meetingId') || '';
  if (!UUID_PATTERN.test(meetingId)) return json({ error: 'A valid meeting ID is required' }, 400);

  const supabase = getSupabaseServerForRequest(request) as any;
  try {
    const accessError = await requireMeetingParticipant(supabase, meetingId, auth.userId);
    if (accessError) return accessError;

    const kind = url.searchParams.get('kind') || 'messages';
    if (kind === 'participants') {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('id,speaker_id,requester_id,requester_name,speaker_name')
        .eq('id', meetingId)
        .maybeSingle();
      if (meetingError) throw meetingError;
      if (!meeting) return json({ error: 'Meeting not found' }, 404);

      const { data: speaker, error: speakerError } = await supabase
        .from('bsl_speakers')
        .select('user_id,name,imageurl')
        .eq('id', meeting.speaker_id)
        .maybeSingle();
      if (speakerError) throw speakerError;

      const isRequester = meeting.requester_id === auth.userId;
      const otherParticipantId = isRequester ? speaker?.user_id : meeting.requester_id;
      const otherName = isRequester
        ? (meeting.speaker_name || speaker?.name || 'User')
        : (meeting.requester_name || 'User');
      let otherAvatar = isRequester ? speaker?.imageurl || null : null;
      let otherParticipantName = otherName;

      if (otherParticipantId) {
        const { data: profile, error: profileError } = await supabase.rpc('get_meeting_chat_participant', {
          p_meeting_id: meetingId,
          p_other_user_id: otherParticipantId,
        });
        if (profileError) throw profileError;
        if (profile?.success) {
          otherParticipantName = profile.name || otherName;
          otherAvatar = profile.avatar_url || otherAvatar;
        }
      }

      return json({
        data: {
          success: true,
          otherParticipant: otherParticipantId
            ? { id: otherParticipantId, name: otherParticipantName, avatar: otherAvatar }
            : null,
          currentParticipant: isRequester
            ? null
            : { name: speaker?.name || meeting.speaker_name || null, avatar: speaker?.imageurl || null },
        },
      });
    }

    if (kind === 'messages') {
      const { data, error } = await supabase.rpc('get_meeting_chat_messages', {
        p_meeting_id: meetingId,
        p_user_id: auth.userId,
      });
      if (error) throw error;
      if (!data?.success) return json({ error: data?.error || 'Failed to load messages' }, 403);
      return json({ data });
    }

    if (kind === 'last-seen') {
      const participantId = url.searchParams.get('participantId') || '';
      if (!UUID_PATTERN.test(participantId)) {
        return json({ error: 'A valid participant ID is required' }, 400);
      }
      const participantError = await requireMeetingParticipant(supabase, meetingId, participantId);
      if (participantError) return json({ error: 'Participant not found in this meeting' }, 404);

      const { data, error } = await supabase.rpc('get_chat_last_seen', {
        p_user_id: participantId,
        p_meeting_id: meetingId,
      });
      if (error) throw error;
      if (!data?.success) return json({ error: data?.error || 'Failed to load participant status' }, 500);
      return json({ data });
    }

    return json({ error: 'A valid chat query is required' }, 400);
  } catch (error) {
    console.error('[meeting-chat] unable to load chat:', error);
    return json({ error: 'Unable to load chat' }, 500);
  }
}

// POST /api/meetings/chat — authenticated send or last-seen update.
export async function POST(request: Request) {
  const auth = await authenticatedUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: 'A JSON body is required' }, 400);

  const meetingId = typeof body.meetingId === 'string' ? body.meetingId : '';
  if (!UUID_PATTERN.test(meetingId)) return json({ error: 'A valid meeting ID is required' }, 400);

  const supabase = getSupabaseServerForRequest(request) as any;
  try {
    const accessError = await requireMeetingParticipant(supabase, meetingId, auth.userId);
    if (accessError) return accessError;

    if (body.action === 'send') {
      const ciphertext = typeof body.ciphertext === 'string' ? body.ciphertext : '';
      const nonce = typeof body.nonce === 'string' ? body.nonce : '';
      const messageType = typeof body.messageType === 'string' ? body.messageType : 'text';
      if (
        !ciphertext || ciphertext.length > MAX_CIPHERTEXT_LENGTH ||
        ciphertext.length % 2 !== 0 || !HEX_PATTERN.test(ciphertext) ||
        !NONCE_PATTERN.test(nonce) || !MESSAGE_TYPES.has(messageType)
      ) {
        return json({ error: 'A valid encrypted message is required' }, 400);
      }

      const { data, error } = await supabase.rpc('send_meeting_chat_message', {
        p_meeting_id: meetingId,
        p_sender_id: auth.userId,
        p_ciphertext: ciphertext,
        p_nonce: nonce,
        p_message_type: messageType,
      });
      if (error) throw error;
      if (!data?.success) return json({ error: data?.error || 'Failed to send message' }, 403);
      return json({ data });
    }

    if (body.action === 'touch') {
      const { data: updateData, error: updateError } = await supabase.rpc('update_chat_last_seen', {
        p_user_id: auth.userId,
        p_meeting_id: meetingId,
      });
      if (updateError) throw updateError;
      if (!updateData?.success) return json({ error: updateData?.error || 'Failed to update chat presence' }, 500);

      let otherLastSeenAt: string | null = null;
      if (body.otherParticipantId !== undefined) {
        const participantId = typeof body.otherParticipantId === 'string' ? body.otherParticipantId : '';
        if (!UUID_PATTERN.test(participantId)) {
          return json({ error: 'A valid participant ID is required' }, 400);
        }
        const participantError = await requireMeetingParticipant(supabase, meetingId, participantId);
        if (participantError) return json({ error: 'Participant not found in this meeting' }, 404);
        const { data: seenData, error: seenError } = await supabase.rpc('get_chat_last_seen', {
          p_user_id: participantId,
          p_meeting_id: meetingId,
        });
        if (seenError) throw seenError;
        if (!seenData?.success) return json({ error: seenData?.error || 'Failed to load participant status' }, 500);
        otherLastSeenAt = seenData.last_seen_at || null;
      }

      return json({ data: { success: true, otherLastSeenAt } });
    }

    return json({ error: 'A valid chat action is required' }, 400);
  } catch (error) {
    console.error('[meeting-chat] unable to update chat:', error);
    return json({ error: 'Unable to update chat' }, 500);
  }
}
