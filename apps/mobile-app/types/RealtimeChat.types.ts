export interface RealtimeChatProps {
  roomName: string;
  username: string;
  meetingId: string;
  otherParticipantId?: string;
  otherParticipantName?: string;
  otherParticipantAvatar?: string;
  currentUserAvatar?: string;
}
