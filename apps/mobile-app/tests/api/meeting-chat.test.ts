/// <reference types="jest" />

const mockResolveIdentity = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();
const userId = '7f60f5d2-5948-4df1-9670-2f9177cf2fe4';
const otherUserId = 'd17d434e-a5b4-4f8f-a3ac-cd3834775ce7';
const meetingId = '09e1b369-0a51-4474-bfd1-86d44d5f2fd1';

jest.mock('@/lib/server/resolve-notification-identity', () => ({
  resolveNotificationIdentity: (...args: unknown[]) => mockResolveIdentity(...args),
  isResolveIdentityError: (value: { status?: unknown }) => typeof value?.status === 'number',
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseServerForRequest: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

const makeQuery = (result: { data?: unknown; error?: unknown }) => {
  const query: Record<string, any> = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return query;
};

describe('/api/meetings/chat', () => {
  beforeEach(() => {
    jest.resetModules();
    mockResolveIdentity.mockReset().mockResolvedValue({ supabaseUserId: userId });
    mockFrom.mockReset().mockImplementation(() => makeQuery({
      data: { id: meetingId, requester_id: userId, host_id: null, attendee_id: otherUserId, speaker_id: null },
      error: null,
    }));
    mockRpc.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  });

  it('requires a linked authenticated user before reading or writing chat data', async () => {
    mockResolveIdentity.mockResolvedValue({ supabaseUserId: null });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET, POST } = require('../../app/api/meetings/chat+api');

    const getResponse = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}`,
    ));
    const postResponse = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'send', meetingId }),
    }));

    expect(getResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fetches ciphertext through the server-resolved identity', async () => {
    const messages = [{ id: 'message-1', sender_id: otherUserId, ciphertext: 'abcd', nonce: 'f'.repeat(48) }];
    mockRpc.mockResolvedValue({ data: { success: true, messages }, error: null });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/meetings/chat+api');

    const response = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=messages`,
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { success: true, messages } });
    expect(mockRpc).toHaveBeenCalledWith('get_meeting_chat_messages', {
      p_meeting_id: meetingId,
      p_user_id: userId,
    });
  });

  it('resolves both participant profiles on the authenticated server boundary', async () => {
    mockFrom.mockImplementation((table: string) => makeQuery({
      data: table === 'bsl_speakers'
        ? { user_id: otherUserId, name: 'Speaker record', imageurl: 'https://cdn.example.com/speaker.png' }
        : { id: meetingId, requester_id: userId, requester_name: 'Requester', speaker_name: 'Speaker', speaker_id: 'speaker-row', host_id: null, attendee_id: null },
      error: null,
    }));
    mockRpc.mockResolvedValue({
      data: { success: true, name: 'Speaker profile', avatar_url: 'https://cdn.example.com/profile.png' },
      error: null,
    });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/meetings/chat+api');

    const response = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=participants`,
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        success: true,
        otherParticipant: {
          id: otherUserId,
          name: 'Speaker profile',
          avatar: 'https://cdn.example.com/profile.png',
        },
        currentParticipant: { id: userId, name: 'Requester', avatar: null },
      },
    });
    expect(mockRpc).toHaveBeenCalledWith('get_meeting_chat_participant', {
      p_meeting_id: meetingId,
      p_other_user_id: otherUserId,
    });
  });

  it('uses the authenticated identity as sender even if the body supplies another ID', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, id: 'message-2', created_at: '2026-10-31T12:00:00.000Z' },
      error: null,
    });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/meetings/chat+api');

    const response = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({
        action: 'send',
        meetingId,
        senderId: otherUserId,
        ciphertext: 'abcd',
        nonce: 'a'.repeat(48),
        messageType: 'text',
      }),
    }));

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('send_meeting_chat_message', {
      p_meeting_id: meetingId,
      p_sender_id: userId,
      p_ciphertext: 'abcd',
      p_nonce: 'a'.repeat(48),
      p_message_type: 'text',
    });
  });

  it('updates and reads presence only for participants in the meeting', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: { success: true }, error: null })
      .mockResolvedValueOnce({ data: { success: true, last_seen_at: '2026-10-31T12:00:00.000Z' }, error: null });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/meetings/chat+api');

    const response = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'touch', meetingId, otherParticipantId: otherUserId }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { success: true, otherLastSeenAt: '2026-10-31T12:00:00.000Z' },
    });
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'update_chat_last_seen', {
      p_user_id: userId,
      p_meeting_id: meetingId,
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'get_chat_last_seen', {
      p_user_id: otherUserId,
      p_meeting_id: meetingId,
    });
  });

  it('rejects non-participants and malformed encrypted messages before calling RPCs', async () => {
    mockFrom.mockReturnValue(makeQuery({
      data: { id: meetingId, requester_id: otherUserId, host_id: null, attendee_id: null, speaker_id: null },
      error: null,
    }));
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET, POST } = require('../../app/api/meetings/chat+api');

    const getResponse = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}`,
    ));
    expect(getResponse.status).toBe(403);

    mockFrom.mockImplementation(() => makeQuery({
      data: { id: meetingId, requester_id: userId, host_id: null, attendee_id: null, speaker_id: null },
      error: null,
    }));
    const postResponse = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'send', meetingId, ciphertext: 'not-hex', nonce: 'bad' }),
    }));

    expect(postResponse.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('validates request IDs and malformed JSON before accessing meeting data', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET, POST } = require('../../app/api/meetings/chat+api');

    const getResponse = await GET(new Request('https://api.hashpass.tech/api/meetings/chat?meetingId=bad'));
    const malformedBodyResponse = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: '{',
    }));
    const invalidMeetingResponse = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'send', meetingId: 'bad' }),
    }));

    expect(getResponse.status).toBe(400);
    expect(malformedBodyResponse.status).toBe(400);
    expect(invalidMeetingResponse.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('allows the linked speaker account and rejects missing or inaccessible meetings', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'meetings') return makeQuery({
        data: { id: meetingId, requester_id: otherUserId, host_id: null, attendee_id: null, speaker_id: 'speaker-row' },
        error: null,
      });
      return makeQuery({ data: { user_id: userId }, error: null });
    });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/meetings/chat+api');

    const speakerResponse = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=messages`,
    ));
    expect(speakerResponse.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('get_meeting_chat_messages', {
      p_meeting_id: meetingId,
      p_user_id: userId,
    });

    mockFrom.mockImplementation((table: string) => makeQuery({
      data: table === 'meetings'
        ? { id: meetingId, requester_id: otherUserId, host_id: null, attendee_id: null, speaker_id: 'speaker-row' }
        : { user_id: otherUserId },
      error: null,
    }));
    const forbiddenResponse = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}`,
    ));
    expect(forbiddenResponse.status).toBe(403);

    mockFrom.mockReturnValue(makeQuery({ data: null, error: null }));
    const missingResponse = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}`,
    ));
    expect(missingResponse.status).toBe(404);
  });

  it('returns the speaker profile when the current user is the speaker', async () => {
    mockFrom.mockImplementation((table: string) => makeQuery({
      data: table === 'bsl_speakers'
        ? { user_id: userId, name: 'Speaker', imageurl: 'https://cdn.example.com/speaker.png' }
        : { id: meetingId, requester_id: otherUserId, requester_name: 'Requester', speaker_name: 'Speaker', speaker_id: 'speaker-row', host_id: null, attendee_id: userId },
      error: null,
    }));
    mockRpc.mockResolvedValue({ data: { success: true, name: 'Requester profile', avatar_url: 'https://cdn.example.com/requester.png' }, error: null });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/meetings/chat+api');

    const response = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=participants`,
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        success: true,
        otherParticipant: {
          id: otherUserId,
          name: 'Requester profile',
          avatar: 'https://cdn.example.com/requester.png',
        },
        currentParticipant: { id: userId, name: 'Speaker', avatar: 'https://cdn.example.com/speaker.png' },
      },
    });
  });

  it('validates query kinds, participant IDs, and RPC failures', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/meetings/chat+api');

    const unknownKind = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=unknown`,
    ));
    const invalidLastSeenId = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=last-seen&participantId=bad`,
    ));
    expect(unknownKind.status).toBe(400);
    expect(invalidLastSeenId.status).toBe(400);

    mockRpc.mockResolvedValueOnce({ data: { success: false, error: 'not available' }, error: null });
    const failedMessages = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=messages`,
    ));
    expect(failedMessages.status).toBe(403);

    mockFrom.mockReturnValue(makeQuery({
      data: { id: meetingId, requester_id: userId, host_id: null, attendee_id: null, speaker_id: null },
      error: null,
    }));
    const absentParticipant = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=last-seen&participantId=${otherUserId}`,
    ));
    expect(absentParticipant.status).toBe(404);

    mockFrom.mockImplementation(() => makeQuery({
      data: { id: meetingId, requester_id: userId, host_id: null, attendee_id: otherUserId, speaker_id: null },
      error: null,
    }));
    mockRpc.mockResolvedValueOnce({ data: { success: true, last_seen_at: '2026-10-31T12:00:00.000Z' }, error: null });
    const lastSeenResponse = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=last-seen&participantId=${otherUserId}`,
    ));
    expect(lastSeenResponse.status).toBe(200);

    mockRpc.mockResolvedValueOnce({ data: { success: false, error: 'lookup failed' }, error: null });
    const failedLastSeen = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}&kind=last-seen&participantId=${otherUserId}`,
    ));
    expect(failedLastSeen.status).toBe(500);
  });

  it('validates send actions and returns database failures safely', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/meetings/chat+api');

    const unknownAction = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'unknown', meetingId }),
    }));
    expect(unknownAction.status).toBe(400);

    mockRpc.mockResolvedValueOnce({ data: { success: false, error: 'send denied' }, error: null });
    const rejectedSend = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'send', meetingId, ciphertext: 'ab', nonce: 'a'.repeat(48) }),
    }));
    expect(rejectedSend.status).toBe(403);

    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('rpc unavailable') });
    const failedSend = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'send', meetingId, ciphertext: 'ab', nonce: 'a'.repeat(48) }),
    }));
    expect(failedSend.status).toBe(500);
  });

  it('validates presence participants and handles touch RPC outcomes', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { POST } = require('../../app/api/meetings/chat+api');

    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    const touchWithoutPeer = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'touch', meetingId }),
    }));
    expect(touchWithoutPeer.status).toBe(200);

    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    const invalidPeer = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'touch', meetingId, otherParticipantId: 'bad' }),
    }));
    expect(invalidPeer.status).toBe(400);

    mockRpc.mockResolvedValueOnce({ data: { success: false, error: 'presence denied' }, error: null });
    const failedTouch = await POST(new Request('https://api.hashpass.tech/api/meetings/chat', {
      method: 'POST',
      body: JSON.stringify({ action: 'touch', meetingId }),
    }));
    expect(failedTouch.status).toBe(500);
  });

  it('returns a safe server error when meeting access lookup fails', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: null, error: new Error('db unavailable') }));
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { GET } = require('../../app/api/meetings/chat+api');

    const response = await GET(new Request(
      `https://api.hashpass.tech/api/meetings/chat?meetingId=${meetingId}`,
    ));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Unable to load chat' });
  });
});
