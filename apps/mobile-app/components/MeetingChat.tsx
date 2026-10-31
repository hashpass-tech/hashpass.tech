import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api-client';
import { useToastHelpers } from '../contexts/ToastContext';
import RealtimeChat from './RealtimeChat';

interface MeetingChatProps {
  meetingId: string;
  onClose: () => void;
}

export default function MeetingChat({ meetingId, onClose }: MeetingChatProps) {
  const { isDark, colors } = useTheme();
  const { user, dbUserId, isLoading: authLoading } = useAuth();
  const { showError } = useToastHelpers();
  const styles = getStyles(isDark, colors);

  const [loading, setLoading] = useState(true);
  const [otherParticipant, setOtherParticipant] = useState<{
    id: string;
    name: string;
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentUserName, setCurrentUserName] = useState<string | undefined>();
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | undefined>();

  const loadMeetingInfo = useCallback(async () => {
    // If auth is still loading, wait
    if (authLoading) {
      return;
    }

    if (!meetingId) {
      console.error('No meeting ID provided');
      showError('Error', 'Meeting ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const response = await apiClient.request('meetings/chat', {
        method: 'GET',
        params: { meetingId, kind: 'participants' },
        skipEventSegment: true,
        retries: 0,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to load meeting information');
      }

      const participantData = response.data?.data;
      if (!participantData?.success) {
        throw new Error(participantData?.error || 'Failed to load meeting information');
      }

      setOtherParticipant(participantData.otherParticipant || null);
      setCurrentUserId(participantData.currentParticipant?.id || dbUserId || undefined);
      setCurrentUserName(participantData.currentParticipant?.name || undefined);
      setCurrentUserAvatar(participantData.currentParticipant?.avatar || undefined);
    } catch (error) {
      console.error('Error loading meeting info:', error);
      showError('Error', error instanceof Error ? error.message : 'Failed to load meeting information');
    } finally {
      setLoading(false);
    }
  }, [authLoading, dbUserId, meetingId, showError]);

  useEffect(() => {
    // Wait for auth to finish loading before checking authentication
    if (!authLoading) {
      loadMeetingInfo();
    }
  }, [meetingId, authLoading, loadMeetingInfo]);

  // Show loading state while auth is loading or meeting info is loading
  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Real-time Chat Component */}
      <RealtimeChat
        roomName={`meeting_chat_${meetingId}`}
        username={currentUserName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You'}
        meetingId={meetingId}
        currentUserId={currentUserId}
        otherParticipantId={otherParticipant?.id}
        otherParticipantName={otherParticipant?.name}
        otherParticipantAvatar={otherParticipant?.avatar}
        currentUserAvatar={currentUserAvatar}
      />
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background?.default || (isDark ? '#000000' : '#ffffff'),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background?.default || (isDark ? '#000000' : '#ffffff'),
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text?.secondary || (isDark ? '#cccccc' : '#666666'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#333333' : '#f0f0f0',
    backgroundColor: colors.background?.paper || (isDark ? '#1a1a1a' : '#ffffff'),
  },
  closeButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text?.primary || (isDark ? '#ffffff' : '#000000'),
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text?.secondary || (isDark ? '#cccccc' : '#666666'),
    marginTop: 2,
  },
});
