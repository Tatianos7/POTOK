import assert from 'node:assert/strict';
import test from 'node:test';
import { admitSynthetic, admitFreeCorrectionSynthetic, decodeActualFixture, decodeAdaptiveNutritionWireV1,
  adaptiveNutritionCanonicalEncodingV1, effectiveEntitlementV1, normalizeWireAmount,
  restartLookupSynthetic, reduceLifecycleSynthetic, lifecycleDecisionSynthetic,
  legacyBatchSynthetic, draftStatus, effectiveSyntheticDiary, legacyWriteAllowed, lookupSynthetic,
  matchesExactSyntheticRead, ordinaryProfilePatchAllowed, syntheticCanonical,
  type FreeDiaryRequest,
  type EntitlementAttestationV1, type EntitlementCapabilityV1,
  type ExactReadProof, type MutationRequest, type Receipt, type RevisionVector,
  type SyntheticDiaryRow, type SyntheticEvent, type SyntheticLedgerRecord,
  type SyntheticLifecycleState } from './adaptive-nutrition-server-v1';

// Synthetic identifiers, not canonical UUIDs or persisted records.
const context: RevisionVector = { accountId: 'fixture-A', planId: 'fixture-selection',
  planRevision: 'plan-original', goalRevision: 'goal-original', historyRevision: 'history-original',
  diaryRevision: 'diary-original', weekAnchor: '2026-09-14', timeZone: 'Europe/Moscow' };
const slot = { slotId: 'fixture-slot', date: '2026-09-16', snapshot: {
  snapshotRevision: 'snapshot-original', recipeRevision: 'recipe-original', portionRevision: 'portion-original' } };
function request(): MutationRequest { return { contract: 'adaptive-nutrition-v1-proposed', expected: { ...context },
  idempotencyKey: 'fixture-key', explicitConfirmation: true, action: { type: 'CONSUMED_AS_PLANNED', slot: structuredClone(slot) } }; }
const access = { accountId: context.accountId, verifiedProvenance: 'fixture-reviewed-authority', allowed: true, validUntil: 200 };
const wireIds = {
  account: '00000000-0000-4000-8000-000000000001', plan: '00000000-0000-4000-8000-000000000002',
  planRevision: '00000000-0000-4000-8000-000000000003', goalRevision: '00000000-0000-4000-8000-000000000004',
  historyRevision: '00000000-0000-4000-8000-000000000005', diaryRevision: '00000000-0000-4000-8000-000000000006',
  key: '00000000-0000-4000-8000-000000000007', slot: '00000000-0000-4000-8000-000000000008',
  snapshot: '00000000-0000-4000-8000-000000000009', portion: '00000000-0000-4000-8000-00000000000a',
  foodA: '00000000-0000-4000-8000-00000000000b', foodB: '00000000-0000-4000-8000-00000000000c',
  recipe: '00000000-0000-4000-8000-00000000000d',
};
const entitlementIds = {
  accountB: '00000000-0000-4000-8000-00000000000e',
  grant: '00000000-0000-4000-8000-00000000000f',
  revoke: '00000000-0000-4000-8000-000000000010',
  adminGrant: '00000000-0000-4000-8000-000000000011',
  operator: '00000000-0000-4000-8000-000000000012',
};
function entitlementGrant(capability: EntitlementCapabilityV1 = 'premium',
  accountId = wireIds.account, attestationId = entitlementIds.grant): EntitlementAttestationV1 {
  return { contract: 'potok-entitlement-attestation-v1', authority: 'owner-controlled-server-v1',
    attestationId, accountId, capability, effect: 'GRANT', previousAttestationId: null,
    sequence: '1', issuedAt: '2026-09-21T10:00:00.000Z', validUntil: '2026-10-21T10:00:00.000Z',
    operatorId: entitlementIds.operator, evidenceRef: 'owner-review/fixture-grant' };
}
function wireRequest(amount: unknown = '1') {
  return { contract: 'adaptive-nutrition-v1-proposed', expected: {
    accountId: wireIds.account, planId: wireIds.plan, planRevision: wireIds.planRevision,
    goalRevision: wireIds.goalRevision, historyRevision: wireIds.historyRevision,
    diaryRevision: wireIds.diaryRevision, weekAnchor: '2026-09-14', timeZone: 'Europe/Moscow' },
  idempotencyKey: wireIds.key, explicitConfirmation: true, action: {
    type: 'CONSUMED_MODIFIED', slot: { slotId: wireIds.slot, date: '2026-09-16', snapshot: {
      snapshotRevision: wireIds.snapshot, recipeRevision: null as string | null, portionRevision: wireIds.portion } },
    actual: { items: [{ foodRef: wireIds.foodA, amount, unit: 'g', state: 'cooked' }] } } };
}
function receipt(): Receipt { return { accountId: context.accountId, operationId: 'fixture-operation', idempotencyKey: 'fixture-key',
  requestDigest: 'fixture-server-digest', digestVersion: 'fixture-only', outcome: 'accepted',
  result: { ...context, historyRevision: 'history-after', diaryRevision: 'diary-after' },
  confirmedSlots: [structuredClone(slot)], eventIds: ['fixture-event'] }; }
