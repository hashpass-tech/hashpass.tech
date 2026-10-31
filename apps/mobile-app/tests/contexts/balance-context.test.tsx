/// <reference types="jest" />

import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockIsLoggedIn = true;
const mockGetUserBalance = jest.fn();
const originalDispatchEvent = Object.getOwnPropertyDescriptor(window, 'dispatchEvent');

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isLoggedIn: mockIsLoggedIn }),
}));
jest.mock('../../lib/lukas-reward-service', () => ({
  lukasRewardService: { getUserBalance: (...args: unknown[]) => mockGetUserBalance(...args) },
}));

import { BalanceProvider, useBalance } from '../../contexts/BalanceContext';

function BalanceConsumer() {
  const { refreshBalance, isRefreshing } = useBalance();
  return (
    <Pressable onPress={refreshBalance}>
      <Text>{isRefreshing ? 'refreshing' : 'idle'}</Text>
    </Pressable>
  );
}

describe('BalanceProvider', () => {
  let view: ReactTestRenderer | undefined;

  beforeEach(() => {
    mockIsLoggedIn = true;
    mockGetUserBalance.mockReset();
  });

  afterEach(() => {
    if (view) act(() => view?.unmount());
    view = undefined;
    if (originalDispatchEvent) Object.defineProperty(window, 'dispatchEvent', originalDispatchEvent);
    else Reflect.deleteProperty(window, 'dispatchEvent');
    jest.restoreAllMocks();
  });

  it('skips refresh when the user is signed out', async () => {
    mockIsLoggedIn = false;
    await act(async () => {
      view = create(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    });

    await act(async () => {
      await view?.root.findByType(Pressable).props.onPress();
    });

    expect(mockGetUserBalance).not.toHaveBeenCalled();
    expect(view?.root.findByType(Text).props.children).toBe('idle');
  });

  it('dispatches the API balance to dashboard widgets and resets refresh state', async () => {
    let resolveBalance!: (balance: number) => void;
    mockGetUserBalance.mockReturnValue(new Promise(resolve => { resolveBalance = resolve; }));
    const dispatch = jest.fn();
    Object.defineProperty(window, 'dispatchEvent', { configurable: true, value: dispatch });

    await act(async () => {
      view = create(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    });
    let pending!: Promise<void>;
    act(() => {
      pending = view?.root.findByType(Pressable).props.onPress();
    });
    expect(view?.root.findByType(Text).props.children).toBe('refreshing');
    expect(mockGetUserBalance).toHaveBeenCalledWith('LUKAS');

    await act(async () => {
      resolveBalance(8.75);
      await pending;
    });

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'balance:refresh',
      detail: { balance: 8.75 },
    }));
    expect(view?.root.findByType(Text).props.children).toBe('idle');
  });

  it('catches API failures and always clears the refreshing state', async () => {
    mockGetUserBalance.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      view = create(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    });

    await act(async () => {
      await view?.root.findByType(Pressable).props.onPress();
    });

    expect(console.error).toHaveBeenCalledWith('❌ Error refreshing balance:', expect.any(Error));
    expect(view?.root.findByType(Text).props.children).toBe('idle');
  });
});
