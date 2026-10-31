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
        currentParticipant: null,
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
});
