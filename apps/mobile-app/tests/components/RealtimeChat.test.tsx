/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports, import/first */

import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const mockRestoreKeyFromBackup = jest.fn();
const mockSkipKeyRestore = jest.fn();
const mockCreateKeyBackup = jest.fn();
const mockRefreshNotifications = jest.fn();
const mockScrollToBottom = jest.fn();

async function restoreKeyFromBackup(...args: unknown[]) {
  const result = await mockRestoreKeyFromBackup(...args);
  if (result?.success) {
    mockChatState = { ...mockChatState, needsKeyRestore: false };
  }
  return result;
}

function skipKeyRestore() {
  mockSkipKeyRestore();
  mockChatState = { ...mockChatState, needsKeyRestore: false };
}

let mockChatState: { messages: any[]; [key: string]: any } = {
  messages: [],
  sendMessage: jest.fn(),
  isConnected: true,
  presence: {},
  loading: false,
  error: null,
  otherKeyMissing: false,
  keyMismatch: false,
  keyBackupMissing: false,
  needsKeyRestore: false,
  restoreKeyFromBackup,
  skipKeyRestore,
  createKeyBackup: (...args: unknown[]) => mockCreateKeyBackup(...args),
};

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Appearance: {
    getColorScheme: () => "light",
    addChangeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeChangeListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
  Platform: { OS: "android" },
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock(
  "react-native-css-interop/src/runtime/native/appearance-observables",
  () => ({
    addChangeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeChangeListener: jest.fn(),
    removeEventListener: jest.fn(),
    resetAppearanceListeners: jest.fn(),
  }),
  { virtual: true },
);

jest.mock("react-native-css-interop/jsx-runtime", () =>
  require("react/jsx-runtime"),
);

jest.mock("@expo/vector-icons", () => ({ MaterialIcons: "MaterialIcons" }));
jest.mock("../../components/SpeakerAvatar", () => "SpeakerAvatar");
jest.mock("@hashpass/ui/primitives", () => ({
  ActionButton: "ActionButton",
  IconButton: "IconButton",
  Surface: "Surface",
}));
jest.mock("@hashpass/ui/tokens", () => ({
  uiPalette: () => ({
    canvas: "#ffffff",
    surface: "#f7f9fa",
    raised: "#ffffff",
    border: "#dfe3e8",
    text: "#17181c",
    muted: "#565963",
    accent: "#af0d01",
    accentFill: "#af0d01",
    onAccent: "#ffffff",
    accentSoft: "#fff1f0",
    danger: "#b42318",
    success: "#187548",
  }),
  uiTokens: {
    radius: { media: 16, input: 12, circle: 999 },
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
    control: { compactHeight: 44 },
    type: { caption: 12, label: 14, body: 16, title: 24 },
  },
}));

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: "#007AFF",
      divider: "#e5e7eb",
      background: { default: "#ffffff", paper: "#ffffff" },
      text: { primary: "#111827", secondary: "#4b5563" },
    },
  }),
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    dbUserId: "viewer-1",
    user: { email: "viewer@example.com", user_metadata: { full_name: "Viewer" } },
  }),
}));

jest.mock("../../contexts/NotificationContext", () => ({
  useNotifications: () => ({ refreshNotifications: mockRefreshNotifications }),
}));

jest.mock("../../hooks/useRealtimeChat", () => ({
  useRealtimeChat: () => mockChatState,
}));

jest.mock("../../hooks/useChatScroll", () => ({
  useChatScroll: () => ({ containerRef: { current: null }, scrollToBottom: mockScrollToBottom }),
}));

jest.mock("../../lib/chat-input", () => ({
  shouldSendMessageOnWebEnter: () => false,
}));

jest.mock("../../lib/chat-emojis", () => ({
  CHAT_EMOJI_CATEGORIES: [],
  getChatEmojiCategory: () => ({ emojis: [] }),
}));

import RealtimeChat from "../../components/RealtimeChat";

