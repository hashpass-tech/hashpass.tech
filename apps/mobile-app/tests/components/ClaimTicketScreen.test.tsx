import React from 'react';
import { useRouter } from 'expo-router';
import ClaimTicketScreen from '../../app/(shared)/claim';

const { act, create } = jest.requireActual('react-test-renderer');

const mockRouter = {
  canGoBack: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
};

const render = (element: React.ReactElement) => {
  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(element);
  });
  return renderer!;
};

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('react-native-safe-area-context', () => {
  const MockReact = jest.requireActual('react');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) =>
      MockReact.createElement('SafeAreaView', props, children),
  };
});
jest.mock('../../i18n/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
jest.mock('../../components/QRScanner', () => ({ __esModule: true, default: 'QRScanner' }));
jest.mock('@hashpass/ui/primitives', () => ({
  ActionButton: ({ label, ...props }: { label: string; onPress: () => void }) => {
    const MockReact = jest.requireActual('react');
    return MockReact.createElement('ActionButton', { ...props, label }, label);
  },
  Surface: ({ children, ...props }: { children: React.ReactNode }) => {
    const MockReact = jest.requireActual('react');
    return MockReact.createElement('Surface', props, children);
  },
}));
jest.mock('../../lib/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));

describe('ClaimTicketScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('explains the claim steps and opens the original ticket QR scanner', () => {
    const renderer = render(<ClaimTicketScreen />);

    expect(renderer.root.findByProps({ children: 'How it works' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Have your original ticket ready' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Send it for review' })).toBeTruthy();
    expect(renderer.root.findByType('QRScanner').props.visible).toBe(false);

    act(() => {
      renderer.root.findByProps({ label: 'Scan ticket QR' }).props.onPress();
    });

    const scanner = renderer.root.findByType('QRScanner');
    expect(scanner.props.visible).toBe(true);
    expect(scanner.props.title).toBe('Scan your original ticket');
    expect(scanner.props.onClose).toEqual(expect.any(Function));
  });

  it('uses navigation back when there is history and the wallet as the entry fallback', () => {
    mockRouter.canGoBack.mockReturnValue(true);
    const renderer = render(<ClaimTicketScreen />);

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'Go back' }).props.onPress();
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValue(false);
    const directEntryRenderer = render(<ClaimTicketScreen />);
    act(() => {
      directEntryRenderer.root.findByProps({ accessibilityLabel: 'Go back' }).props.onPress();
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard/wallet');
  });
});
