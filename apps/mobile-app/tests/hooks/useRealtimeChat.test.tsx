/// <reference types="jest" />

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })), currentState: 'active' },
  Platform: { OS: 'android' },
  Appearance: {
    getColorScheme: () => 'light',
    addChangeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeChangeListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
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

jest.mock('react-native-css-interop', () => ({
  createInteropElement: require('react').createElement,
}));

jest.mock('@hashpass/utils', () => ({
  memoryManager: {
    registerSubscription: jest.fn(),
    unregisterSubscription: jest.fn(),
  },
}));

const mockEnsureChatKeyPair = jest.fn();
const mockLoadChatKeyPair = jest.fn();
const mockFetchParticipantPublicKey = jest.fn();
const mockFetchOwnChatPublicKey = jest.fn();
const mockPublishChatPublicKey = jest.fn();
const mockDoesChatPrivateKeyMatchPublicKey = jest.fn();
const mockEncryptChatMessage = jest.fn();
const mockDecryptChatMessage = jest.fn();
const mockHasChatKeyBackup = jest.fn();
const mockRestoreChatKeyPair = jest.fn();
const mockBackupChatKeyPair = jest.fn();

jest.mock('../../lib/chat-encryption', () => ({
  ensureChatKeyPair: (...args: unknown[]) => mockEnsureChatKeyPair(...args),
  loadChatKeyPair: (...args: unknown[]) => mockLoadChatKeyPair(...args),
  fetchParticipantPublicKey: (...args: unknown[]) => mockFetchParticipantPublicKey(...args),
  fetchOwnChatPublicKey: (...args: unknown[]) => mockFetchOwnChatPublicKey(...args),
  publishChatPublicKey: (...args: unknown[]) => mockPublishChatPublicKey(...args),
  doesChatPrivateKeyMatchPublicKey: (...args: unknown[]) => mockDoesChatPrivateKeyMatchPublicKey(...args),
  encryptChatMessage: (...args: unknown[]) => mockEncryptChatMessage(...args),
  decryptChatMessage: (...args: unknown[]) => mockDecryptChatMessage(...args),
  hasChatKeyBackup: (...args: unknown[]) => mockHasChatKeyBackup(...args),
  restoreChatKeyPair: (...args: unknown[]) => mockRestoreChatKeyPair(...args),
  backupChatKeyPair: (...args: unknown[]) => mockBackupChatKeyPair(...args),
}));

const mockApiRequest = jest.fn();

jest.mock('../../lib/api-client', () => ({
  apiClient: { request: (...args: unknown[]) => mockApiRequest(...args) },
}));

// @hashpass/utils schedules a real setInterval at module-evaluation time
// (performance-utils.ts's image-cache cleanup, gated only on `typeof window
// !== 'undefined'`, true in this test environment) -- a plain top-level
// `import` would be hoisted before any jest.useFakeTimers() call could run,
// so fake timers must already be installed before this module (transitively
// pulled in by the hook) is required.
jest.useFakeTimers();
interface RealtimeChatProps {
  meetingId: string;
  roomName: string;
  username: string;
  userId: string;
  otherParticipantId?: string;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useRealtimeChat } = require('../../hooks/useRealtimeChat') as {
  useRealtimeChat: (props: RealtimeChatProps) => any;
};

let latest: ReturnType<typeof useRealtimeChat> | null = null;

function Capture(props: Parameters<typeof useRealtimeChat>[0]) {
  latest = useRealtimeChat(props);
  return null;
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const renderHook = async (props: Parameters<typeof useRealtimeChat>[0]) => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Capture, props));
    await flushPromises();
  });
  return renderer;
};