function ledger(): SyntheticLedgerRecord { return { request: request(), receipt: receipt() }; }
function event(id = 'original', supersedes: string | null = null, ordinal = 1): SyntheticEvent {
  return { id, accountId: context.accountId, planId: context.planId, streamId: 'fact-stream', date: slot.date,
    kind: 'FACT', supersedes, ordinal, componentIds: ['component'] };
}
function row(eventId: string | null = 'original'): SyntheticDiaryRow {
  return { id: `row-${eventId}`, accountId: context.accountId, date: slot.date, eventId, componentId: eventId ? 'component' : null };
}

test('draft is PROPOSED and transport remains disabled', () => {
  assert.deepEqual(draftStatus, { decision: 'PROPOSED', persistenceEnabled: false });
});
test('ordinary profile INSERT/UPDATE payloads cannot set, clear or echo privilege/provenance fields', () => {
  for (const field of ['has_premium', 'is_admin', 'premium_provenance_id', 'premium_valid_until', 'admin_provenance_id']) {
    for (const value of [true, false, null, 'forged']) assert.equal(ordinaryProfilePatchAllowed({ [field]: value }), false);
  }
  assert.equal(ordinaryProfilePatchAllowed({ first_name: 'Fixture', height: 170 }), true);
  assert.equal(ordinaryProfilePatchAllowed({}), true); // INSERT uses protected server defaults.
  assert.equal(ordinaryProfilePatchAllowed({ user_id: 'foreign' }), false);
});
test('new paid effect requires verified authority, not old true flags or expiry-blind access', () => {
  assert.equal(admitSynthetic(context.accountId, request(), context, access, 100), 'new-paid-effect-eligible');
  for (const denied of [null, { ...access, verifiedProvenance: null }, { ...access, allowed: false },
    { ...access, validUntil: 100 }, { ...access, accountId: 'fixture-B' }, { ...access, validUntil: NaN }]) {
    assert.equal(admitSynthetic(context.accountId, request(), context, denied, 100), 'denied');
  }
});
test('owner-controlled Premium grant yields verified access with deterministic provenance', () => {
  const grant = entitlementGrant();
  const decision = effectiveEntitlementV1(wireIds.account, 'premium', '2026-09-21T11:00:00.000Z',
    [grant], { hasPremium: false, isAdmin: false });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, 'verified-grant');
  assert.equal(decision.provenanceAttestationId, grant.attestationId);
  assert.match(decision.lineageDigestSha256 ?? '', /^[0-9a-f]{64}$/);
});
test('expired Premium grant fails closed and old has_premium cannot revive it', () => {
  const grant = entitlementGrant();
  const decision = effectiveEntitlementV1(wireIds.account, 'premium', grant.validUntil!,
    [grant], { hasPremium: true, isAdmin: false });
  assert.deepEqual({ allowed: decision.allowed, reason: decision.reason }, { allowed: false, reason: 'expired' });
  assert.equal(decision.provenanceAttestationId, grant.attestationId);
});
test('revoke supersedes grant at its effective time and audit lineage is input-order deterministic', () => {
  const grant = entitlementGrant();
  const revoke: EntitlementAttestationV1 = { ...grant, attestationId: entitlementIds.revoke,
    effect: 'REVOKE', previousAttestationId: grant.attestationId, sequence: '2',
    issuedAt: '2026-09-22T10:00:00.000Z', validUntil: null, evidenceRef: 'owner-review/fixture-revoke' };
  const before = effectiveEntitlementV1(wireIds.account, 'premium', '2026-09-22T09:59:59.999Z',
    [revoke, grant], { hasPremium: false, isAdmin: false });
  const after = effectiveEntitlementV1(wireIds.account, 'premium', '2026-09-22T10:00:00.000Z',
    [grant, revoke], { hasPremium: false, isAdmin: false });
  assert.equal(before.reason, 'verified-grant');
  assert.deepEqual({ allowed: after.allowed, reason: after.reason }, { allowed: false, reason: 'revoked' });
  assert.equal(after.provenanceAttestationId, revoke.attestationId);
  assert.equal(after.lineageDigestSha256, before.lineageDigestSha256);
});
test('old true flags remain explicitly unverified without an attestation', () => {
  assert.deepEqual(effectiveEntitlementV1(wireIds.account, 'premium', '2026-09-21T11:00:00.000Z',
    [], { hasPremium: true, isAdmin: true }), {
    allowed: false, reason: 'old-flag-unverified', provenanceAttestationId: null, lineageDigestSha256: null });
  assert.equal(effectiveEntitlementV1(wireIds.account, 'admin', '2026-09-21T11:00:00.000Z',
    [], { hasPremium: true, isAdmin: true }).reason, 'old-flag-unverified');
});
test('attestations and predecessor links cannot cross account scope', () => {
  const grantA = entitlementGrant();
  const forB = effectiveEntitlementV1(entitlementIds.accountB, 'premium', '2026-09-21T11:00:00.000Z',
    [grantA], { hasPremium: false, isAdmin: false });
  assert.equal(forB.allowed, false);
  assert.equal(forB.reason, 'no-verified-attestation');
  const crossAccountRevoke: EntitlementAttestationV1 = { ...grantA, accountId: entitlementIds.accountB,
    attestationId: entitlementIds.revoke, effect: 'REVOKE', previousAttestationId: grantA.attestationId,
    sequence: '2', validUntil: null };
  assert.equal(effectiveEntitlementV1(entitlementIds.accountB, 'premium', '2026-09-21T11:00:00.000Z',
    [grantA, crossAccountRevoke], { hasPremium: false, isAdmin: false }).reason, 'invalid-lineage');
  assert.equal(effectiveEntitlementV1(wireIds.account, 'premium', '2026-09-21T11:00:00.000Z',
    [grantA, crossAccountRevoke], { hasPremium: false, isAdmin: false }).reason, 'verified-grant');
});
test('admin and Premium capabilities never imply each other', () => {
  const adminGrant = entitlementGrant('admin', wireIds.account, entitlementIds.adminGrant);
  assert.equal(effectiveEntitlementV1(wireIds.account, 'admin', '2026-09-21T11:00:00.000Z',
    [adminGrant], { hasPremium: false, isAdmin: false }).allowed, true);
  const premiumDecision = effectiveEntitlementV1(wireIds.account, 'premium', '2026-09-21T11:00:00.000Z',
    [adminGrant], { hasPremium: false, isAdmin: true });
  assert.equal(premiumDecision.allowed, false);
  assert.equal(premiumDecision.reason, 'no-verified-attestation');
  const premiumGrant = entitlementGrant();
  assert.equal(effectiveEntitlementV1(wireIds.account, 'admin', '2026-09-21T11:00:00.000Z',
    [premiumGrant], { hasPremium: true, isAdmin: false }).allowed, false);
});
test('same original action replays after expiry and goal/week/head changes without authorizing another effect', () => {
  const record = ledger(); const before = structuredClone(record);
  const newer = { ...context, planRevision: 'new', goalRevision: 'new', weekAnchor: '2026-09-21', timeZone: 'UTC' };
  assert.equal(admitSynthetic(context.accountId, request(), newer, null, 300, record), 'exact-replay');
  assert.deepEqual(lookupSynthetic(context.accountId, 'fixture-key', record), { kind: 'settled', receipt: record.receipt });
  assert.equal(admitSynthetic(context.accountId, { ...request(), idempotencyKey: 'new-key' }, newer, null, 300), 'denied');
  assert.deepEqual(record, before);
});
test('same key with another payload conflicts even after expiry; account switch cannot replay or lookup another actor', () => {
  assert.equal(admitSynthetic(context.accountId, { ...request(), action: { type: 'SKIPPED', slot } }, context, null, 300, ledger()), 'conflict');
  assert.equal(admitSynthetic('fixture-B', request(), context, access, 100, ledger()), 'denied');
  assert.deepEqual(lookupSynthetic('fixture-B', 'fixture-key', ledger()), { kind: 'denied' });
  assert.deepEqual(lookupSynthetic(null, 'fixture-key', ledger()), { kind: 'denied' });
  assert.deepEqual(lookupSynthetic(context.accountId, 'different-key', ledger()), { kind: 'denied' });
});
test('terminal rejection/conflict receipts replay unchanged; missing outcome remains UNKNOWN', () => {
  for (const outcome of ['conflict', 'rejected'] as const) {
    const record: SyntheticLedgerRecord = { request: request(), receipt: { accountId: context.accountId,
      operationId: 'fixture-refused', idempotencyKey: 'fixture-key', requestDigest: 'fixture-digest',
      digestVersion: 'fixture-only', outcome, reason: 'fixture-terminal-reason' } };
    assert.equal(admitSynthetic(context.accountId, request(), context, access, 100, record), 'exact-replay');
    assert.deepEqual(lookupSynthetic(context.accountId, 'fixture-key', record), { kind: 'settled', receipt: record.receipt });
  }
  assert.deepEqual(lookupSynthetic(context.accountId, 'fixture-key'), { kind: 'unknown', reason: 'not_observed_or_in_flight' });
});
test('every stale revision/calendar binding conflicts; sequential head change models competing expected revisions only', () => {
  for (const field of ['planId', 'planRevision', 'goalRevision', 'historyRevision', 'diaryRevision', 'weekAnchor', 'timeZone'] as const) {
    assert.equal(admitSynthetic(context.accountId, request(), { ...context, [field]: 'different' }, access, 100), 'conflict', field);
  }
  assert.equal(admitSynthetic(context.accountId, request(), context, access, 100), 'new-paid-effect-eligible');
  assert.equal(admitSynthetic(context.accountId, { ...request(), idempotencyKey: 'competing-key' },
    { ...context, historyRevision: 'committed-other-action' }, access, 100), 'conflict');
  // This is NOT concurrent DB execution or proof of atomic CAS.
});
test('local canonical equality is key-order independent and rejects lossy values; retry retains the original envelope', () => {
  const req = request(); const retry = structuredClone(req);
  assert.equal(syntheticCanonical(req), syntheticCanonical({ ...retry, expected: { ...retry.expected } }));
  assert.equal(syntheticCanonical({ a: 1, b: 2 }), syntheticCanonical({ b: 2, a: 1 }));
  for (const value of [undefined, NaN, Infinity, new Date()]) assert.throws(() => syntheticCanonical(value));
  assert.deepEqual(retry, req);
});
test('history edit counts only new components; undo counts none and never resurrects old fact', () => {
  const original = event(); const edit = event('edit', 'original', 2);
  const legacy = row(null); const rows = [row(), row('edit'), legacy];
  const before = structuredClone(rows);
  assert.deepEqual(effectiveSyntheticDiary(context.accountId, [original, edit], rows).map(r => r.id), ['row-edit', 'row-null']);
  const undo: SyntheticEvent = { ...event('undo', 'edit', 3), kind: 'FACT_RETRACTION', componentIds: [] };
  assert.deepEqual(effectiveSyntheticDiary(context.accountId, [original, edit, undo], rows), [legacy]);
  assert.deepEqual(rows, before);
});
test('skip/retraction has no consumed projection; extra fact stream leaves other facts effective', () => {
  const skip: SyntheticEvent = { ...event('skip'), kind: 'ANNOTATION', streamId: 'skip-stream', componentIds: [] };
  const extra = { ...event('extra'), streamId: 'extra-stream' };
  assert.deepEqual(effectiveSyntheticDiary(context.accountId, [skip], []), []);
  assert.throws(() => effectiveSyntheticDiary(context.accountId, [skip], [row('skip')]), /diary rows/);
  assert.deepEqual(effectiveSyntheticDiary(context.accountId, [event(), extra, skip], [row(), row('extra')]).map(r => r.id), ['row-original', 'row-extra']);
});
test('projection fails closed on orphan, branch, missing/duplicate component, wrong scope and attempted resurrection', () => {
  assert.throws(() => effectiveSyntheticDiary(context.accountId, [], [row()]), /Orphan/);
  assert.throws(() => effectiveSyntheticDiary(context.accountId, [event()], []), /Incomplete/);
  assert.throws(() => effectiveSyntheticDiary(context.accountId, [event()], [row(), { ...row(), id: 'duplicate-component' }]), /Incomplete/);
  assert.throws(() => effectiveSyntheticDiary(context.accountId, [event(), event('root2')], [row(), row('root2')]), /Duplicate stream/);
  assert.throws(() => effectiveSyntheticDiary(context.accountId, [event(), event('edit', 'original', 2), event('fork', 'original', 3)],
    [row(), row('edit'), row('fork')]), /Invalid history/);
  for (const invalid of [{ planId: 'different' }, { date: '2026-09-17' }, { streamId: 'different' }, { ordinal: 1 }]) {
    assert.throws(() => effectiveSyntheticDiary(context.accountId, [event(), { ...event('edit', 'original', 2), ...invalid }], [row(), row('edit')]));
  }
  const undo: SyntheticEvent = { ...event('undo', 'original', 2), kind: 'FACT_RETRACTION', componentIds: [] };
  assert.throws(() => effectiveSyntheticDiary(context.accountId, [event(), undo, event('resurrect', 'undo', 3)], [row(), row('resurrect')]), /Invalid history/);
});
test('own history projection remains account scoped without Premium input', () => {
  assert.deepEqual(effectiveSyntheticDiary('fixture-B', [event()], [row()]), []);
  assert.deepEqual(effectiveSyntheticDiary(context.accountId, [event()], [row()]), [row()]);
});
test('legacy UPDATE/DELETE/upsert cannot strip marker, move protected rows or bulk-recreate managed dates', () => {
  const legacy = row(null); const managed = new Set([slot.date]);
  assert.equal(legacyWriteAllowed(context.accountId, null, legacy, new Set()), true);
  assert.equal(legacyWriteAllowed(context.accountId, row(), legacy, new Set()), false);
  assert.equal(legacyWriteAllowed(context.accountId, row(), null, new Set()), false);
  assert.equal(legacyWriteAllowed(context.accountId, legacy, row(), new Set()), false);
  assert.equal(legacyWriteAllowed(context.accountId, null, legacy, managed), false);
  assert.equal(legacyWriteAllowed(context.accountId, legacy, { ...legacy, date: '2026-09-22' }, managed), false);
  assert.equal(legacyWriteAllowed('fixture-B', null, legacy, new Set()), false);
});
test('exact accepted read needs graph AND diary/history revisions, operation, event set and confirmed snapshot', () => {
  const accepted = receipt(); assert.equal(accepted.outcome, 'accepted');
  if (accepted.outcome !== 'accepted') throw new Error('fixture');
  const proof: ExactReadProof = { operationId: accepted.operationId, revisions: accepted.result,
    coverage: 'complete', matchedEventIds: accepted.eventIds, confirmedSlots: accepted.confirmedSlots, historical: true };
  assert.equal(matchesExactSyntheticRead(accepted, proof), true);
  for (const field of ['accountId', 'planId', 'planRevision', 'goalRevision', 'historyRevision', 'diaryRevision', 'weekAnchor', 'timeZone'] as const) {
    assert.equal(matchesExactSyntheticRead(accepted, { ...proof, revisions: { ...proof.revisions, [field]: 'unproven' } }), false);
  }
  assert.equal(matchesExactSyntheticRead(accepted, { ...proof, matchedEventIds: [] }), false);
  assert.equal(matchesExactSyntheticRead(accepted, { ...proof, operationId: 'another' }), false);
  assert.equal(matchesExactSyntheticRead(accepted, { ...proof, confirmedSlots: [] }), false);
});

