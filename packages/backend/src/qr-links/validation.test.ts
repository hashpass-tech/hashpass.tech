import test from 'node:test'; import assert from 'node:assert/strict';
import { validateDestination, validateVisualConfig } from './validation';
import { DEFAULT_QR_VISUAL } from './types';

test('accepts public HTTP destinations', () => assert.equal(validateDestination('https://example.com/a').host, 'example.com'));
for (const value of ['javascript:alert(1)', 'http://localhost/a', 'http://127.0.0.1', 'http://169.254.169.254/latest', 'file:///tmp/a', 'http://user:pass@example.com']) {
  test(`rejects unsafe destination ${value}`, () => assert.throws(() => validateDestination(value)));
}
test('enforces visual safety and upgrades logo correction', () => {
  assert.equal(validateVisualConfig({ ...DEFAULT_QR_VISUAL, logo: true }).errorCorrection, 'H');
  assert.throws(() => validateVisualConfig({ ...DEFAULT_QR_VISUAL, foreground: '#eeeeee' }));
});
