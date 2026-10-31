import { useCallback, useEffect, useState, useRef } from 'react';
import { apiClient } from '../lib/api-client';
import {
  ensureChatKeyPair,
  loadChatKeyPair,
  fetchParticipantPublicKey,
  fetchOwnChatPublicKey,
  publishChatPublicKey,
  doesChatPrivateKeyMatchPublicKey,
  encryptChatMessage,
  decryptChatMessage,
  hasChatKeyBackup,
  restoreChatKeyPair,
  backupChatKeyPair,
} from '../lib/chat-encryption';

interface UseRealtimeChatProps {
  meetingId: string;
  /** Legacy room label. Authenticated chat requests are scoped by meetingId. */
  roomName: string;
  username: string;
  /** Real Supabase auth UUID (dbUserId), used for local key storage and the
   * authenticated app API -- never Better Auth's own user.id. */
  userId: string;
  otherParticipantId?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
    id: string;
    avatar?: string;
  };
  createdAt: string;
  messageType?: 'text' | 'system' | 'meeting_update';
  /** True when the current key pair could not authenticate this row, usually
   * because a key changed or the stored ciphertext/nonce was damaged. */
  decryptionFailed?: boolean;
}

const PRESENCE_INTERVAL = 30000; // 30 seconds

export function useRealtimeChat({ meetingId, username, userId, otherParticipantId }: UseRealtimeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<{ [userId: string]: { isOnline: boolean; lastSeen: Date } }>({});
  const [keysReady, setKeysReady] = useState(false);
  const [otherKeyMissing, setOtherKeyMissing] = useState(false);
  const [keyMismatch, setKeyMismatch] = useState(false);
  const [keyBackupMissing, setKeyBackupMissing] = useState(false);
  // True when the device has no local private key but a server-side encrypted
  // backup exists -- the UI should prompt the user to enter their backup
  // password to restore chat history before proceeding.
  const [needsKeyRestore, setNeedsKeyRestore] = useState(false);

  const myPrivateKeyRef = useRef<Uint8Array | null>(null);
  const privateKeyOwnerRef = useRef<string | null>(null);
  const otherPublicKeyRef = useRef<Uint8Array | null>(null);
  const otherPublicKeyOwnerRef = useRef<string | null>(null);
  const refreshMessagesRef = useRef<() => void>(() => undefined);
  const keySetupGenerationRef = useRef(0);

  const loadOtherParticipantKey = useCallback(async () => {
    if (otherParticipantId) {
      otherPublicKeyRef.current = null;
      otherPublicKeyOwnerRef.current = otherParticipantId;
      const theirKey = await fetchParticipantPublicKey(otherParticipantId);
      if (otherPublicKeyOwnerRef.current !== otherParticipantId) return;
      otherPublicKeyRef.current = theirKey;
      setOtherKeyMissing(!theirKey);
    } else {
      otherPublicKeyRef.current = null;
      otherPublicKeyOwnerRef.current = null;
      setOtherKeyMissing(true);
    }
  }, [otherParticipantId]);

  const decryptRow = useCallback((row: any): ChatMessage => {
    const priv = privateKeyOwnerRef.current === userId ? myPrivateKeyRef.current : null;
    const otherPub = otherPublicKeyOwnerRef.current === otherParticipantId
      ? otherPublicKeyRef.current
      : null;
    const content = priv && otherPub
      ? decryptChatMessage({ ciphertext: row.ciphertext, nonce: row.nonce }, priv, otherPub)
      : null;

    return {
      id: row.id,
      content: content ?? '[Unable to decrypt this message]',
      user: { name: row.sender_id === userId ? username : 'them', id: row.sender_id },
      createdAt: row.created_at,
      messageType: row.message_type || 'text',
      decryptionFailed: content === null,
    };
  }, [userId, username, otherParticipantId]);

  // --- Key setup: my own device keypair (generated on first use) plus the
  // other participant's published public key. Sending requires both; the
  // other participant's key can be legitimately absent if they've never
  // opened chat on any device yet. ---
  const setupKeys = useCallback(async () => {
    if (!userId) return;
    const setupGeneration = keySetupGenerationRef.current;
    const isCurrentSetup = () => keySetupGenerationRef.current === setupGeneration;
    let backupChecked = false;
    let hasBackup = false;
    const checkBackup = async () => {
      const backup = await hasChatKeyBackup(userId);
      if (!isCurrentSetup()) return false;
      if (backup.error) {
        throw new Error(`Failed to check for chat key backup: ${backup.error}`);
      }
      backupChecked = true;
      hasBackup = backup.hasBackup;
      setKeyBackupMissing(!backup.hasBackup);
      return backup.hasBackup;
    };

    try {
      let privateKey = privateKeyOwnerRef.current === userId ? myPrivateKeyRef.current : null;
      if (!privateKey) {
        privateKey = await loadChatKeyPair(userId);
        if (!isCurrentSetup()) return;
      }

      if (!privateKey) {
        // Check for the backup before generating/publishing a replacement key.
        // The server refuses key rotation because existing ciphertext depends
        // on the currently registered key.
        await checkBackup();
        if (!isCurrentSetup()) return;

        // A published key with no matching local private key means this
        // account has already used chat on another device or lost local
        // storage. Never overwrite that key automatically: doing so would
        // make existing ciphertext impossible to recover on this device.
        const publishedOwnKey = await fetchOwnChatPublicKey(userId);
        if (!isCurrentSetup()) return;
        if (hasBackup) {
          setKeyMismatch(true);
          setNeedsKeyRestore(true);
          setLoading(false);
          return;
        }
        if (publishedOwnKey) {
          setKeyMismatch(true);
          await loadOtherParticipantKey();
          if (!isCurrentSetup()) return;
          setKeysReady(true);
          setLoading(false);
          return;
        }

        privateKey = await ensureChatKeyPair(userId);
        if (!isCurrentSetup()) return;
      }
      myPrivateKeyRef.current = privateKey;
      privateKeyOwnerRef.current = userId;

      const publishedOwnKey = await fetchOwnChatPublicKey(userId);
      if (!isCurrentSetup()) return;
      if (!publishedOwnKey) {
        // The local key may predate server registration. Re-publish this same
        // key so the peer can derive the existing conversation secret.
        await publishChatPublicKey(privateKey);
        if (!isCurrentSetup()) return;
        setKeyMismatch(false);
      } else if (!doesChatPrivateKeyMatchPublicKey(privateKey, publishedOwnKey)) {
        setKeyMismatch(true);
        if (await checkBackup()) {
          if (!isCurrentSetup()) return;
          setNeedsKeyRestore(true);
          setLoading(false);
          return;
        }
      } else {
        setKeyMismatch(false);
      }

      if (!backupChecked) await checkBackup();
      if (!isCurrentSetup()) return;

      await loadOtherParticipantKey();
      if (!isCurrentSetup()) return;
      setKeysReady(true);
    } catch (err) {
      if (!isCurrentSetup()) return;
      console.error('[useRealtimeChat] Failed to set up chat keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to set up secure chat');
      setLoading(false);
    }
  }, [userId, loadOtherParticipantKey]);

  useEffect(() => {
    keySetupGenerationRef.current += 1;
    myPrivateKeyRef.current = null;
    privateKeyOwnerRef.current = null;
    otherPublicKeyRef.current = null;
    otherPublicKeyOwnerRef.current = null;
    setMessages([]);
    setPresence({});
    setKeysReady(false);
    setOtherKeyMissing(true);
    setKeyMismatch(false);
    setNeedsKeyRestore(false);
    setKeyBackupMissing(false);
    setError(null);
    setIsConnected(false);
    setLoading(true);
  }, [userId, otherParticipantId]);

  useEffect(() => {
    setMessages([]);
    setPresence({});
  }, [meetingId]);

  // Restore the private key from a server-side encrypted backup. Call this
  // when needsKeyRestore is true and the user provides their backup password.
  // On success, the decrypted key is written to device storage and messages
  // will be re-decrypted with it.
  const restoreKeyFromBackup = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'no_user' };

    const result = await restoreChatKeyPair(userId, password);
    if (!result.success) {
      return result;
    }

    // Reload the private key from storage now that it's been restored.
    const restoredKey = await ensureChatKeyPair(userId);
    myPrivateKeyRef.current = restoredKey;
    privateKeyOwnerRef.current = userId;
    await loadOtherParticipantKey();
    setNeedsKeyRestore(false);
    setKeyMismatch(false);
    setKeyBackupMissing(false);
    setKeysReady(true);

    // Refresh messages so they can be decrypted with the restored key
    refreshMessagesRef.current();

    return { success: true };
  }, [userId, loadOtherParticipantKey]);

  // Skip restore and generate/publish a replacement key.
  // This means old messages will show as "[Unable to decrypt this message]".
  const skipKeyRestore = useCallback(() => {
    if (keyMismatch) return;
    void (async () => {
      if (!userId) return;
      try {
        const newKey = await ensureChatKeyPair(userId);
        myPrivateKeyRef.current = newKey;
        privateKeyOwnerRef.current = userId;
        await loadOtherParticipantKey();
        setNeedsKeyRestore(false);
        setKeysReady(true);
      } catch (err) {
        console.error('[useRealtimeChat] Failed to create replacement chat key:', err);
        setError(err instanceof Error ? err.message : 'Failed to set up secure chat');
      }
    })();
  }, [userId, keyMismatch, loadOtherParticipantKey]);

  // Create a backup of the current private key, encrypted with the user's
  // password. Call this after successful setup if the user wants to enable
  // backup for future device restores.
  const createKeyBackup = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'no_user' };
    const result = await backupChatKeyPair(userId, password);
    if (result.success) setKeyBackupMissing(false);
    return result;
  }, [userId]);

  useEffect(() => {
    setupKeys();
  }, [setupKeys]);

  // Message history and sends cross the authenticated app API. The browser
  // never calls the SECURITY DEFINER chat RPCs or publishes unauthenticated
  // Realtime broadcasts; the API returns ciphertext and decryption stays local.
  useEffect(() => {
    if (!keysReady || !meetingId || !userId) return;

    let cancelled = false;

    const loadHistory = async (showLoading = false) => {
      try {
        if (showLoading) setLoading(true);
        setError(null);
        const response = await apiClient.request('meetings/chat', {
          method: 'GET',
          params: { meetingId, kind: 'messages' },
          skipEventSegment: true,
          retries: 0,
        });
        if (!response.success) throw new Error(response.error || 'Failed to load messages');
        const data = response.data?.data;
        if (!data?.success) throw new Error(data?.error || 'Failed to load messages');
        if (cancelled) return;
        const rows = (data.messages || []) as any[];
        setMessages(rows.map(decryptRow));
        setIsConnected(true);
      } catch (err) {
        if (!cancelled) {
          console.error('[useRealtimeChat] Failed to load chat history:', err);
          setIsConnected(false);
          setError(err instanceof Error ? err.message : 'Failed to load messages');
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    refreshMessagesRef.current = () => {
      void loadHistory();
    };

    void loadHistory(true);
    // Poll through the authenticated API so Better Auth sessions do not rely
    // on an unrelated Supabase anon key or unauthenticated Realtime channel.
    const reconciliationInterval = setInterval(() => {
      void loadHistory();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(reconciliationInterval);
      refreshMessagesRef.current = () => undefined;
    };
  }, [keysReady, meetingId, userId, decryptRow]);

  // Presence is authenticated and backed by chat_last_seen rather than a
  // browser-originated Realtime broadcast. The app API verifies both users
  // belong to this meeting before returning the other participant's status.
  const refreshPresence = useCallback(async () => {
    if (!meetingId || !userId) return;
    try {
      const response = await apiClient.request('meetings/chat', {
        method: 'POST',
        body: { action: 'touch', meetingId, otherParticipantId },
        skipEventSegment: true,
        retries: 0,
      });
      if (!response.success || !response.data?.data?.success) return;
      const lastSeenAt = response.data.data.otherLastSeenAt;
      if (!otherParticipantId || !lastSeenAt) return;
      const lastSeen = new Date(lastSeenAt);
      setPresence((current) => ({
        ...current,
        [otherParticipantId]: {
          isOnline: Date.now() - lastSeen.getTime() < 60000,
          lastSeen,
        },
      }));
    } catch {
      // Message history is the connection indicator; presence is best effort.
    }
  }, [meetingId, userId, otherParticipantId]);

  useEffect(() => {
    if (!keysReady || !meetingId || !userId) return;
    void refreshPresence();
    const interval = setInterval(() => void refreshPresence(), PRESENCE_INTERVAL);
    return () => clearInterval(interval);
  }, [keysReady, meetingId, userId, refreshPresence]);

  const sendMessage = useCallback(
    async (content: string, messageType: 'text' | 'system' | 'meeting_update' = 'text') => {
      const priv = privateKeyOwnerRef.current === userId ? myPrivateKeyRef.current : null;
      const otherPub = otherPublicKeyOwnerRef.current === otherParticipantId
        ? otherPublicKeyRef.current
        : null;
      if (keyMismatch) {
        throw new Error('Restore the chat key backup before sending messages from this device');
      }
      if (!priv) throw new Error('Chat keys are not ready yet');
      if (!otherPub) {
        // The other participant may have opened chat for the first time
        // since this hook last checked -- try once more before giving up.
        if (otherParticipantId) {
          const theirKey = await fetchParticipantPublicKey(otherParticipantId);
          if (theirKey) {
            otherPublicKeyRef.current = theirKey;
            otherPublicKeyOwnerRef.current = otherParticipantId;
            setOtherKeyMissing(false);
          } else {
            throw new Error('The other participant has not set up secure chat yet');
          }
        } else {
          throw new Error('The other participant has not set up secure chat yet');
        }
      }

      const { ciphertext, nonce } = encryptChatMessage(content, priv, otherPublicKeyRef.current!);

      const response = await apiClient.request('meetings/chat', {
        method: 'POST',
        body: { action: 'send', meetingId, ciphertext, nonce, messageType },
        skipEventSegment: true,
        retries: 0,
      });
      if (!response.success) throw new Error(response.error || 'Failed to send message');
      const data = response.data?.data;
      if (!data?.success) throw new Error(data?.error || 'Failed to send message');

      // Optimistic append -- the sender already knows the plaintext and the
      // next authenticated history refresh de-dupes by the persisted ID.
      setMessages((current) => (current.some((m) => m.id === data.id) ? current : [
        ...current,
        {
          id: data.id,
          content,
          user: { name: username, id: userId },
          createdAt: data.created_at,
          messageType,
        },
      ]));
    },
    [meetingId, userId, username, otherParticipantId, keyMismatch]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    isConnected,
    clearMessages,
    presence,
    loading,
    error,
    keysReady,
    otherKeyMissing,
    keyMismatch,
    keyBackupMissing,
    needsKeyRestore,
    restoreKeyFromBackup,
    skipKeyRestore,
    createKeyBackup,
  };
}
