/* eslint-disable import/first, import/no-duplicates */
jest.mock('morphicons/react', () => ({ MorphIcon: 'WebMorphIcon' }));
jest.mock('morphicons/react-native', () => ({ MorphIcon: 'NativeMorphIcon' }));

import { MorphIcon as WebMorphIcon } from '../../lib/morph-icon-renderer.web';
import { MorphIcon as NativeMorphIcon } from '../../lib/morph-icon-renderer';

it('selects the DOM morph renderer on web and the native renderer elsewhere', () => {
  expect(WebMorphIcon).toBe('WebMorphIcon');
  expect(NativeMorphIcon).toBe('NativeMorphIcon');
});
