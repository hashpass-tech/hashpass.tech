/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports, import/first */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockApiRequest = jest.fn();
const mockShowError = jest.fn();
const mockSpeaker = {
  user_id: 'speaker-1',
  name: 'Speaker profile name',
  imageurl: 'https://cdn.example.com/speaker.png',
};
let mockDbUserId = 'requester-1';
let mockParticipantData: any;

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

jest.mock('../../lib/api-client', () => ({
  apiClient: { request: (...args: unknown[]) => mockApiRequest(...args) },
}));

jest.mock('../../components/RealtimeChat', () => 'RealtimeChat');

import MeetingChat from '../../components/MeetingChat';

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
  mockParticipantData = {
    success: true,
    otherParticipant: { id: 'speaker-1', name: 'Speaker', avatar: mockSpeaker.imageurl },
    currentParticipant: null,
  };
  mockApiRequest.mockReset().mockImplementation(async () => ({
    success: true,
    data: { data: mockParticipantData },
  }));
});

it('loads the canonical speaker profile through the authenticated chat API', async () => {
  const view = await renderMeetingChat();

  const chat = view.root.findByType('RealtimeChat' as any);
  expect(mockApiRequest).toHaveBeenCalledWith('meetings/chat', expect.objectContaining({
    method: 'GET',
    params: { meetingId: 'meeting-1', kind: 'participants' },
    skipEventSegment: true,
  }));
  expect(chat.props.otherParticipantId).toBe('speaker-1');
  expect(chat.props.otherParticipantAvatar).toBe(mockSpeaker.imageurl);
  expect(chat.props.otherParticipantName).toBe('Speaker');
  expect(chat.props.currentUserAvatar).toBeUndefined();

  await act(async () => view.unmount());
});

it('uses the speaker profile for the speaker and the requester profile for the peer', async () => {
  mockDbUserId = 'speaker-1';
  mockParticipantData = {
    success: true,
    otherParticipant: { id: 'requester-1', name: 'Requester profile', avatar: 'https://cdn.example.com/requester.png' },
    currentParticipant: { name: mockSpeaker.name, avatar: mockSpeaker.imageurl },
  };

  const view = await renderMeetingChat();

  const chat = view.root.findByType('RealtimeChat' as any);
  expect(chat.props.username).toBe(mockSpeaker.name);
  expect(chat.props.currentUserAvatar).toBe(mockSpeaker.imageurl);
  expect(chat.props.otherParticipantId).toBe('requester-1');
  expect(chat.props.otherParticipantAvatar).toBe('https://cdn.example.com/requester.png');

  await act(async () => view.unmount());
});

it('clears the peer when the speaker profile has no linked chat user', async () => {
  mockParticipantData = { success: true, otherParticipant: null, currentParticipant: null };

  const view = await renderMeetingChat();

  const chat = view.root.findByType('RealtimeChat' as any);
  expect(chat.props.otherParticipantId).toBeUndefined();
  expect(mockApiRequest).toHaveBeenCalledTimes(1);

  await act(async () => view.unmount());
});

/*
 * The app API resolves speaker and attendee profile fields server-side. This
 * matters for Better Auth sessions that do not carry a Supabase browser JWT.
 */
