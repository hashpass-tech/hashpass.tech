import test from 'node:test'; import assert from 'node:assert/strict';
import { challengeHash, opaqueToken, verifyCodeVerifier } from './challenge';
test('opaque challenges have sufficient entropy', () => assert.ok(opaqueToken().length >= 43));
test('verifier comparison rejects replay with a different verifier', () => { const v = opaqueToken(); assert.equal(verifyCodeVerifier(v, challengeHash(v)), true); assert.equal(verifyCodeVerifier(opaqueToken(), challengeHash(v)), false); });
