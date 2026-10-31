import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'web',
  select: (options: Record<string, unknown>) => options.web ?? options.default,
}));

let mockUserId: string | null = 'user-a';
const mockGetUserBalance = jest.fn();
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({
  dbUserId: mockUserId,
  isLoggedIn: Boolean(mockUserId),
  user: mockUserId ? { id: mockUserId } : null,
}) }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: {
  primary: '#a00', divider: '#ddd', background: { paper: '#fff' }, text: { primary: '#111', secondary: '#555' },
} }) }));
jest.mock('../../i18n/i18n', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
jest.mock('../../lib/lukas-reward-service', () => ({
  lukasRewardService: { getUserBalance: (...args: unknown[]) => mockGetUserBalance(...args) },
}));
import Rewards from '../../components/BlockchainTokensView';

let view: ReactTestRenderer;
let balanceRefreshHandler: EventListener | undefined;
const content = () => JSON.stringify(view.toJSON());
afterEach(() => { if (view) act(() => view.unmount()); });
beforeAll(() => {
  window.addEventListener = jest.fn((type, listener) => {
    if (type === 'balance:refresh') balanceRefreshHandler = listener as EventListener;
  }) as unknown as typeof window.addEventListener;
  window.removeEventListener = jest.fn() as unknown as typeof window.removeEventListener;
});
beforeEach(() => { mockUserId = 'user-a'; balanceRefreshHandler = undefined; mockGetUserBalance.mockReset(); });

it('keeps provider errors unavailable and allows retry to an authoritative zero', async () => {
  mockGetUserBalance.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(0);
  await act(async () => { view = create(<Rewards />); });
  expect(content()).toContain('Unavailable');
  expect(mockGetUserBalance).toHaveBeenCalledWith('LUKAS');
  await act(async () => { view.root.findByType(Pressable).props.onPress(); });
  expect(content()).not.toContain('Unavailable');
  expect(content()).toContain('"0"');
});

it('does not show old-user balances when an earlier request finishes late', async () => {
  let resolveOld!: (value: number) => void;
  mockGetUserBalance.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(12.5);
  await act(async () => { view = create(<Rewards />); });
  mockUserId = 'user-b';
  await act(async () => { view.update(<Rewards />); });
  await act(async () => { resolveOld(999); });
  expect(content()).toContain('12.5');
  expect(content()).not.toContain('999');
  mockUserId = null;
  await act(async () => { view.update(<Rewards />); });
  expect(content()).not.toContain('12.5');
  expect(content()).toContain('Sign in');
  expect(mockGetUserBalance).toHaveBeenCalledTimes(2);
});

it.each(['NaN', '-1', '', 'Infinity'])('rejects invalid reward service amount %s', async amount => {
  mockGetUserBalance.mockResolvedValue(amount as unknown as number);
  await act(async () => { view = create(<Rewards />); });
  expect(content()).toContain('Unavailable');
});

it('handles rejected requests without substituting zero', async () => {
  mockGetUserBalance.mockRejectedValue(new Error('offline'));
  await act(async () => { view = create(<Rewards />); });
  expect(content()).toContain('Unavailable');
});

it('uses valid dashboard balance events and refreshes from the API for invalid events', async () => {
  let resolveRefresh!: (balance: number) => void;
  mockGetUserBalance.mockResolvedValueOnce(5).mockReturnValueOnce(new Promise(resolve => {
    resolveRefresh = resolve;
  }));
  await act(async () => { view = create(<Rewards />); });

  act(() => balanceRefreshHandler?.(new CustomEvent('balance:refresh', { detail: { balance: 25 } })));
  expect(content()).toContain('"25"');

  act(() => balanceRefreshHandler?.(new CustomEvent('balance:refresh', { detail: { balance: 'invalid' } })));
  expect(mockGetUserBalance).toHaveBeenCalledTimes(2);
  await act(async () => { resolveRefresh(6); });
  expect(content()).toContain('"6"');
});
