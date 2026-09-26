/* eslint-disable import/first, import/no-duplicates */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockAnimationLevel = 'full';

jest.mock('morphicons/react', () => ({ MorphIcon: 'WebMorphIcon' }));
jest.mock('morphicons/react-native', () => ({ MorphIcon: 'NativeMorphIcon' }));
jest.mock('../../contexts/AnimationLevelContext', () => ({
  useAnimationLevel: () => ({ animationLevel: mockAnimationLevel }),
}));
jest.mock('../../lib/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import { MorphIcon as WebMorphIcon } from '../../lib/morph-icon-renderer.web';
import { MorphIcon as NativeMorphIcon } from '../../lib/morph-icon-renderer';
import { MorphIcon } from '../../lib/morph-icon';

it('selects the DOM morph renderer on web and the native renderer elsewhere', () => {
  expect(WebMorphIcon).toBe('WebMorphIcon');
  expect(NativeMorphIcon).toBe('NativeMorphIcon');
});

it.each([
  ['full', 'user'],
  ['reduced', 'always'],
  ['none', 'always'],
])('uses the %s app animation level to select %s reduced-motion handling', (level, expected) => {
  mockAnimationLevel = level;
  let view: ReactTestRenderer;

  act(() => {
    view = create(<MorphIcon icon={'expand'} fallbackIconName="expand-outline" />);
  });

  expect(view!.root.findByType('NativeMorphIcon' as never).props.reducedMotion).toBe(expected);
  act(() => view!.unmount());
});
