/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports, import/first */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockShowError = jest.fn();
const mockMeeting = {
  id: 'meeting-1',
  speaker_id: 'speaker-profile-1',
  requester_id: 'requester-1',
  requester_name: 'Requester',
  speaker_name: 'Speaker',
  status: 'confirmed',
  scheduled_at: '2026-10-31T10:00:00Z',
};
const mockSpeaker = {
  user_id: 'speaker-1',
  name: 'Speaker profile name',
  imageurl: 'https://cdn.example.com/speaker.png',
};
let mockDbUserId = 'requester-1';

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

jest.mock(
  'react-native-css-interop/src/runtime/native/appearance-observables',
  () => ({
    addChangeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeChangeListener: jest.fn(),
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
  }),
  { virtual: true },
);

jest.mock('react-native-css-interop/jsx-runtime', () => require('react/jsx-runtime'));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: { primary: '#af0d01', background: { default: '#ffffff' }, text: { secondary: '#565963' } },
  }),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    dbUserId: mockDbUserId,
    isLoading: false,
    user: { email: 'requester@example.com', user_metadata: { full_name: 'Requester' } },
  }),
}));

jest.mock('../../contexts/ToastContext', () => ({
  useToastHelpers: () => ({ showError: mockShowError }),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('../../components/RealtimeChat', () => 'RealtimeChat');

import MeetingChat from '../../components/MeetingChat';

const makeQuery = () => {
  const query: Record<string, any> = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => ({ data: mockMeeting, error: null })),
    maybeSingle: jest.fn(async () => ({ data: mockSpeaker, error: null })),
  };
  return query;
};

async function renderMeetingChat() {
  let view!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    view = TestRenderer.create(<MeetingChat meetingId="meeting-1" onClose={jest.fn()} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  mockDbUserId = 'requester-1';
  mockFrom.mockReset().mockImplementation(() => makeQuery());
  mockRpc.mockReset().mockImplementation(async (functionName: string) => {
    if (functionName === 'get_meeting_chat_participant') {
      return { data: { success: true, name: null, avatar_url: null }, error: null };
    }
    return { data: { success: true }, error: null };
  });
});

it('passes the canonical speaker photo to requester-side chat if profile lookup omits it', async () => {
  const view = await renderMeetingChat();

  const chat = view.root.findByType('RealtimeChat' as any);
  expect(chat.props.otherParticipantId).toBe('speaker-1');
  expect(chat.props.otherParticipantAvatar).toBe(mockSpeaker.imageurl);
  expect(chat.props.otherParticipantName).toBe('Speaker');
  expect(chat.props.currentUserAvatar).toBeUndefined();

  await act(async () => view.unmount());
});

it('uses the speaker profile photo for the speaker’s own messages and the requester profile for the peer', async () => {
  mockDbUserId = 'speaker-1';
  mockRpc.mockImplementation(async (functionName: string) => {
    if (functionName === 'get_meeting_chat_participant') {
      return { data: { success: true, name: 'Requester profile', avatar_url: 'https://cdn.example.com/requester.png' }, error: null };
    }
    return { data: { success: true }, error: null };
  });

  const view = await renderMeetingChat();

  const chat = view.root.findByType('RealtimeChat' as any);
  expect(chat.props.username).toBe(mockSpeaker.name);
  expect(chat.props.currentUserAvatar).toBe(mockSpeaker.imageurl);
  expect(chat.props.otherParticipantId).toBe('requester-1');
  expect(chat.props.otherParticipantAvatar).toBe('https://cdn.example.com/requester.png');

  await act(async () => view.unmount());
});

it('clears the peer when the speaker profile has no linked chat user', async () => {
  mockFrom.mockImplementation((table: string) => {
    const query = makeQuery();
    if (table === 'bsl_speakers') {
      query.maybeSingle = jest.fn(async () => ({
        data: { ...mockSpeaker, user_id: null },
        error: null,
      }));
    }
    return query;
  });

  const view = await renderMeetingChat();

  const chat = view.root.findByType('RealtimeChat' as any);
  expect(chat.props.otherParticipantId).toBeUndefined();
  expect(mockRpc).not.toHaveBeenCalledWith('get_meeting_chat_participant', expect.anything());

  await act(async () => view.unmount());
});
