import test from 'node:test'; import assert from 'node:assert/strict'; import { createProofDigest } from '../proof-digest.js';
test('proof digest is deterministic', () => { assert.equal(createProofDigest({ b:2, a:1 }), createProofDigest({ a:1, b:2 })); assert.match(createProofDigest({ a:1 }), /^sha256:/); });