test('Free own correction/retraction does not depend on expired Premium or current plan; cannot disguise paid effects', () => {
  const target = { accountId: context.accountId, eventId: 'own-fact', eventRevision: 'fact-head', liveFact: true };
  const retract: FreeDiaryRequest = { contract: 'free-diary-v1-proposed', accountId: context.accountId,
    idempotencyKey: 'free-key', explicitConfirmation: true,
    action: { type: 'RETRACT_FACT', targetEventId: target.eventId, expectedEventRevision: target.eventRevision } };
  assert.equal(admitFreeCorrectionSynthetic(context.accountId, retract, target), 'eligible');
  assert.equal(admitFreeCorrectionSynthetic(context.accountId, { ...retract, action: { ...retract.action,
    type: 'CORRECT_FACT', targetEventId: target.eventId, expectedEventRevision: target.eventRevision,
    actual: { items: [{ foodRef: 'fixture-food', amount: '12.50', unit: 'g', state: 'cooked' }] } } }, target), 'eligible');
  assert.equal(admitFreeCorrectionSynthetic('fixture-B', retract, target), 'denied');
  assert.equal(admitFreeCorrectionSynthetic(context.accountId, retract, { ...target, accountId: 'fixture-B' }), 'denied');
  assert.equal(admitFreeCorrectionSynthetic(context.accountId, retract, { ...target, eventRevision: 'newer' }), 'conflict');
  assert.equal(admitFreeCorrectionSynthetic(context.accountId, retract, { ...target, liveFact: false }), 'conflict');
  for (const payload of [{ ...retract, action: { type: 'REPLACE', replacementOfferId: 'paid' } },
    { ...retract, action: { ...retract.action, planRevision: 'forged' } }]) {
    assert.equal(admitFreeCorrectionSynthetic(context.accountId, payload as FreeDiaryRequest, target), 'denied');
  }
  assert.equal(admitSynthetic(context.accountId, request(), context, null, 300), 'denied');
  const settled: SyntheticLedgerRecord = { request: retract, receipt: {
    accountId: context.accountId, operationId: 'free-operation', idempotencyKey: retract.idempotencyKey,
    requestDigest: 'fixture-digest', digestVersion: 'fixture-only', outcome: 'accepted',
    streamId: 'own-stream', eventRevision: 'retracted', eventIds: ['free-retraction'],
    linkedPlanId: null, linkedHistoryRevision: null, linkedDiaryRevision: null } };
  assert.equal(admitFreeCorrectionSynthetic(context.accountId, retract, null, settled), 'exact-replay');
  assert.equal(lookupSynthetic(context.accountId, retract.idempotencyKey, settled).kind, 'settled');
  assert.equal(admitSynthetic(context.accountId, { ...request(), idempotencyKey: retract.idempotencyKey },
    context, access, 100, settled), 'conflict'); // Same ledger key cannot cross Free/paid protocols.
});
test('wire decimal rejects rounding, exponents, number coercion and storage overflow; equivalent encodings normalize exactly', () => {
  assert.equal(normalizeWireAmount('1'), '1.00');
  assert.equal(normalizeWireAmount('1.0'), '1.00');
  assert.equal(normalizeWireAmount('0.01'), '0.01');
  assert.equal(normalizeWireAmount('999999.99'), '999999.99');
  for (const invalid of [1, 0.1, NaN, Infinity, '0', '0.00', '-1', '+1', '01', '.1', '1.',
    '1e2', '1,5', ' 1', '1 ', '1.001', '1000000', 'NaN', null]) assert.throws(() => normalizeWireAmount(invalid));
  const item = { foodRef: 'fixture-food', amount: '1.0', unit: 'ml', state: 'as-sold' };
  assert.equal(decodeActualFixture({ items: [item] }).items[0].amount, '1.00');
  assert.equal(decodeActualFixture({ items: [item] }).items[0].unit, 'ml'); // No invented density.
  for (const invalid of [{ items: [] }, { items: [item], calories: 10 }, { items: [{ ...item, calories: 10 }] },
    { items: [{ ...item, unit: { toString: () => 'g' } }] }, { items: [{ ...item, foodRef: ' fake ' }] }]) {
    assert.throws(() => decodeActualFixture(invalid));
  }
});
test('raw wire decoder rejects duplicate keys before object decoding, including escaped aliases', () => {
  const raw = JSON.stringify(wireRequest());
  const rootMarker = `"idempotencyKey":"${wireIds.key}"`;
  assert.throws(() => decodeAdaptiveNutritionWireV1(raw.replace(rootMarker, `${rootMarker},${rootMarker}`)),
    /Duplicate JSON key: idempotencyKey/);
  const amountMarker = '"amount":"1"';
  assert.throws(() => decodeAdaptiveNutritionWireV1(raw.replace(amountMarker,
    `${amountMarker},"\\u0061mount":"1.00"`)), /Duplicate JSON key: amount/);
});
test('raw wire decoder rejects missing, unknown and malformed tagged fields and references', () => {
  const malformed: unknown[] = [];
  const missing = wireRequest(); delete (missing.expected as Partial<typeof missing.expected>).planRevision;
  malformed.push(missing);
  const unknown = wireRequest(); (unknown as Record<string, unknown>).clientDigest = 'forged'; malformed.push(unknown);
  const badAction = wireRequest(); badAction.action.type = 'EAT_ANYTHING'; malformed.push(badAction);
  const badDate = wireRequest(); badDate.action.slot.date = '2026-02-30'; malformed.push(badDate);
  const badZone = wireRequest(); badZone.expected.timeZone = 'US/Eastern'; malformed.push(badZone);
  const badUuid = wireRequest(); badUuid.expected.goalRevision = 'goal-revision'; malformed.push(badUuid);
  const unconfirmed = wireRequest(); unconfirmed.explicitConfirmation = false; malformed.push(unconfirmed);
  const unknownActual = wireRequest();
  (unknownActual.action.actual as unknown as Record<string, unknown>).calories = 1;
  malformed.push(unknownActual);
  for (const value of malformed) assert.throws(() => decodeAdaptiveNutritionWireV1(JSON.stringify(value)));
});
test('raw wire decimal normalization is exact and rejects lossy or ambiguous encodings', () => {
  const accepted = ['1', '1.0', '1.00'].map(amount => decodeAdaptiveNutritionWireV1(JSON.stringify(wireRequest(amount))));
  for (const decoded of accepted) {
    assert.equal(decoded.request.action.type, 'CONSUMED_MODIFIED');
    if (decoded.request.action.type === 'CONSUMED_MODIFIED') assert.equal(decoded.request.action.actual.items[0].amount, '1.00');
  }
  assert.deepEqual(accepted.map(value => value.digestSha256),
    [accepted[0].digestSha256, accepted[0].digestSha256, accepted[0].digestSha256]);
  for (const amount of [1, 0.1, '0', '0.00', '-1', '+1', '01', '.1', '1.', '1e2', '1,5',
    ' 1', '1 ', '1.001', '1000000', '999999.999']) {
    assert.throws(() => decodeAdaptiveNutritionWireV1(JSON.stringify(wireRequest(amount))));
  }
});
test('canonical wire bytes and SHA-256 are deterministic while preserving arrays and explicit null', () => {
  const value = wireRequest('12.5');
  const first = decodeAdaptiveNutritionWireV1(JSON.stringify(value));
  const reorderedRoot = { action: value.action, explicitConfirmation: value.explicitConfirmation,
    idempotencyKey: value.idempotencyKey, expected: value.expected, contract: value.contract };
  const second = decodeAdaptiveNutritionWireV1(JSON.stringify(reorderedRoot));
  assert.deepEqual(second.canonicalBytes, first.canonicalBytes);
  assert.equal(second.digestSha256, first.digestSha256);
  assert.match(first.digestSha256, /^[0-9a-f]{64}$/);
  const canonicalText = new TextDecoder().decode(first.canonicalBytes);
  assert.equal(canonicalText.includes(`"encoding":"${adaptiveNutritionCanonicalEncodingV1}"`), true);
  assert.equal(canonicalText.includes('"protocol":"adaptive-nutrition-v1-proposed"'), true);
  assert.equal(canonicalText.includes('"recipeRevision":null'), true);

  const withTwoItems = wireRequest('12.5');
  withTwoItems.action.actual.items.push({ ...withTwoItems.action.actual.items[0], foodRef: wireIds.foodB });
  const reversed = structuredClone(withTwoItems);
  reversed.action.actual.items.reverse();
  assert.notEqual(decodeAdaptiveNutritionWireV1(JSON.stringify(withTwoItems)).digestSha256,
    decodeAdaptiveNutritionWireV1(JSON.stringify(reversed)).digestSha256);
  const nonNullRecipe = wireRequest('12.5'); nonNullRecipe.action.slot.snapshot.recipeRevision = wireIds.recipe;
  assert.notEqual(decodeAdaptiveNutritionWireV1(JSON.stringify(nonNullRecipe)).digestSha256, first.digestSha256);
});
test('restart retains original account/key/envelope; missing or corrupted outbox never synthesizes a retry', () => {
  const req = request(); const intent = { accountId: context.accountId, idempotencyKey: req.idempotencyKey,
    request: req, canonicalEnvelope: syntheticCanonical(req) };
  const before = structuredClone(intent);
  assert.deepEqual(restartLookupSynthetic(context.accountId, intent), { kind: 'lookup', idempotencyKey: 'fixture-key' });
  assert.deepEqual(restartLookupSynthetic('fixture-B', intent), { kind: 'quarantined' });
  assert.deepEqual(restartLookupSynthetic(null, intent), { kind: 'quarantined' });
  assert.deepEqual(restartLookupSynthetic(context.accountId, null), { kind: 'needs-account-recovery' });
  assert.deepEqual(restartLookupSynthetic(context.accountId, { ...intent, idempotencyKey: 'new-key' }), { kind: 'blocked-corrupt' });
  assert.deepEqual(restartLookupSynthetic(context.accountId, { ...intent, request: { ...req, expected: { ...context, planRevision: 'new' } } }), { kind: 'blocked-corrupt' });
  assert.deepEqual(lookupSynthetic(context.accountId, intent.idempotencyKey), { kind: 'unknown', reason: 'not_observed_or_in_flight' });
  assert.deepEqual(intent, before);
});
test('logout retains UNKNOWN intent and A→B→A only restores lookup of the original key', () => {
  const req = request();
  const intent = { accountId: context.accountId, idempotencyKey: req.idempotencyKey,
    request: req, canonicalEnvelope: syntheticCanonical(req) };
  const originalIntent = structuredClone(intent);
  let state: SyntheticLifecycleState = {
    activeAccountId: context.accountId, unknownIntent: intent, erasurePendingAccountIds: [] };

  state = reduceLifecycleSynthetic(state, { type: 'LOGOUT' });
  assert.deepEqual(lifecycleDecisionSynthetic(state), { kind: 'signed-out' });
  assert.deepEqual(state.unknownIntent, originalIntent);

  state = reduceLifecycleSynthetic(state, { type: 'ACCOUNT_AUTHENTICATED', accountId: 'fixture-B' });
  const foreignView = lifecycleDecisionSynthetic(state);
  assert.deepEqual(foreignView, { kind: 'quarantined' });
  assert.equal(JSON.stringify(foreignView).includes(context.accountId), false);
  assert.equal(JSON.stringify(foreignView).includes(req.idempotencyKey), false);
  assert.deepEqual(state.unknownIntent, originalIntent);

  state = reduceLifecycleSynthetic(state, { type: 'ACCOUNT_AUTHENTICATED', accountId: context.accountId });
  assert.deepEqual(lifecycleDecisionSynthetic(state), { kind: 'lookup', idempotencyKey: req.idempotencyKey });
  assert.deepEqual(state.unknownIntent, originalIntent);
});
test('erasure request blocks execution without clearing intent or declaring deletion complete', () => {
  const req = request();
  const intent = { accountId: context.accountId, idempotencyKey: req.idempotencyKey,
    request: req, canonicalEnvelope: syntheticCanonical(req) };
  let state: SyntheticLifecycleState = {
    activeAccountId: context.accountId, unknownIntent: intent, erasurePendingAccountIds: [] };

  state = reduceLifecycleSynthetic(state, { type: 'ERASURE_REQUESTED' });
  assert.deepEqual(lifecycleDecisionSynthetic(state), { kind: 'blocked-erasure-pending' });
  assert.deepEqual(state.unknownIntent, intent);
  assert.deepEqual(state.erasurePendingAccountIds, [context.accountId]);
  const once = state;
  state = reduceLifecycleSynthetic(state, { type: 'ERASURE_REQUESTED' });
  assert.deepEqual(state, once); // Idempotent pending marker; still not completion.

  state = reduceLifecycleSynthetic(state, { type: 'LOGOUT' });
  assert.deepEqual(state.unknownIntent, intent);
  state = reduceLifecycleSynthetic(state, { type: 'ACCOUNT_AUTHENTICATED', accountId: context.accountId });
  assert.deepEqual(lifecycleDecisionSynthetic(state), { kind: 'blocked-erasure-pending' });
  assert.throws(() => reduceLifecycleSynthetic(state,
    { type: 'ERASURE_COMPLETED' } as never), /Unsupported lifecycle event/);
  assert.deepEqual(state.unknownIntent, intent);
});
test('mixed legacy bulk has no eligible prefix and no queue loss; activated cohort rejects even an empty-date delete', () => {
  const queue = [{ before: null, after: { ...row(null), id: 'unmanaged', date: '2026-08-01' } },
    { before: row(null), after: null }];
  const before = structuredClone(queue);
  assert.equal(legacyBatchSynthetic(context.accountId, queue, new Set([slot.date]), false), 'upgrade-required');
  assert.equal(legacyBatchSynthetic(context.accountId, queue.slice(0, 1), new Set(), false), 'eligible');
  assert.equal(legacyBatchSynthetic(context.accountId, queue.slice(0, 1), new Set(), true), 'upgrade-required');
  assert.equal(legacyBatchSynthetic(context.accountId, [], new Set(), true), 'upgrade-required');
  assert.deepEqual(queue, before);
});
