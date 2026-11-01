import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { ActionButton, IconButton, Surface } from '@hashpass/ui/primitives';
import { uiPalette, uiTokens } from '@hashpass/ui/tokens';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { MaterialIcons } from '@expo/vector-icons';
import { useRealtimeChat, type ChatMessage } from '../hooks/useRealtimeChat';
import { useChatScroll } from '../hooks/useChatScroll';
import { shouldSendMessageOnWebEnter } from '../lib/chat-input';
import { getChatEmojiCategory, CHAT_EMOJI_CATEGORIES, type ChatEmojiCategory, type ChatEmojiCategoryId } from '../lib/chat-emojis';
import SpeakerAvatar from './SpeakerAvatar';
import { useNotifications } from '../contexts/NotificationContext';
import { resolveAvatarUrl } from '../lib/auth/avatar';
import type { RealtimeChatProps } from '../types/RealtimeChat.types';

export default function RealtimeChat({
  roomName,
  username,
  meetingId,
  currentUserId,
  otherParticipantId,
  otherParticipantName,
  otherParticipantAvatar,
  currentUserAvatar,
}: RealtimeChatProps) {
  const { isDark } = useTheme();
  const { user, dbUserId } = useAuth();
  const chatUserId = currentUserId || dbUserId || '';
  const { refreshNotifications } = useNotifications();
  const mode = isDark ? 'dark' : 'light';
  const palette = uiPalette(mode);
  const styles = getStyles(palette);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<ChatEmojiCategoryId>('reactions');
  const messageInputRef = useRef<TextInput>(null);
  const [presence, setPresence] = useState<{ [userId: string]: { isOnline: boolean; lastSeen: Date } }>({});
  const ownAvatarUrl = currentUserAvatar || resolveAvatarUrl(user);

  // The chat hook refreshes encrypted history and sends through the signed-in
  // app API. Prefer the server-resolved Supabase UUID because a Better Auth
  // session can be valid before the client-side Supabase bridge populates
  // dbUserId. Never use Better Auth's own user.id for meeting records or keys.
  const {
    messages,
    sendMessage,
    isConnected,
    presence: chatPresence,
    loading,
    error,
    otherKeyMissing,
    keyMismatch,
    keyBackupMissing,
    needsKeyRestore,
    restoreKeyFromBackup,
    resetChatKey,
    skipKeyRestore,
    createKeyBackup,
  } = useRealtimeChat({
    meetingId,
    roomName,
    username,
    userId: chatUserId,
    otherParticipantId,
  });

  // Key backup/restore UI state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showResetKeyModal, setShowResetKeyModal] = useState(false);
  const [resetKeyError, setResetKeyError] = useState<string | null>(null);
  const [resetKeyLoading, setResetKeyLoading] = useState(false);
  const [showSetupBackupModal, setShowSetupBackupModal] = useState(false);
  const [setupBackupPassword, setSetupBackupPassword] = useState('');
  const [setupBackupLoading, setSetupBackupLoading] = useState(false);
  const [setupBackupError, setSetupBackupError] = useState<string | null>(null);

  // Update presence state from hook
  useEffect(() => {
    if (chatPresence) {
      setPresence(chatPresence);
    }
  }, [chatPresence]);

  // Use chat scroll hook
  const { containerRef, scrollToBottom } = useChatScroll();

  // The hook merges history refreshes and optimistic sends by message ID.
  const allMessages: ChatMessage[] = messages;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length, scrollToBottom]);

  // Listen for new incoming messages and refresh notifications. sender_id
  // is always a real uuid now (set by the hook from meeting_chat_messages),
  // so this is a plain equality check against the resolved chat user ID -- no more
  // email/username substring fallback matching needed.
  useEffect(() => {
    const incomingMessages = allMessages.filter((msg) => msg.user.id !== chatUserId);

    if (incomingMessages.length > 0) {
      refreshNotifications();
    }
  }, [allMessages.length, chatUserId, refreshNotifications]);

  // Handle message sending -- encryption + persistence both happen inside
  // sendMessage; this just owns the input/sending UI state.
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(newMessage.trim(), 'text');
      setNewMessage('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleWebEnter = (event: any) => {
    if (
      event.defaultPrevented
      || event.isDefaultPrevented?.()
      || !shouldSendMessageOnWebEnter(event)
    ) return;

    // Capture phase runs before React Native Web's textarea handler, so the
    // browser never inserts a newline for a plain Enter key.
    event.preventDefault?.();
    event.stopPropagation?.();
    void handleSendMessage();
  };

  const appendEmoji = (emoji: string) => {
    setNewMessage((message) => `${message}${emoji}`);
    setShowEmojiPicker(false);
    setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  // Handle key backup restore when needsKeyRestore is true
  useEffect(() => {
    if (needsKeyRestore && !showRestoreModal && !showResetKeyModal) {
      setShowRestoreModal(true);
    }
  }, [needsKeyRestore, showRestoreModal, showResetKeyModal]);

  // Handle restore submit
  const handleRestore = async () => {
    if (!restorePassword.trim()) {
      setRestoreError('Please enter your backup password');
      return;
    }

    setRestoreLoading(true);
    setRestoreError(null);

    const result = await restoreKeyFromBackup(restorePassword);
    setRestoreLoading(false);

    if (result.success) {
      setShowRestoreModal(false);
      setRestorePassword('');
    } else {
      if (result.error === 'wrong_password') {
        setRestoreError('Incorrect password. Please try again.');
      } else if (result.error === 'key_mismatch') {
        setRestoreError('This backup does not match the key registered to this account. Use a device that still has the matching key to read these messages.');
      } else {
        setRestoreError(result.error || 'Failed to restore chat key');
      }
    }
  };

  const handleSkipRestore = () => {
    setShowRestoreModal(false);
    setRestorePassword('');
    setRestoreError(null);
    skipKeyRestore();
  };

  const handleResetChatKey = async () => {
    setResetKeyLoading(true);
    setResetKeyError(null);
    const result = await resetChatKey();
    setResetKeyLoading(false);

    if (result.success) {
      setShowResetKeyModal(false);
      setShowRestoreModal(false);
      setRestorePassword('');
      setRestoreError(null);
    } else {
      setResetKeyError(result.error || 'Could not create a new chat key. Try again.');
    }
  };

  // Handle setup backup submit
  const handleSetupBackup = async () => {
    if (!setupBackupPassword.trim()) {
      return;
    }

    setSetupBackupLoading(true);
    setSetupBackupError(null);
    const result = await createKeyBackup(setupBackupPassword);
    setSetupBackupLoading(false);

    if (result.success) {
      setShowSetupBackupModal(false);
      setSetupBackupPassword('');
    } else {
      console.error('Failed to create key backup:', result.error);
      setSetupBackupError(result.error || 'Could not create an encrypted backup. Try again.');
    }
  };

  const handleSkipSetupBackup = () => {
    setShowSetupBackupModal(false);
    setSetupBackupPassword('');
    setSetupBackupError(null);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    // sender_id is always dbUserId's real uuid (set server-side from the
    // authenticated RPC caller), so this is a plain equality check.
    const isOwnMessage = message.user.id === chatUserId;

    const isSystemMessage = message.messageType === 'system';
    const isMeetingUpdate = message.messageType === 'meeting_update';
    
    const messageAvatar = isOwnMessage ? ownAvatarUrl : otherParticipantAvatar;
    
    const messageName = isOwnMessage 
      ? (username || 'You')
      : (otherParticipantName || message.user.name || 'User');

    // Different colors for different message types
    const getMessageBubbleStyle = () => {
      if (isSystemMessage) return styles.systemMessageBubble;
      if (isMeetingUpdate) return styles.meetingUpdateBubble;
      if (isOwnMessage) return styles.ownMessageBubble;
      return styles.incomingMessageBubble;
    };

    return (
      <View
        key={message.id}
        style={[
          styles.messageWrapper,
          isOwnMessage && styles.ownMessageWrapper,
          !isOwnMessage && !isSystemMessage && styles.incomingMessageWrapper,
        ]}
      >
        {!isSystemMessage && (
          <View style={[
            styles.messageContainer,
            isOwnMessage && styles.ownMessageContainer,
            !isOwnMessage && styles.incomingMessageContainer,
          ]}>
            {/* Avatar for incoming messages (left side) */}
            {!isOwnMessage && (
              <View style={styles.avatarContainer}>
                <SpeakerAvatar
                  name={messageName}
                  imageUrl={messageAvatar || undefined}
                  size={40}
                  showBorder={true}
                />
              </View>
            )}
            
            {/* Message content */}
            <View style={[
              styles.messageContent,
              isOwnMessage && styles.ownMessageContent,
              !isOwnMessage && styles.incomingMessageContent,
            ]}>
              {!isOwnMessage && (
                index === 0 || allMessages[index - 1]?.user.id !== message.user.id ? (
                  <Text style={styles.senderName}>{messageName}</Text>
                ) : null
              )}
              <View style={[
                styles.messageBubble,
                getMessageBubbleStyle(),
                message.decryptionFailed && styles.undecryptedMessageBubble,
              ]}>
                {message.decryptionFailed ? (
                  <View style={styles.undecryptedMessageContent}>
                    <MaterialIcons name="lock-outline" size={16} color={palette.danger} />
                    <Text style={styles.undecryptedMessageTitle}>Message unavailable</Text>
                  </View>
                ) : (
                  <Text style={[
                    styles.messageText,
                    isOwnMessage && styles.ownMessageText,
                    !isOwnMessage && styles.incomingMessageText,
                  ]}>
                    {message.content}
                  </Text>
                )}
              </View>
              <Text style={[
                styles.messageTime,
                isOwnMessage && styles.ownMessageTime,
                !isOwnMessage && styles.incomingMessageTime,
              ]}>
                {formatTime(message.createdAt)}
              </Text>
            </View>
            
            {/* Avatar for own messages (right side) */}
            {isOwnMessage && (
              <View style={styles.avatarContainer}>
                <SpeakerAvatar
                  name={messageName}
                  imageUrl={messageAvatar || undefined}
                  size={40}
                  showBorder={true}
                />
              </View>
            )}
          </View>
        )}
        {isSystemMessage && (
          <View style={styles.systemMessageContainer}>
            <Text style={styles.systemMessageText}>
              {message.content}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color={palette.danger} />
        <Text style={styles.errorTitle}>Failed to Load Chat</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  // Format last seen status
  const formatLastSeen = (lastSeen: Date | null) => {
    if (!lastSeen) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Active ${diffDays}d ago`;
  };

  const otherParticipantPresence = otherParticipantId ? presence[otherParticipantId] : undefined;
  const lastSeenText = formatLastSeen(otherParticipantPresence?.lastSeen || null);
  const isOtherParticipantOnline = otherParticipantPresence?.isOnline;
  const hasDecryptionFailures = allMessages.some((message) => message.decryptionFailed);
  const showKeyFeedback = (keyMismatch && !needsKeyRestore) || hasDecryptionFailures;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.chatHeader}>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatarContainer}>
            <SpeakerAvatar
              name={otherParticipantName || 'User'}
              imageUrl={otherParticipantAvatar || undefined}
              size={48}
              showBorder
            />
            {isOtherParticipantOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{otherParticipantName || 'Meeting participant'}</Text>
            <Text style={styles.headerLastSeen}>{lastSeenText || 'Private meeting chat'}</Text>
          </View>
        </View>
      </View>
      
      {/* Connection Status and Presence */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusIndicator, { backgroundColor: isConnected ? palette.success : palette.danger }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </Text>
        </View>
        {otherParticipantId && presence[otherParticipantId] && (
          <View style={styles.presenceContainer}>
            <View style={[
              styles.presenceIndicator,
              { backgroundColor: presence[otherParticipantId].isOnline ? palette.success : palette.muted }
            ]} />
            <Text style={styles.presenceText}>
              {presence[otherParticipantId].isOnline 
                ? `${otherParticipantName || 'User'} is online`
                : `${otherParticipantName || 'User'} is offline`
              }
            </Text>
          </View>
        )}
      </View>

      {showKeyFeedback && (
        <View style={styles.keyFeedbackBanner}>
          <View style={styles.keyFeedbackCopy}>
            <MaterialIcons
              name={keyMismatch ? 'vpn-key' : 'lock-outline'}
              size={18}
              color={keyMismatch ? palette.danger : palette.muted}
            />
            <Text style={styles.keyFeedbackText}>
              {keyMismatch
                ? 'This device can’t access your account’s chat key. Restore its backup to read older messages; sending is paused.'
                : 'Some messages couldn’t be decrypted. The chat key may have changed or message data may be damaged.'}
            </Text>
          </View>
          {keyMismatch && keyBackupMissing && !needsKeyRestore && (
            <ActionButton
              mode={mode}
              label="Start a new chat key"
              variant="secondary"
              onPress={() => {
                setResetKeyError(null);
                setShowResetKeyModal(true);
              }}
              style={styles.keyResetAction}
            />
          )}
        </View>
      )}

      {keyBackupMissing && !keyMismatch && (
        <Surface mode={mode} style={styles.keyBackupBanner}>
          <View style={styles.keyBackupCopy}>
            <MaterialIcons name="lock-outline" size={18} color={palette.accent} />
            <View style={styles.keyBackupText}>
              <Text style={styles.keyBackupTitle}>Protect your chat history</Text>
              <Text style={styles.keyBackupDescription}>
                Save an encrypted copy of your private key so you can read these messages on a new device.
              </Text>
            </View>
          </View>
          <ActionButton
            mode={mode}
            label="Set up encrypted backup"
            variant="secondary"
            onPress={() => {
              setSetupBackupError(null);
              setShowSetupBackupModal(true);
            }}
            style={styles.keyBackupButton}
          />
        </Surface>
      )}

      {/* Messages */}
      <ScrollView
        ref={containerRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {allMessages.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="lock-outline" size={22} color={palette.accent} />
            </View>
            <Text style={styles.emptyText}>A private conversation</Text>
            <Text style={styles.emptySubtext}>
              Messages are encrypted on your device. Send a note to get started.
            </Text>
          </View>
        )}
        {allMessages.map((message, index) => renderMessage(message, index))}
      </ScrollView>

      {/* Secure chat requires both sides' public keys -- the other
          participant's is only published once they've opened chat on some
          device. Block sending (not just show a toast on failure) so the
          composer honestly reflects whether a send can succeed. */}
      {otherKeyMissing && (
        <View style={styles.keyWaitingBanner}>
          <MaterialIcons
            name="info-outline"
            size={20}
            color={palette.accent}
            accessibilityLabel="Secure chat setup information"
          />
          <View style={styles.keyWaitingCopy}>
            <Text style={styles.keyWaitingTitle}>Secure chat is being set up</Text>
            <Text style={styles.keyWaitingText}>
              Waiting for {otherParticipantName || 'the other participant'} to open this chat for the first time. Then you can send private messages.
            </Text>
          </View>
        </View>
      )}

      {/* Message Input */}
      {showEmojiPicker && (
        <View style={styles.emojiPicker} accessibilityLabel="Emoji picker">
          <View style={styles.emojiCategoryRow}>
            {CHAT_EMOJI_CATEGORIES.map((category: ChatEmojiCategory) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.emojiCategoryButton, emojiCategory === category.id && styles.emojiCategoryButtonActive]}
                onPress={() => setEmojiCategory(category.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: emojiCategory === category.id }}
                accessibilityLabel={category.label}
              >
                <Text style={styles.emojiCategoryIcon}>{category.icon}</Text>
                <Text style={[styles.emojiCategoryLabel, emojiCategory === category.id && styles.emojiCategoryLabelActive]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.emojiGrid}>
            {getChatEmojiCategory(emojiCategory).emojis.map((emoji: string) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiOption}
                onPress={() => appendEmoji(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${emoji} emoji`}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          ref={messageInputRef}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type your message..."
          placeholderTextColor={palette.muted}
          multiline
          maxLength={500}
          editable={!otherKeyMissing && !keyMismatch}
          // React Native Web normally forwards Enter through onKeyPress.
          // onSubmitEditing is retained as a browser fallback for multiline
          // inputs where key events are intercepted by a host container.
          blurOnSubmit={Platform.OS === 'web'}
          onKeyPress={(event) => {
            handleWebEnter(event);
          }}
          onSubmitEditing={() => {
            if (Platform.OS !== 'web') return;
            void handleSendMessage();
            setTimeout(() => messageInputRef.current?.focus(), 0);
          }}
          {...(Platform.OS === 'web' ? { onKeyDownCapture: handleWebEnter } : {})}
        />
        <TouchableOpacity
          style={[styles.emojiButton, showEmojiPicker && styles.emojiButtonActive]}
          onPress={() => setShowEmojiPicker((visible) => !visible)}
          disabled={otherKeyMissing || keyMismatch}
          accessibilityRole="button"
          accessibilityLabel="Add emoji"
        >
          <MaterialIcons
            name="emoji-emotions"
            size={22}
            color={otherKeyMissing || keyMismatch ? palette.muted : palette.accent}
          />
        </TouchableOpacity>
        <IconButton
          mode={mode}
          label="Send message"
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending || otherKeyMissing || keyMismatch}
          loading={sending}
          style={[styles.sendButton, (!newMessage.trim() || sending || otherKeyMissing || keyMismatch) && styles.sendButtonDisabled]}
        >
          <MaterialIcons name="send" size={20} color={palette.onAccent} />
        </IconButton>
      </View>

      {/* Key Backup Restore Modal - shown when user has no local key but a
          server-side encrypted backup exists (new device or reinstall) */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="fade"
        onRequestClose={keyMismatch ? () => undefined : handleSkipRestore}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.raised }]}>
            <MaterialIcons
              name="lock-reset"
              size={48}
              color={palette.accent}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              Restore Chat History?
            </Text>
            <Text style={[styles.modalText, { color: palette.muted }]}>
              {keyMismatch
                ? 'This device cannot access the private key registered to your account. Enter your encrypted backup password to restore the matching key and continue securely.'
                : 'You have an encrypted backup of your chat history. Enter your backup password to restore it and decrypt your previous messages.'}
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: palette.surface,
                color: palette.text,
                borderColor: restoreError ? palette.danger : palette.border,
              }]}
              value={restorePassword}
              onChangeText={setRestorePassword}
              placeholder="Backup password"
              placeholderTextColor={palette.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {restoreError && (
              <Text style={styles.modalError}>{restoreError}</Text>
            )}
            <View style={styles.modalButtons}>
              {!keyMismatch && (
                <TouchableOpacity
                  style={styles.modalButtonSecondary}
                  onPress={handleSkipRestore}
                  disabled={restoreLoading}
                >
                  <Text style={[styles.modalButtonTextSecondary, { color: palette.muted }]}>Skip</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButtonPrimary, { backgroundColor: palette.accentFill }]}
                onPress={handleRestore}
                disabled={restoreLoading}
              >
                {restoreLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Restore</Text>
                )}
              </TouchableOpacity>
            </View>
            {keyMismatch && (
              <TouchableOpacity
                style={styles.startFreshButton}
                onPress={() => {
                  setResetKeyError(null);
                  setShowRestoreModal(false);
                  setShowResetKeyModal(true);
                }}
                disabled={restoreLoading}
                accessibilityRole="button"
              >
                <Text style={[styles.startFreshText, { color: palette.danger }]}>Can&apos;t restore? Start fresh</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Key Backup Setup Modal - shown when this matching key has no backup. */}
      <Modal
        visible={showSetupBackupModal}
        transparent
        animationType="fade"
        onRequestClose={handleSkipSetupBackup}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.raised }]}>
            <MaterialIcons
              name="cloud-upload"
              size={48}
              color={palette.accent}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              Set Up Chat Backup?
            </Text>
            <Text style={[styles.modalText, { color: palette.muted }]}>
              Create an encrypted backup of your chat key so you can restore your messages on a new device. Choose a password to encrypt the backup — if you forget it, the backup cannot be recovered.
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: palette.surface,
                color: palette.text,
                borderColor: palette.border,
              }]}
              value={setupBackupPassword}
              onChangeText={setSetupBackupPassword}
              placeholder="Choose a backup password"
              placeholderTextColor={palette.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {setupBackupError && (
              <Text style={styles.modalError}>{setupBackupError}</Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={handleSkipSetupBackup}
                disabled={setupBackupLoading}
              >
                <Text style={[styles.modalButtonTextSecondary, { color: palette.muted }]}>
                  Not Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, { backgroundColor: palette.accentFill }]}
                onPress={handleSetupBackup}
                disabled={setupBackupLoading || !setupBackupPassword.trim()}
              >
                {setupBackupLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Create Backup</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Replacing the account key restores future messaging but cannot recover
          ciphertext created with the previous key. */}
      <Modal
        visible={showResetKeyModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!resetKeyLoading) setShowResetKeyModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.raised }]}>
            <MaterialIcons
              name="warning-amber"
              size={48}
              color={palette.danger}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: palette.text }]}>Create a new chat key?</Text>
            <Text style={[styles.modalText, { color: palette.muted }]}>
              This replaces the key for your account across all chats. Messages encrypted with the old key will stay unreadable to you and other participants. If another device still has the old key, cancel and create an encrypted backup there first.
            </Text>
            {resetKeyError && <Text style={styles.modalError}>{resetKeyError}</Text>}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowResetKeyModal(false)}
                disabled={resetKeyLoading}
              >
                <Text style={[styles.modalButtonTextSecondary, { color: palette.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, { backgroundColor: palette.accentFill }]}
                onPress={handleResetChatKey}
                disabled={resetKeyLoading}
                accessibilityRole="button"
              >
                {resetKeyLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Create new key</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (palette: ReturnType<typeof uiPalette>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  chatHeader: {
    paddingHorizontal: uiTokens.space.lg,
    paddingVertical: uiTokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  headerInfo: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: uiTokens.space.md,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.success,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontSize: uiTokens.type.label,
    fontWeight: '600',
    color: palette.text,
    marginBottom: uiTokens.space.xs,
  },
  headerLastSeen: {
    fontSize: uiTokens.type.caption,
    color: palette.muted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.canvas,
  },
  loadingText: {
    marginTop: 12,
    fontSize: uiTokens.type.body,
    color: palette.muted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: palette.canvas,
  },
  errorTitle: {
    fontSize: uiTokens.type.label + 4,
    fontWeight: '600',
    color: palette.text,
    marginTop: uiTokens.space.lg,
    marginBottom: uiTokens.space.sm,
  },
  errorMessage: {
    fontSize: uiTokens.type.label,
    color: palette.muted,
    textAlign: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uiTokens.space.lg,
    paddingVertical: uiTokens.space.sm,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: palette.muted,
  },
  presenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presenceIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  presenceText: {
    fontSize: 11,
    color: palette.muted,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  messagesContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: uiTokens.space.lg,
    paddingTop: uiTokens.space.xl,
    paddingBottom: uiTokens.space.lg,
  },
  messageWrapper: {
    marginBottom: uiTokens.space.sm,
    width: '100%',
  },
  ownMessageWrapper: {
    alignItems: 'flex-end',
    paddingLeft: 50, // Space for avatar on left
  },
  incomingMessageWrapper: {
    alignItems: 'flex-start',
    paddingRight: 50, // Space for avatar on right
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '88%',
    gap: 8,
  },
  ownMessageContainer: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  incomingMessageContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  messageContent: {
    flex: 1,
    minWidth: 0, // Allow flex shrinking
  },
  ownMessageContent: {
    alignItems: 'flex-end',
  },
  incomingMessageContent: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: uiTokens.type.caption,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: 4,
    marginLeft: 8,
  },
  messageBubble: {
    paddingHorizontal: uiTokens.space.md,
    paddingVertical: uiTokens.space.sm,
    borderRadius: uiTokens.radius.media,
    maxWidth: '100%',
  },
  ownMessageBubble: {
    backgroundColor: palette.accentFill,
    borderBottomRightRadius: 4,
  },
  incomingMessageBubble: {
    backgroundColor: palette.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  undecryptedMessageBubble: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.danger,
    borderWidth: 1,
  },
  undecryptedMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTokens.space.sm,
    maxWidth: 340,
  },
  undecryptedMessageTitle: {
    color: palette.text,
    fontSize: uiTokens.type.label,
    fontWeight: '700',
  },
  systemMessageBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  meetingUpdateBubble: {
    backgroundColor: palette.accentSoft,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  messageText: {
    fontSize: uiTokens.type.body,
    lineHeight: 20,
    color: palette.text,
  },
  ownMessageText: {
    color: palette.onAccent,
    fontWeight: '400',
  },
  incomingMessageText: {
    color: palette.text,
  },
  messageTime: {
    fontSize: 10,
    color: palette.muted,
    marginTop: 4,
    fontWeight: '400',
  },
  ownMessageTime: {
    textAlign: 'right',
    marginRight: 8,
  },
  incomingMessageTime: {
    textAlign: 'left',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: uiTokens.space.xl,
    paddingVertical: uiTokens.space.xxl,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: uiTokens.radius.circle,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: uiTokens.type.label + 2,
    fontWeight: '600',
    color: palette.text,
    marginTop: uiTokens.space.md,
  },
  emptySubtext: {
    maxWidth: 360,
    fontSize: uiTokens.type.caption,
    lineHeight: 18,
    color: palette.muted,
    textAlign: 'center',
    marginTop: uiTokens.space.xs,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    maxWidth: '90%',
    marginVertical: 8,
  },
  systemMessageText: {
    backgroundColor: 'transparent',
    color: palette.muted,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 8,
    fontSize: 13,
  },
  keyWaitingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: uiTokens.space.lg,
    paddingVertical: uiTokens.space.md,
    backgroundColor: palette.accentSoft,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  keyWaitingCopy: {
    flex: 1,
  },
  keyWaitingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 2,
  },
  keyWaitingText: {
    fontSize: 12,
    color: palette.muted,
    lineHeight: 17,
  },
  keyFeedbackBanner: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    alignItems: 'stretch',
    gap: uiTokens.space.sm,
    paddingHorizontal: uiTokens.space.lg,
    paddingVertical: uiTokens.space.sm,
    backgroundColor: palette.accentSoft,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  keyFeedbackCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: uiTokens.space.sm,
  },
  keyFeedbackText: {
    flex: 1,
    color: palette.text,
    fontSize: uiTokens.type.caption,
    lineHeight: 18,
  },
  keyResetAction: {
    alignSelf: 'flex-start',
    marginLeft: uiTokens.space.xl,
  },
  keyBackupBanner: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    gap: uiTokens.space.md,
    paddingHorizontal: uiTokens.space.lg,
    paddingVertical: uiTokens.space.md,
  },
  keyBackupCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: uiTokens.space.sm,
  },
  keyBackupText: {
    flex: 1,
  },
  keyBackupTitle: {
    fontSize: uiTokens.type.label,
    fontWeight: '600',
    color: palette.text,
  },
  keyBackupDescription: {
    marginTop: uiTokens.space.xs,
    fontSize: uiTokens.type.caption,
    lineHeight: 17,
    color: palette.muted,
  },
  keyBackupButton: {
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    gap: uiTokens.space.sm,
    padding: uiTokens.space.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.canvas,
  },
  emojiPicker: {
    paddingHorizontal: uiTokens.space.md,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  emojiCategoryRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  emojiCategoryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    paddingVertical: 4,
    borderRadius: 9,
  },
  emojiCategoryButtonActive: {
    backgroundColor: palette.accentSoft,
  },
  emojiCategoryIcon: {
    fontSize: 16,
  },
  emojiCategoryLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  emojiCategoryLabelActive: {
    color: palette.accent,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  emojiOption: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiText: {
    fontSize: 21,
  },
  emojiButton: {
    width: 40,
    height: 44,
    borderRadius: uiTokens.radius.circle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiButtonActive: {
    backgroundColor: palette.accentSoft,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: uiTokens.radius.input,
    paddingHorizontal: uiTokens.space.md,
    paddingVertical: uiTokens.space.md,
    fontSize: uiTokens.type.body,
    color: palette.text,
    backgroundColor: palette.raised,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: palette.accentFill,
    borderColor: palette.accentFill,
    width: uiTokens.control.compactHeight,
    height: uiTokens.control.compactHeight,
    borderRadius: uiTokens.radius.circle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: palette.border,
    borderColor: palette.border,
  },
  // Key backup/restore modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: uiTokens.radius.card,
    padding: uiTokens.space.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: uiTokens.type.label + 6,
    fontWeight: '700',
    marginBottom: uiTokens.space.md,
    textAlign: 'center',
  },
  modalText: {
    fontSize: uiTokens.type.label,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: uiTokens.space.xl,
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: uiTokens.radius.input,
    paddingHorizontal: uiTokens.space.md,
    paddingVertical: uiTokens.space.md,
    fontSize: uiTokens.type.body,
    marginBottom: uiTokens.space.md,
  },
  modalError: {
    color: palette.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: uiTokens.space.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: uiTokens.space.md,
    width: '100%',
    marginTop: uiTokens.space.sm,
  },
  startFreshButton: {
    marginTop: uiTokens.space.md,
    paddingVertical: uiTokens.space.sm,
  },
  startFreshText: {
    fontSize: uiTokens.type.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: uiTokens.space.md,
    borderRadius: uiTokens.radius.input,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: uiTokens.space.md,
    borderRadius: uiTokens.radius.input,
    alignItems: 'center',
  },
  modalButtonTextSecondary: {
    fontSize: uiTokens.type.label,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: palette.onAccent,
    fontSize: uiTokens.type.label,
    fontWeight: '600',
  },
});