function renderChat(
  needsKeyRestore = false,
  avatars: { currentUserAvatar?: string; otherParticipantAvatar?: string } = {},
): ReactTestRenderer {
  mockChatState = { ...mockChatState, needsKeyRestore };
  let view!: ReactTestRenderer;
  act(() => {
    view = create(
      <RealtimeChat
        roomName="room-1"
        username="Viewer"
        meetingId="meeting-1"
        otherParticipantId="peer-1"
        otherParticipantName="Speaker"
        {...avatars}
      />,
    );
  });
  return view;
}

function findText(view: ReactTestRenderer, text: string) {
  return view.root
    .findAllByType("Text" as any)
    .find((node) => node.props.children === text)!;
}

function pressText(view: ReactTestRenderer, text: string) {
  const node = findText(view, text);
  if (typeof node.parent?.props.onPress !== "function") {
    throw new Error(`Text is not inside a pressable: ${text}`);
  }
  return node.parent.props.onPress();
}

function findInput(view: ReactTestRenderer, placeholder: string) {
  return view.root
    .findAllByType("TextInput" as any)
    .find((node) => node.props.placeholder === placeholder)!;
}

function findModal(view: ReactTestRenderer, index: number) {
  return view.root.findAllByType("Modal" as any)[index];
}

async function openSetupBackupModal(view: ReactTestRenderer) {
  const action = view.root.findByType("ActionButton" as any);
  await act(async () => action.props.onPress());
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRestoreKeyFromBackup.mockResolvedValue({ success: true });
  mockCreateKeyBackup.mockResolvedValue({ success: true });
  mockChatState = {
    ...mockChatState,
    messages: [],
    keyMismatch: false,
    keyBackupMissing: false,
    needsKeyRestore: false,
  };
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

it("validates an empty restore password before calling the restore hook", async () => {
  const view = renderChat(true);

  expect(findModal(view, 0).props.visible).toBe(true);
  await act(async () => {
    await pressText(view, "Restore");
  });

  expect(findText(view, "Please enter your backup password")).toBeTruthy();
  expect(mockRestoreKeyFromBackup).not.toHaveBeenCalled();
});

it("uses the supplied profile photos for both participants and groups incoming sender names", () => {
  mockChatState = {
    ...mockChatState,
    messages: [
      { id: "m1", content: "Hello", user: { id: "peer-1", name: "Peer" }, createdAt: "2026-10-31T10:00:00Z" },
      { id: "m2", content: "Again", user: { id: "peer-1", name: "Peer" }, createdAt: "2026-10-31T10:01:00Z" },
      { id: "m3", content: "Hi", user: { id: "viewer-1", name: "Viewer" }, createdAt: "2026-10-31T10:02:00Z" },
    ],
  };
  const view = renderChat(false, {
    currentUserAvatar: "https://cdn.example.com/current.png",
    otherParticipantAvatar: "https://cdn.example.com/speaker.png",
  });

  const avatars = view.root.findAllByType("SpeakerAvatar" as any);
  expect(avatars.some((avatar) => avatar.props.imageUrl === "https://cdn.example.com/current.png")).toBe(true);
  expect(avatars.some((avatar) => avatar.props.imageUrl === "https://cdn.example.com/speaker.png")).toBe(true);
  expect(view.root.findAllByType("Text" as any).filter((node) => node.props.children === "Speaker")).toHaveLength(2);
});

it("shows a calm empty state while the conversation has no messages", () => {
  const view = renderChat();

  expect(findText(view, "A private conversation")).toBeTruthy();
  expect(findText(view, "Messages are encrypted on your device. Send a note to get started.")).toBeTruthy();
  act(() => view.unmount());
});

it("renders online and offline presence for the chat participant", () => {
  mockChatState = {
    ...mockChatState,
    presence: { "peer-1": { isOnline: true, lastSeen: new Date() } },
  };
  let view = renderChat();
  expect(findText(view, "Speaker is online")).toBeTruthy();
  act(() => view.unmount());

  mockChatState = {
    ...mockChatState,
    presence: { "peer-1": { isOnline: false, lastSeen: new Date() } },
  };
  view = renderChat();
  expect(findText(view, "Speaker is offline")).toBeTruthy();
  act(() => view.unmount());
});

it("shows the wrong-password error and closes after a successful restore", async () => {
  mockRestoreKeyFromBackup
    .mockResolvedValueOnce({ success: false, error: "wrong_password" })
    .mockResolvedValueOnce({ success: true });
  const view = renderChat(true);

  act(() => findInput(view, "Backup password").props.onChangeText("wrong-password"));
  await act(async () => {
    await pressText(view, "Restore");
  });
  expect(findText(view, "Incorrect password. Please try again.")).toBeTruthy();

  act(() => findInput(view, "Backup password").props.onChangeText("correct-password"));
  await act(async () => {
    await pressText(view, "Restore");
  });
  expect(mockRestoreKeyFromBackup).toHaveBeenLastCalledWith("correct-password");
  expect(findModal(view, 0).props.visible).toBe(false);

  expect(findModal(view, 1).props.visible).toBe(false);
});

it("does not offer a skip when the registered private key must be restored", async () => {
  mockChatState = { ...mockChatState, keyMismatch: true };
  const view = renderChat(true);

  expect(findModal(view, 0).props.visible).toBe(true);
  expect(view.root.findAllByType("Text" as any).some((node) => node.props.children === "Skip")).toBe(false);
  expect(mockSkipKeyRestore).not.toHaveBeenCalled();
});

it("offers a backup prompt only while the local key matches the account", async () => {
  mockChatState = { ...mockChatState, keyBackupMissing: true };
  const view = renderChat();

  const action = view.root.findByType("ActionButton" as any);
  expect(action.props.label).toBe("Set up encrypted backup");
  await act(async () => action.props.onPress());
  expect(findModal(view, 1).props.visible).toBe(true);
  act(() => view.unmount());

  mockChatState = { ...mockChatState, keyBackupMissing: true, keyMismatch: true };
  const mismatchView = renderChat();
  expect(mismatchView.root.findAllByType("ActionButton" as any)).toHaveLength(0);
  act(() => mismatchView.unmount());
});

it("creates a new chat backup and closes the setup prompt on success", async () => {
  mockChatState = { ...mockChatState, keyBackupMissing: true };
  const view = renderChat();
  await openSetupBackupModal(view);

  act(() => findInput(view, "Choose a backup password").props.onChangeText("new-password"));
  await act(async () => {
    await pressText(view, "Create Backup");
  });

  expect(mockCreateKeyBackup).toHaveBeenCalledWith("new-password");
  expect(findModal(view, 1).props.visible).toBe(false);
});

it("keeps the backup prompt open and explains backup creation failures", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockCreateKeyBackup.mockResolvedValue({ success: false, error: "backup_failed" });
  mockChatState = { ...mockChatState, keyBackupMissing: true };
  const view = renderChat();
  await openSetupBackupModal(view);

  act(() => findInput(view, "Choose a backup password").props.onChangeText("new-password"));
  await act(async () => {
    await pressText(view, "Create Backup");
  });

  expect(mockCreateKeyBackup).toHaveBeenCalledWith("new-password");
  expect(consoleError).toHaveBeenCalledWith(
    "Failed to create key backup:",
    "backup_failed",
  );
  expect(findModal(view, 1).props.visible).toBe(true);
  expect(findText(view, "backup_failed")).toBeTruthy();
  consoleError.mockRestore();
});

it("allows the user to skip setting up a new chat backup", async () => {
  mockChatState = { ...mockChatState, keyBackupMissing: true };
  const view = renderChat();
  await openSetupBackupModal(view);

  await act(async () => {
    await pressText(view, "Not Now");
  });

  expect(mockCreateKeyBackup).not.toHaveBeenCalled();
  expect(findModal(view, 1).props.visible).toBe(false);
});