describe('useRealtimeChat', () => {
  const myPriv = new Uint8Array([1, 2, 3]);
  const theirPub = new Uint8Array([4, 5, 6]);

  beforeEach(() => {
    // The presence channel schedules a real setInterval (PRESENCE_INTERVAL)
    // that a plain unmount doesn't outrace in a real Jest process -- fake
    // timers keep it from ever firing for real and dangling past this file's
    // run, the same fix used for my-requests-screen.test.tsx's "Cannot log
    // after tests are done" issue.
    jest.useFakeTimers();
    jest.clearAllMocks();
    latest = null;
    mockEnsureChatKeyPair.mockResolvedValue(myPriv);
    mockLoadChatKeyPair.mockResolvedValue(myPriv);
    mockFetchParticipantPublicKey.mockResolvedValue(theirPub);
    mockFetchOwnChatPublicKey.mockResolvedValue(null);
    mockPublishChatPublicKey.mockResolvedValue(undefined);
    mockDoesChatPrivateKeyMatchPublicKey.mockReturnValue(true);
    mockHasChatKeyBackup.mockResolvedValue({ hasBackup: false });
    mockRestoreChatKeyPair.mockResolvedValue({ success: true });
    mockBackupChatKeyPair.mockResolvedValue({ success: true });
    mockApiRequest.mockImplementation(async (_path: string, options: any) => {
      if (options.method === 'GET') {
        return { success: true, data: { data: { success: true, messages: [] } } };
      }
      if (options.body?.action === 'send') {
        return { success: true, data: { data: { success: true, id: 'm3', created_at: '2026-08-05T10:10:00Z' } } };
      }
      return { success: true, data: { data: { success: true, otherLastSeenAt: null } } };
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('sets up keys and loads message history, decrypting each row', async () => {
    mockApiRequest.mockImplementation(async (_path: string, options: any) => {
      if (options.method === 'GET') {
        return { success: true, data: { data: {
          success: true,
          messages: [
            { id: 'm1', sender_id: 'other-user', ciphertext: 'aa', nonce: 'bb', message_type: 'text', created_at: '2026-08-05T10:00:00Z' },
          ],
        } } };
      }
      return { success: true, data: { data: { success: true, otherLastSeenAt: null } } };
    });
    mockDecryptChatMessage.mockReturnValue('Hey, running late!');
    mockLoadChatKeyPair.mockResolvedValue(null);

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(mockEnsureChatKeyPair).toHaveBeenCalledWith('my-user-id');
    expect(mockFetchParticipantPublicKey).toHaveBeenCalledWith('other-user');
    expect(latest!.loading).toBe(false);
    expect(latest!.otherKeyMissing).toBe(false);
    expect(latest!.keyBackupMissing).toBe(true);
    expect(mockApiRequest).toHaveBeenCalledWith('meetings/chat', expect.objectContaining({
      method: 'GET',
      params: { meetingId: 'meeting-1', kind: 'messages' },
      skipEventSegment: true,
    }));
    expect(latest!.messages).toEqual([
      expect.objectContaining({ id: 'm1', content: 'Hey, running late!', decryptionFailed: false }),
    ]);

    await act(async () => renderer.unmount());
  });

  it('flags an available server backup and restores it through the hook actions', async () => {
    mockLoadChatKeyPair.mockResolvedValue(null);
    mockHasChatKeyBackup.mockResolvedValue({ hasBackup: true });
    const restoredPriv = new Uint8Array([7, 8, 9]);
    mockRestoreChatKeyPair.mockResolvedValue({ success: true });
    mockEnsureChatKeyPair.mockResolvedValue(restoredPriv);

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(latest!.needsKeyRestore).toBe(true);
    expect(latest!.loading).toBe(false);
    expect(mockHasChatKeyBackup).toHaveBeenCalledWith('my-user-id');
    expect(mockEnsureChatKeyPair).not.toHaveBeenCalled();
    expect(latest!.keyMismatch).toBe(true);
    await act(async () => {
      await expect(latest!.restoreKeyFromBackup('backup-password')).resolves.toEqual({ success: true });
    });
    expect(mockRestoreChatKeyPair).toHaveBeenCalledWith('my-user-id', 'backup-password');
    expect(latest!.needsKeyRestore).toBe(false);
    expect(latest!.keysReady).toBe(true);
    expect(latest!.keyBackupMissing).toBe(false);

    await act(async () => {
      latest!.skipKeyRestore();
      await flushPromises();
    });
    await act(async () => renderer.unmount());
  });

  it('detects a local key mismatch, requires backup restore, and blocks sending until restored', async () => {
    mockDoesChatPrivateKeyMatchPublicKey.mockReturnValue(false);
    mockFetchOwnChatPublicKey.mockResolvedValue(theirPub);
    mockHasChatKeyBackup.mockResolvedValue({ hasBackup: true });

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(mockFetchOwnChatPublicKey).toHaveBeenCalledWith('my-user-id');
    expect(latest!.keyMismatch).toBe(true);
    expect(latest!.needsKeyRestore).toBe(true);
    expect(latest!.keyBackupMissing).toBe(false);
    expect(latest!.keysReady).toBe(false);
    await expect(latest!.sendMessage('This must not be sent')).rejects.toThrow('Restore the chat key backup');

    await act(async () => {
      await expect(latest!.restoreKeyFromBackup('backup-password')).resolves.toEqual({ success: true });
    });
    expect(latest!.keyMismatch).toBe(false);
    expect(latest!.needsKeyRestore).toBe(false);
    expect(latest!.keysReady).toBe(true);

    await act(async () => renderer.unmount());
  });

  it('keeps key setup blocked when checking a mismatched key backup fails', async () => {
    mockDoesChatPrivateKeyMatchPublicKey.mockReturnValue(false);
    mockFetchOwnChatPublicKey.mockResolvedValue(theirPub);
    mockHasChatKeyBackup.mockResolvedValue({ hasBackup: false, error: 'backup service unavailable' });

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(latest!.keyMismatch).toBe(true);
    expect(latest!.keysReady).toBe(false);
    expect(latest!.error).toBe('Failed to check for chat key backup: backup service unavailable');

    await act(async () => renderer.unmount());
  });

  it('accepts the local key when it matches the account public key', async () => {
    mockFetchOwnChatPublicKey.mockResolvedValue(theirPub);
    mockDoesChatPrivateKeyMatchPublicKey.mockReturnValue(true);

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(latest!.keyMismatch).toBe(false);
    expect(latest!.keysReady).toBe(true);
    expect(latest!.keyBackupMissing).toBe(true);
    expect(mockFetchParticipantPublicKey).toHaveBeenCalledWith('other-user');

    await act(async () => renderer.unmount());
  });

  it('keeps chat read-only when the device key is missing but the account already has a published key', async () => {
    mockLoadChatKeyPair.mockResolvedValue(null);
    mockFetchOwnChatPublicKey.mockResolvedValue(theirPub);
    mockApiRequest.mockImplementation(async (_path: string, options: any) => {
      if (options.method === 'GET') {
        return { success: true, data: { data: {
          success: true,
          messages: [
            { id: 'locked-message', sender_id: 'other-user', ciphertext: 'aa', nonce: 'bb', message_type: 'text', created_at: '2026-08-05T10:00:00Z' },
          ],
        } } };
      }
      return { success: true, data: { data: { success: true, otherLastSeenAt: null } } };
    });

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(mockEnsureChatKeyPair).not.toHaveBeenCalled();
    expect(latest!.keyMismatch).toBe(true);
    expect(latest!.needsKeyRestore).toBe(false);
    expect(latest!.keysReady).toBe(true);
    expect(latest!.messages[0]).toEqual(expect.objectContaining({ decryptionFailed: true }));
    await expect(latest!.sendMessage('Do not rotate keys silently')).rejects.toThrow('Restore the chat key backup');

    await act(async () => renderer.unmount());
  });

  it('delegates backup creation and reports missing-user actions', async () => {
    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    await act(async () => {
      await expect(latest!.createKeyBackup('backup-password')).resolves.toEqual({ success: true });
      await expect(latest!.restoreKeyFromBackup('backup-password')).resolves.toEqual({ success: true });
    });
    expect(mockBackupChatKeyPair).toHaveBeenCalledWith('my-user-id', 'backup-password');
    expect(mockRestoreChatKeyPair).toHaveBeenCalledWith('my-user-id', 'backup-password');
    await act(async () => renderer.unmount());

    const noUserRenderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: '',
    });
    await act(async () => {
      await expect(latest!.restoreKeyFromBackup('backup-password')).resolves.toEqual({ success: false, error: 'no_user' });
      await expect(latest!.createKeyBackup('backup-password')).resolves.toEqual({ success: false, error: 'no_user' });
    });
    await act(async () => noUserRenderer.unmount());
  });

  it('flags otherKeyMissing when the other participant has not set up chat yet, and disallows sending until they have', async () => {
    mockFetchParticipantPublicKey.mockResolvedValue(null);

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(latest!.otherKeyMissing).toBe(true);

    await act(async () => renderer.unmount());
  });

  it('surfaces chat-key API authentication failures instead of showing a missing peer key', async () => {
    mockFetchParticipantPublicKey.mockRejectedValue(new Error('Unauthorized'));

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(latest!.error).toBe('Unauthorized');
    expect(latest!.keysReady).toBe(false);

    await act(async () => renderer.unmount());
  });

  it('reconciles incoming history through the authenticated app API without Realtime broadcast', async () => {
    mockDecryptChatMessage.mockReturnValue('Delivered through authenticated history');
    let historyRows: any[] = [];
    mockApiRequest.mockImplementation(async (_path: string, options: any) => {
      if (options.method === 'GET') {
        return { success: true, data: { data: { success: true, messages: historyRows } } };
      }
      return { success: true, data: { data: { success: true, otherLastSeenAt: null } } };
    });

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    historyRows = [
      { id: 'poll-1', sender_id: 'other-user', ciphertext: 'aa', nonce: 'bb', message_type: 'text', created_at: '2026-08-05T10:15:00Z' },
    ];
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushPromises();
    });

    expect(latest!.messages).toEqual([
      expect.objectContaining({ id: 'poll-1', content: 'Delivered through authenticated history' }),
    ]);
    expect(mockApiRequest).toHaveBeenCalledWith('meetings/chat', expect.objectContaining({
      method: 'GET',
      params: { meetingId: 'meeting-1', kind: 'messages' },
      skipEventSegment: true,
    }));
    await act(async () => renderer.unmount());
  });

  it('sends encrypted content through the authenticated API then appends plaintext optimistically', async () => {
    mockEncryptChatMessage.mockReturnValue({ ciphertext: 'ee', nonce: 'ff' });
    mockApiRequest.mockImplementation(async (_path: string, options: any) => {
      if (options.method === 'GET') return { success: true, data: { data: { success: true, messages: [] } } };
      if (options.body?.action === 'send') {
        expect(options.body).toEqual({
          action: 'send',
          meetingId: 'meeting-1',
          ciphertext: 'ee',
          nonce: 'ff',
          messageType: 'text',
        });
        return { success: true, data: { data: { success: true, id: 'm3', created_at: '2026-08-05T10:10:00Z' } } };
      }
      return { success: true, data: { data: { success: true, otherLastSeenAt: null } } };
    });

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    await act(async () => {
      await latest!.sendMessage('On my way!');
    });

    expect(mockEncryptChatMessage).toHaveBeenCalledWith('On my way!', myPriv, theirPub);
    expect(latest!.messages).toEqual([
      expect.objectContaining({ id: 'm3', content: 'On my way!', user: { name: 'Me', id: 'my-user-id' } }),
    ]);

    await act(async () => renderer.unmount());
  });

  it('rejects sending when the other participant still has no published key', async () => {
    mockFetchParticipantPublicKey.mockResolvedValue(null);

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    await expect(latest!.sendMessage('hello')).rejects.toThrow(/has not set up secure chat/);

    await act(async () => renderer.unmount());
  });

  it('keeps chat unavailable without a peer identity and allows clearing local messages', async () => {
    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
    });

    expect(latest!.otherKeyMissing).toBe(true);
    await expect(latest!.sendMessage('hello')).rejects.toThrow('The other participant has not set up secure chat yet');
    await act(async () => latest!.clearMessages());
    expect(latest!.messages).toEqual([]);

    await act(async () => renderer.unmount());
  });

  it('refreshes presence and retries loading a peer key before sending', async () => {
    mockFetchParticipantPublicKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(theirPub);
    const lastSeenAt = new Date().toISOString();
    mockApiRequest.mockImplementation(async (_path: string, options: any) => {
      if (options.method === 'GET') {
        return { success: true, data: { data: { success: true, messages: [] } } };
      }
      if (options.body?.action === 'send') {
        return { success: true, data: { data: { success: true, id: 'retried-message', created_at: lastSeenAt } } };
      }
      return { success: true, data: { data: { success: true, otherLastSeenAt: lastSeenAt } } };
    });
    mockEncryptChatMessage.mockReturnValue({ ciphertext: 'ee', nonce: 'ff' });

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    expect(latest!.presence['other-user']).toEqual(expect.objectContaining({ isOnline: true }));
    expect(latest!.otherKeyMissing).toBe(true);
    await act(async () => {
      await latest!.sendMessage('Peer is ready now');
    });
    expect(mockFetchParticipantPublicKey).toHaveBeenCalledTimes(2);
    expect(latest!.messages).toEqual([
      expect.objectContaining({ id: 'retried-message', content: 'Peer is ready now' }),
    ]);

    await act(async () => renderer.unmount());
  });

  it('surfaces history and key-restore failures without replacing chat data', async () => {
    mockApiRequest.mockImplementation(async (_path: string, options: any) => {
      if (options.method === 'GET') return { success: false, error: 'history unavailable' };
      return { success: true, data: { data: { success: true, otherLastSeenAt: null } } };
    });
    mockRestoreChatKeyPair.mockResolvedValue({ success: false, error: 'wrong password' });

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });
    await act(async () => {
      await flushPromises();
      await expect(latest!.restoreKeyFromBackup('wrong-password')).resolves.toEqual({
        success: false,
        error: 'wrong password',
      });
    });
    expect(latest!.error).toBe('history unavailable');
    expect(latest!.isConnected).toBe(false);

    await act(async () => renderer.unmount());
  });

  it('reports replacement-key setup failures when restore is skipped', async () => {
    mockEnsureChatKeyPair.mockRejectedValue(new Error('secure storage unavailable'));

    const renderer = await renderHook({
      meetingId: 'meeting-1',
      roomName: 'room-1',
      username: 'Me',
      userId: 'my-user-id',
      otherParticipantId: 'other-user',
    });

    await act(async () => {
      latest!.skipKeyRestore();
      await flushPromises();
    });

    expect(latest!.error).toBe('secure storage unavailable');
    await act(async () => renderer.unmount());
  });
});
