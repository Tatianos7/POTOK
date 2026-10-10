import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSharedFoodEligibilityRequestRawV1, sharedFoodEligibilityRequestDigestRawV1, sharedFoodIdentityFingerprintV1 } from '../sharedFoodEligibilityV1';
import { id, foodId } from './foodEvidenceFixturesV1';
const input = () => ({ contract: 'potok-shared-food-eligibility-request-v1', foodId, idempotencyReference: id(9000),
  expectedHead: null, catalogIdentityEpoch: '0', identityFingerprint: 'a'.repeat(64), status: 'PENDING', reason: 'Synthetic reason' });
test('strict raw eligibility boundary: unknown/missing/duplicates, client authority, disabled archive', () => {
  assert.deepEqual(decodeSharedFoodEligibilityRequestRawV1(JSON.stringify(input())), input());
  for (const bad of [{ ...input(), actorId: id(2) }, { ...input(), status: 'ARCHIVED' },
    { ...input(), catalogIdentityEpoch: 0 }, { ...input(), catalogIdentityEpoch: '-0' },
    { ...input(), catalogIdentityEpoch: '9223372036854775808' }, { ...input(), reason: '\ud800' },
    { ...input(), foodId: 'invalid' }, { ...input(), expectedHead: {} }]) {
    assert.throws(() => decodeSharedFoodEligibilityRequestRawV1(JSON.stringify(bad)));
  }
  assert.throws(() => decodeSharedFoodEligibilityRequestRawV1(input()));
  assert.throws(() => decodeSharedFoodEligibilityRequestRawV1(JSON.stringify(input()).replace('"status":"PENDING"', '"status":"PENDING","status":"ELIGIBLE"')));
  const missing: Partial<ReturnType<typeof input>> = input(); delete missing.reason;
  assert.throws(() => decodeSharedFoodEligibilityRequestRawV1(JSON.stringify(missing)));
});
test('eligibility request digest deterministic and binds CAS, identity epoch, reason and status', async () => {
  const original = await sharedFoodEligibilityRequestDigestRawV1(JSON.stringify(input()));
  assert.equal(await sharedFoodEligibilityRequestDigestRawV1(JSON.stringify(input(), null, 2)), original);
  for (const change of [{ status: 'ELIGIBLE' }, { catalogIdentityEpoch: '1' }, { reason: 'Other' },
    { expectedHead: { decisionId: id(3), version: '1' } }]) {
    assert.notEqual(await sharedFoodEligibilityRequestDigestRawV1(JSON.stringify({ ...input(), ...change })), original);
  }
});
test('identity fingerprint distinguishes nullable aliases and exact ordered UTF-8 identity', async () => {
  const identity = { foodId, canonicalFoodId: foodId, foodStableId: 'synthetic_root', source: 'core' as const, createdByUserId: null,
    identitySnapshot: { name: 'Синтетический 😀', nameOriginal: null, normalizedName: null, brand: null,
      normalizedBrand: null, barcode: null, aliases: ['a', 'b'] } };
  const fingerprint = await sharedFoodIdentityFingerprintV1(identity);
  assert.equal(fingerprint, await sharedFoodIdentityFingerprintV1(identity));
  for (const aliases of [['b', 'a'], [], null]) assert.notEqual(fingerprint, await sharedFoodIdentityFingerprintV1({
    ...identity, identitySnapshot: { ...identity.identitySnapshot, aliases } }));
});
