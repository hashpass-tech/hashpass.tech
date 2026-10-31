import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

const mockMarkAllAsRead = jest.fn();
const mockRouterPush = jest.fn();
type TestNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  meeting_request_id?: string;
  meeting_request_event_id?: string;
  is_read: boolean;
  created_at: string;
};
const defaultNotification: TestNotification = {
  id: 'n1', type: 'meeting_update', title: 'Hi', message: 'm', is_read: false,
  created_at: '2026-01-01T00:00:00Z',
};
const mockNotifications: TestNotification[] = [
  defaultNotification,
];
const mockPassInfo = {
  pass_id: 'p1', pass_type: 'general', status: 'active', pass_number: '7',
  max_requests: 10, used_requests: 2, remaining_requests: 8,
  max_boost: 5, used_boost: 1, remaining_boost: 4,
  access_features: ['networking'], special_perks: ['lounge'], event_id: 'e1',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ passId: 'p1' }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#a00', primaryContrastText: '#fff', divider: '#ddd', error: '#f00',
      background: { paper: '#fafafa', default: '#fff' }, text: { primary: '#111', secondary: '#555' },
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
jest.mock('../../i18n/i18n', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key) }),
}));
jest.mock('../../lib/vector-icons', () => ({ Ionicons: 'Ionicons', MaterialIcons: 'MaterialIcons' }));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../hooks/useAuth', () => {
  const auth = { user: { id: 'u1' }, dbUserId: 'db1', isLoading: false };
  return { useAuth: () => auth };
});
jest.mock('../../components/UnifiedSearchAndFilter', () => 'SearchAndFilter');
jest.mock('../../components/DynamicQRDisplay', () => 'DynamicQR');
jest.mock('@contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: 1,
    isLoading: false,
    markAsRead: jest.fn().mockResolvedValue(undefined),
    markAsUnread: jest.fn(),
    markAllAsRead: mockMarkAllAsRead,
    archiveNotification: jest.fn(),
    deleteNotification: jest.fn(),
    refreshNotifications: jest.fn().mockResolvedValue(undefined),
  }),
}));
jest.mock('../../lib/pass-system', () => ({
  passSystemService: {
    getUserPassInfo: jest.fn(async () => mockPassInfo),
    getPassTypeDisplayName: () => 'General',
  },
}));
jest.mock('../../contexts/ToastContext', () => ({
  useToastHelpers: () => ({ showSuccess: jest.fn(), showError: jest.fn() }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

import Notifications from '../../app/(shared)/dashboard/notifications';
import QRView from '../../app/(shared)/dashboard/qr-view';
import PassDetails from '../../app/(shared)/dashboard/pass-details';

const text = (view: ReactTestRenderer) => view.root
  .findAllByType(Text)
  .map(node => [node.props.children].flat().join(''))
  .join('|');

describe('dashboard pages share the page layout', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockMarkAllAsRead.mockReset();
    mockNotifications.splice(0, mockNotifications.length, defaultNotification);
  });

  it('notifications: wallet-style heading, pill tabs, and tab switching', () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(<Notifications />); });
    expect(text(view)).toContain('YOUR INBOX');
    const tabs = () => view.root.findAll(n => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function');
    expect(tabs().length).toBeGreaterThanOrEqual(4);
    act(() => { tabs()[1].props.onPress(); });
    expect(tabs()[1].props.accessibilityState.selected).toBe(true);
    const markAll = view.root.findAllByType(TouchableOpacity).find(n => n.props.onPress === mockMarkAllAsRead);
    expect(markAll).toBeTruthy();
    act(() => { markAll!.props.onPress(); });
    expect(mockMarkAllAsRead).toHaveBeenCalled();
    act(() => view.unmount());
  });

  it('opens a meeting request in the event resolved from its notification', async () => {
    mockNotifications[0] = {
      id: 'request-notification',
      type: 'meeting_request_created',
      title: 'Meeting request',
      message: 'A speaker sent a request',
      meeting_request_id: 'request-1',
      meeting_request_event_id: 'event-from-request',
      is_read: false,
      created_at: '2026-01-02T00:00:00Z',
    };

    let view!: ReactTestRenderer;
    await act(async () => { view = create(<Notifications />); });
    const requestCard = view.root.findAllByType(TouchableOpacity)
      .find(node => node.props.activeOpacity === 0.7);
    expect(requestCard).toBeTruthy();

    await act(async () => { await requestCard!.props.onPress(); });

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/events/event-from-request/networking/my-requests',
      params: { requestId: 'request-1', highlightRequest: 'true' },
    });
    act(() => view.unmount());
  });

  it('qr-view renders the pass inside the shared column', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<QRView />); });
    expect(view.root.findAllByType('DynamicQR' as any).length).toBeGreaterThan(0);
    act(() => view.unmount());
  });

  it('pass-details renders the pass inside the shared column', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PassDetails />); });
    expect(view.root.findAllByType('DynamicQR' as any).length).toBeGreaterThan(0);
    act(() => view.unmount());
  });
});
