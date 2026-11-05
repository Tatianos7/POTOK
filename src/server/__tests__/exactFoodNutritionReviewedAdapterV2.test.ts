import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExactFoodNutritionReviewedSnapshotV2 as resolve, type ExactFoodNutritionReviewAuthorityV2 } from '../exactFoodNutritionReviewedAdapterV2';
import { exactFoodFixtureV2 as fixture, raw, id } from './exactFoodNutritionFixturesV2';
import { exactFoodNutritionEventDigestRawV2, exactFoodNutritionEventContractV2 } from '../../utils/exactFoodNutritionEvidenceV2';
import type { ReviewedEvidenceAuthorityV1 } from '../nutritionIntegrityReviewedEvidenceAdapterV1';
import { foodEvidenceReviewEventDigestRawV1 } from '../../utils/foodReviewedEvidenceV1';
const authorized: ExactFoodNutritionReviewAuthorityV2 = { isAuthorizedEvent: async () => true };
// This test double proves control flow only, never JWT validity or real store completeness.

test('complete independently authorized atomic snapshot returns exact V2 values without legacy rounding', async () => {
  for (const basis of ['PER_100_G_FOOD', 'PER_100_G_EDIBLE'] as const) {
    const f = await fixture(basis), calls: string[] = [];
    const result = await resolve(f.snapshot, { isAuthorizedEvent: async event => { calls.push(event.eventId); return true; } });
    assert.equal(result.kind, 'REVIEWED_EXACT_V2');
    if (result.kind !== 'REVIEWED_EXACT_V2') throw Error('expected exact result');
    assert.deepEqual(result.numericInput, f.input); assert.equal(result.numericInput.reference.basis, basis);
    assert.equal(result.nutritionDigest, f.revision.digest); assert.equal(result.approvalEventId, f.na.eventId);
    assert.equal(result.sourceProposalDigest, f.proposal.digest); assert.ok(Object.isFrozen(result.numericInput.values));
    assert.deepEqual(calls, [f.ca.eventId, f.na.eventId, f.ca.eventId, f.na.eventId]);
  }
});
test('truthy claims cannot substitute for independent authorization or throwing authority port', async () => {
  const f = await fixture();
  for (const value of [false, undefined, null, 'ADMIN', {}, 1]) {
    const authority = { isAuthorizedEvent: async () => value } as unknown as ExactFoodNutritionReviewAuthorityV2;
    assert.equal((await resolve(f.snapshot, authority)).kind, 'UNRESOLVED');
  }
  assert.equal((await resolve(f.snapshot, { isAuthorizedEvent: async () => { throw Error('unavailable'); } })).kind, 'UNRESOLVED');
});
test('canonical and nutrition approvals each require event-time authorization', async () => {
  const f = await fixture();
  for (const denied of [f.ca.eventId, f.na.eventId]) {
    assert.equal((await resolve(f.snapshot, { isAuthorizedEvent: async event => event.eventId !== denied })).kind, 'UNRESOLVED');
  }
});
test('V1-only authorization implementation cannot confirm V2 events', async () => {
  const f = await fixture();
  assert.equal((await resolve(f.snapshot, { isAuthorizedEvent: async event => event.contract !== exactFoodNutritionEventContractV2 })).kind, 'UNRESOLVED');
});
test('authority failure during full history check closes the result', async () => {
  const f = await fixture(); let calls = 0;
  assert.equal((await resolve(f.snapshot, { isAuthorizedEvent: async () => ++calls < 3 })).kind, 'UNRESOLVED');
  assert.equal(calls, 3);
});
test('foreign identity, stale heads and state mismatch fail without invoking authorization', async () => {
  const f = await fixture();
  for (const change of [{ requestedFoodId: id(90) }, { activeCanonicalRevisionId: id(90) }, { activeNutritionRevisionId: id(90) }, { currentFoodState: 'cooked' as const }]) {
    let calls = 0;
    assert.equal((await resolve({ ...f.snapshot, ...change }, { isAuthorizedEvent: async () => { calls++; return true; } })).kind, 'UNRESOLVED');
    assert.equal(calls, 0);
  }
});
test('empty, missing, duplicate and malformed histories all fail', async () => {
  const f = await fixture();
  for (const relevantEventRaws of [[], [raw(f.ca)], [raw(f.na)], [raw(f.ca), raw(f.ca)],
    [...f.snapshot.relevantEventRaws, raw(f.na)], [raw(f.ca), 'null'], [raw(f.ca), '{broken'],
    [raw(f.ca), raw(f.na).replace('{', '{"contract":"duplicate",')]]) {
    assert.equal((await resolve({ ...f.snapshot, relevantEventRaws }, authorized)).kind, 'UNRESOLVED');
  }
});
test('sparse and oversized histories reject before invoking authority', async () => {
  const f = await fixture();
  for (const relevantEventRaws of [new Array<string>(2), Array<string>(1025).fill(raw(f.na))]) {
    let calls = 0;
    assert.equal((await resolve({ ...f.snapshot, relevantEventRaws }, { isAuthorizedEvent: async () => { calls++; return true; } })).kind, 'UNRESOLVED');
    assert.equal(calls, 0);
  }
});
test('canonical invalidation blocks regardless of history order or earlier date', async () => {
  const f = await fixture(), original = await f.canonicalEvent(true);
  const changed = { ...original, occurredAt: '2026-11-04T00:00:00.000Z' };
  const event = { ...changed, digest: await foodEvidenceReviewEventDigestRawV1(raw(changed)) };
  for (const relevantEventRaws of [[raw(event), ...f.snapshot.relevantEventRaws], [...f.snapshot.relevantEventRaws, raw(event)]]) {
    assert.equal((await resolve({ ...f.snapshot, relevantEventRaws }, authorized)).kind, 'UNRESOLVED');
  }
});
test('both nutrition invalidation severities block, without selecting a later approval', async () => {
  const f = await fixture(), original = await f.nutritionEvent('INVALIDATION');
  for (const severity of ['CORRECTION', 'SAFETY_CRITICAL'] as const) {
    const changed = { ...original, severity }, event = { ...changed, digest: await exactFoodNutritionEventDigestRawV2(raw(changed)) };
    assert.equal((await resolve({ ...f.snapshot, relevantEventRaws: [raw(event), ...f.snapshot.relevantEventRaws] }, authorized)).kind, 'UNRESOLVED');
  }
});
test('another individually valid approval with same event ID but changed payload cannot replace stored approval', async () => {
  const f = await fixture();
  const nutrition = { ...f.na, authorityContext: { ...f.na.authorityContext, authorityReference: 'different attestation' } };
  const nutritionChanged = { ...nutrition, digest: await exactFoodNutritionEventDigestRawV2(raw(nutrition)) };
  assert.equal((await resolve({ ...f.snapshot, relevantEventRaws: [raw(f.ca), raw(nutritionChanged)] }, authorized)).kind, 'UNRESOLVED');
  const canonical = { ...f.ca, authorityContext: { ...f.ca.authorityContext, authorityReference: 'different attestation' } };
  const canonicalChanged = { ...canonical, digest: await foodEvidenceReviewEventDigestRawV1(raw(canonical)) };
  assert.equal((await resolve({ ...f.snapshot, relevantEventRaws: [raw(canonicalChanged), raw(f.na)] }, authorized)).kind, 'UNRESOLVED');
});
test('proposal and rejection never stand in for approved nutrition evidence', async () => {
  const f = await fixture(), rejection = await f.nutritionEvent('REVIEW_REJECTED');
  assert.equal((await resolve({ ...f.snapshot, nutritionRaw: raw(f.proposal) }, authorized)).kind, 'UNRESOLVED');
  assert.equal((await resolve({ ...f.snapshot, nutritionApprovalRaw: raw(rejection) }, authorized)).kind, 'UNRESOLVED');
  assert.equal((await resolve({ ...f.snapshot, relevantEventRaws: [...f.snapshot.relevantEventRaws, raw(rejection)] }, authorized)).kind, 'UNRESOLVED');
});
test('source pins cannot be replaced by self-consistent reviewed artifacts', async () => {
  const f = await fixture();
  const pins = { ...f.pins, numericInputDigest: '0'.repeat(64) };
  assert.equal((await resolve({ ...f.snapshot, sourcePinsRaw: raw(pins) }, authorized)).kind, 'UNRESOLVED');
});
test('unrelated targets and wrong approval variants reject', async () => {
  const f = await fixture(), altered = { ...f.na, target: { ...f.na.target, canonicalFoodId: id(90) } };
  const wrongTarget = { ...altered, digest: await exactFoodNutritionEventDigestRawV2(raw(altered)) };
  assert.equal((await resolve({ ...f.snapshot, nutritionApprovalRaw: raw(wrongTarget) }, authorized)).kind, 'UNRESOLVED');
  assert.equal((await resolve({ ...f.snapshot, canonicalApprovalRaw: raw(f.na) }, authorized)).kind, 'UNRESOLVED');
});
test('context and history are owned before async authorization yields', async () => {
  const f = await fixture(), snapshot = { ...f.snapshot, relevantEventRaws: [...f.snapshot.relevantEventRaws] };
  let calls = 0;
  const result = await resolve(snapshot, { isAuthorizedEvent: async () => {
    if (++calls === 1) { snapshot.activeNutritionRevisionId = id(90); snapshot.sourcePinsRaw = '{}'; snapshot.relevantEventRaws.length = 0; }
    return true;
  } });
  assert.equal(result.kind, 'REVIEWED_EXACT_V2'); assert.equal(calls, 4);
});

test('V1-only typed verifier cannot be assigned to the union authority port', () => {
  const legacy: ReviewedEvidenceAuthorityV1 = { isAuthorizedEvent: async () => true };
  // @ts-expect-error A verifier that only accepts V1 must explicitly support V2 before integration.
  const invalid: ExactFoodNutritionReviewAuthorityV2 = legacy;
  void invalid;
});
