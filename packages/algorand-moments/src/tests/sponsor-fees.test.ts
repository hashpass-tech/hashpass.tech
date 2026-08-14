import test from 'node:test'; import assert from 'node:assert/strict'; import { SponsorFeeGuard } from '../sponsor-fees.js';
test('sponsor spending limit is enforced', () => { const g = new SponsorFeeGuard(10); assert.equal(g.reserve(7), 7); assert.throws(() => g.reserve(4), /limit/); });
