import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeExactFoodNutritionRevisionRawV2 as decodeRevision, decodeExactFoodNutritionReviewEventRawV2 as decodeEvent,
  exactFoodNutritionRevisionDigestRawV2 as revisionDigest, exactFoodNutritionEventDigestRawV2 as eventDigest,
  exactFoodNutritionRevisionCanonicalBytesRawV2 as revisionBytes, exactFoodNutritionEventCanonicalBytesRawV2 as eventBytes,
} from '../exactFoodNutritionEvidenceV2';
import { decodeFoodEvidenceReviewEventRawV1, decodeNutritionReviewedRevisionRawV1 } from '../foodReviewedEvidenceV1';
import { exactFoodFixtureV2 as fixture, raw, id, copy, sha } from '../../server/__tests__/exactFoodNutritionFixturesV2';

test('exact revision owns immutable proposal and preserves both source bases and precision', async () => {
  for (const basis of ['PER_100_G_FOOD', 'PER_100_G_EDIBLE'] as const) {
    const f = await fixture(basis), value = await decodeRevision(raw(f.revision), raw(f.pins));
    assert.deepEqual(value, f.revision); assert.equal(value.sourceProposal.authority, 'NONE');
    assert.equal(value.sourceProposal.numericInput.reference.basis, basis);
    assert.deepEqual(value.sourceProposal.numericInput.values.calories, { numerator: '378866123', denominator: '1000000' });
    assert.ok(Object.isFrozen(value)); assert.ok(Object.isFrozen(value.sourceProposal.retainedSource.mappings[0].applicability));
  }
});
test('approval, invalidation and rejection bind to their exact revision or proposal', async () => {
  const f = await fixture();
  for (const kind of ['REVIEW_APPROVED', 'INVALIDATION', 'REVIEW_REJECTED'] as const) {
    const e = await f.nutritionEvent(kind), target = kind === 'REVIEW_REJECTED' ? f.proposal : f.revision;
    const result = await decodeEvent(raw(e), raw(target), raw(f.pins)); assert.deepEqual(result, e);
    assert.ok(Object.isFrozen(result.authorityContext)); assert.ok(Object.isFrozen(result.target));
  }
});
test('canonical bytes have separate revision/event domains and independently hashed bytes', async () => {
  const f = await fixture();
  assert.equal(sha(await revisionBytes(raw(f.revision), raw(f.pins))), f.revision.digest);
  assert.equal(sha(await eventBytes(raw(f.na))), f.na.digest);
  const revisionPayload = JSON.parse(new TextDecoder().decode(await revisionBytes(raw(f.revision), raw(f.pins)))) as { domain: string; payload: object };
  assert.equal(revisionPayload.domain, 'potok-exact-food-nutrition-revision-sha256-v2');
  assert.ok(!Object.prototype.hasOwnProperty.call(revisionPayload.payload, 'digest'));
  assert.notEqual(f.revision.digest, f.proposal.digest); assert.notEqual(f.revision.digest, f.na.digest);
});
test('own digest tampering fails, valid hashes alone cannot replace caller source pins', async () => {
  const f = await fixture();
  await assert.rejects(decodeRevision(raw({ ...f.revision, digest: '0'.repeat(64) }), raw(f.pins)), /SELF_DIGEST/);
  await assert.rejects(decodeEvent(raw({ ...f.na, digest: '0'.repeat(64) }), raw(f.revision), raw(f.pins)), /SELF_DIGEST/);
  await assert.rejects(decodeRevision(raw(f.revision), raw({ ...f.pins, canonicalRevisionDigest: '0'.repeat(64) })), /CANONICAL_PIN/);
});
test('self supersession, missing IDs and cross-version contracts reject', async () => {
  const f = await fixture();
  for (const patch of [{ supersedesRevisionId: f.revision.revisionId }, { reviewEventId: null }, { contract: 'legacy' }, { encoding: 'legacy' }, { approved: true }]) {
    await assert.rejects(revisionDigest(raw({ ...f.revision, ...patch }), raw(f.pins)));
  }
  await assert.rejects(decodeNutritionReviewedRevisionRawV1(raw(f.revision), raw(f.canonical)));
  await assert.rejects(decodeFoodEvidenceReviewEventRawV1(raw(f.na), raw(f.revision)));
});
test('event cannot change revision, digest, food or approval ID after resealing', async () => {
  const f = await fixture();
  for (const patch of [{ revisionId: id(90) }, { digest: '0'.repeat(64) }, { canonicalFoodId: id(90) }]) {
    const changed = { ...f.na, target: { ...f.na.target, ...patch } };
    const sealed = { ...changed, digest: await eventDigest(raw(changed)) };
    await assert.rejects(decodeEvent(raw(sealed), raw(f.revision), raw(f.pins)), /REVISION_BINDING/);
  }
  const changed = { ...f.na, eventId: id(90) };
  await assert.rejects(decodeEvent(raw({ ...changed, digest: await eventDigest(raw(changed)) }), raw(f.revision), raw(f.pins)), /REVIEW_EVENT_BINDING/);
});
test('rejections require pinned proposal, cannot manufacture a reviewed revision', async () => {
  const f = await fixture(), event = await f.nutritionEvent('REVIEW_REJECTED');
  await assert.rejects(decodeEvent(raw(event), raw(f.revision), raw(f.pins)));
  const changed = { ...event, target: { ...event.target, digest: '0'.repeat(64) } };
  await assert.rejects(decodeEvent(raw({ ...changed, digest: await eventDigest(raw(changed)) }), raw(f.proposal), raw(f.pins)), /PROPOSAL_BINDING/);
});
test('authority context reuses V1 shape constraints without granting privileges', async () => {
  const f = await fixture();
  for (const authorityContext of [{ ...f.na.authorityContext, role: 'USER' }, { ...f.na.authorityContext, boundary: 'CLIENT' },
    { ...f.na.authorityContext, actorId: 'admin' }, { ...f.na.authorityContext, authorityReference: '' }, { ...f.na.authorityContext, isAdmin: true }]) {
    await assert.rejects(eventDigest(raw({ ...f.na, authorityContext })));
  }
});
test('strict event variant fields, UTC dates and SERVER time declaration are mandatory', async () => {
  const f = await fixture();
  for (const patch of [{ kind: 'UNKNOWN' }, { occurredAt: '2026-02-30T00:00:00.000Z' }, { occurredAt: '2026-11-05T01:00:00Z' },
    { timestampOrigin: 'CLIENT' }, { idempotencyReference: null }, { requestDigest: 'X'.repeat(64) }, { reason: 'extra' }]) {
    await assert.rejects(eventDigest(raw({ ...f.na, ...patch })));
  }
  const invalidation = await f.nutritionEvent('INVALIDATION');
  await assert.rejects(eventDigest(raw({ ...invalidation, severity: 'WARN' })));
  await assert.rejects(eventDigest(raw({ ...invalidation, reason: '\ud800' })));
});
test('both invalidation severities retain exact revision binding', async () => {
  const f = await fixture(), event = await f.nutritionEvent('INVALIDATION');
  for (const severity of ['CORRECTION', 'SAFETY_CRITICAL'] as const) {
    const changed = { ...event, severity }, sealed = { ...changed, digest: await eventDigest(raw(changed)) };
    assert.equal((await decodeEvent(raw(sealed), raw(f.revision), raw(f.pins))).kind, 'INVALIDATION');
  }
});
test('duplicate keys, depth and byte budgets apply to versioned artifacts', async () => {
  const f = await fixture();
  await assert.rejects(decodeRevision(raw(f.revision).replace('{', '{"contract":"duplicate",'), raw(f.pins)));
  await assert.rejects(eventDigest(raw(f.na).replace('{', '{"eventId":"duplicate",')));
  await assert.rejects(eventDigest(' '.repeat(262145)), /RAW_BUDGET/);
  await assert.rejects(revisionDigest('['.repeat(13) + '0' + ']'.repeat(13), raw(f.pins)), /RAW_DEPTH/);
});
test('source proposal modifications reject before revision hash calculation', async () => {
  const f = await fixture(), changed = copy(f.revision) as unknown as { sourceProposal: { authority: string } };
  changed.sourceProposal.authority = 'OWNER';
  await assert.rejects(revisionDigest(raw(changed), raw(f.pins)), /CONTRACT/);
});

test('nested retained negative zero is rejected before serialization can normalize it', async () => {
  const f = await fixture();
  const changed = raw(f.revision).replace(/"byteLength":\d+/, '"byteLength":-0');
  await assert.rejects(revisionDigest(changed, raw(f.pins)), /RAW_NUMBER/);
});
