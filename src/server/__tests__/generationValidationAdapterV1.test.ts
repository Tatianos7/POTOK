import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createGenerationValidationAdapterV1, generationValidationAuthorityContractV1,
  GenerationValidationBindingErrorV1, type GenerationValidationAuthorityV1,
} from '../generationValidationAdapterV1';
import {
  fullFixture, id, h, resignSet, fixtureSeal, withoutDigest,
  type FullFixture,
} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import { validateGeneratedWeekPlanTrustedV1 } from '../../utils/trustedGeneratedWeekValidatorV1';
import {
  compositionPolicySnapshotContractV1, compositionPolicySnapshotEncodingV1,
  trustedValidationPoliciesContractV1, trustedValidationPoliciesEncodingV1,
} from '../../utils/trustedValidationPoliciesV1';

const rawHash = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');
function authority(f: FullFixture): GenerationValidationAuthorityV1 {
  return { contract: generationValidationAuthorityContractV1,
    requestOperationId: f.context.input.operation.requestId, accountId: f.context.input.accountId,
    generationInputDigest: f.evidence.generationInputDigest, evaluatedPlanRawSha256: rawHash(f.planRaw),
    trustedContextRaw: f.contextRaw, pinnedPoliciesRaw: f.policiesRaw, pinnedWarningEvidenceRaw: f.warningRaw };
}
function adapter(raw: unknown) {
  return createGenerationValidationAdapterV1({ async loadForProposalRaw() { return raw as string | null; } });
}
const bindingError = (code: GenerationValidationBindingErrorV1['code']) => (error: unknown) =>
  error instanceof GenerationValidationBindingErrorV1 && error.code === code;

test('real validator accepts synthetic full week; adapter returns only exact evaluated raw bytes and receipts', async () => {
  const f = await fullFixture(); const a = authority(f); const calls: string[][] = [];
  const bridge = createGenerationValidationAdapterV1({ async loadForProposalRaw(request, digest) {
    calls.push([request, digest]); return JSON.stringify(a);
  } });
  const result = await bridge.validate(a.requestOperationId, f.planRaw);
  assert.equal(result.status, 'ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error('expected_acceptance');
  assert.equal(result.generatedPlanRaw, f.planRaw);
  assert.equal(result.proposalRawSha256, rawHash(f.planRaw));
  assert.deepEqual(result.validation, await validateGeneratedWeekPlanTrustedV1(
    f.planRaw, f.policiesRaw, f.contextRaw, f.warningRaw));
  assert.deepEqual(calls, [[a.requestOperationId, rawHash(f.planRaw)]]);
  assert.ok(Object.isFrozen(bridge)); assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.validation.plan.graph.days));
  assert.deepEqual(Object.keys(bridge), ['validate']);
  assert.ok(!('active' in result)); assert.ok(!('receipt' in result));
});

test('missing trusted authority blocks without returning writable proposal data', async () => {
  const result = await adapter(null).validate(id(44), '{}');
  assert.deepEqual(result, { status: 'BLOCKED', reason: 'VALIDATION_AUTHORITY_UNAVAILABLE' });
  assert.ok(Object.isFrozen(result)); assert.ok(!('generatedPlanRaw' in result));
});

test('non-string values from the trusted async port cannot enter authority decoding', async () => {
  for (const raw of [{}, [], new String('{}'), false, 5, undefined]) {
    await assert.rejects(adapter(raw).validate(id(44), '{}'), bindingError('RAW_STRING_REQUIRED'));
  }
});

test('invalid request/proposal arguments never invoke authority loader or hostile coercion', async () => {
  let calls = 0; let traps = 0;
  const bridge = createGenerationValidationAdapterV1({ async loadForProposalRaw() { calls++; return null; } });
  const proxy = new Proxy({}, { get() { traps++; throw new Error('trap'); },
    getPrototypeOf() { traps++; throw new Error('trap'); } });
  for (const value of [proxy, null, {}, new String(id(44)), '', 'not-a-uuid', id(44).toUpperCase() + 'x']) {
    await assert.rejects(bridge.validate(value as string, '{}'), bindingError('INVALID_REQUEST_OPERATION_ID'));
  }
  for (const value of [proxy, null, {}, new String('{}'), 1]) {
    await assert.rejects(bridge.validate(id(44), value as string), bindingError('RAW_STRING_REQUIRED'));
  }
  assert.equal(calls, 0); assert.equal(traps, 0);
});

test('lone UTF-16 surrogate cannot collide with UTF-8 replacement bytes', async () => {
  let calls = 0;
  const bridge = createGenerationValidationAdapterV1({ async loadForProposalRaw() { calls++; return null; } });
  await assert.rejects(bridge.validate(id(44), '{"name":"\ud800"}'), bindingError('INVALID_RAW_UNICODE'));
  assert.equal(calls, 0);
});

for (const [name, change, code] of [
  ['other request', (a: GenerationValidationAuthorityV1) => { a.requestOperationId = id(900); }, 'REQUEST_BINDING_MISMATCH'],
  ['other account', (a: GenerationValidationAuthorityV1) => { a.accountId = id(900); }, 'INPUT_BINDING_MISMATCH'],
  ['stale input digest', (a: GenerationValidationAuthorityV1) => { a.generationInputDigest = h('f'); }, 'INPUT_BINDING_MISMATCH'],
  ['different evaluated plan', (a: GenerationValidationAuthorityV1) => { a.evaluatedPlanRawSha256 = h('f'); }, 'PROPOSAL_BINDING_MISMATCH'],
] as const) {
  test(`${name} cannot substitute trusted request/proposal binding`, async () => {
    const f = await fullFixture(); const a = authority(f); change(a);
    await assert.rejects(adapter(JSON.stringify(a)).validate(f.context.input.operation.requestId, f.planRaw), bindingError(code));
  });
}

test('input request identity is checked independently of matching outer authority identity', async () => {
  const f = await fullFixture(); const a = authority(f); const context = JSON.parse(a.trustedContextRaw);
  const input = JSON.parse(context.trustedGenerationInputRaw); input.operation.requestId = id(999);
  context.trustedGenerationInputRaw = JSON.stringify(input); a.trustedContextRaw = JSON.stringify(context);
  await assert.rejects(adapter(JSON.stringify(a)).validate(a.requestOperationId, f.planRaw), bindingError('INPUT_BINDING_MISMATCH'));
});

for (const scope of ['authority', 'context', 'nestedInput'] as const) {
  test(`duplicate keys in ${scope} cannot disappear through parse`, async () => {
    const f = await fullFixture(); const a = authority(f); let raw: string;
    if (scope === 'authority') raw = JSON.stringify(a).replace('{', '{"requestOperationId":"duplicate",');
    else {
      if (scope === 'context') a.trustedContextRaw = a.trustedContextRaw.replace('{', '{"contract":"duplicate",');
      else {
        const context = JSON.parse(a.trustedContextRaw);
        context.trustedGenerationInputRaw = context.trustedGenerationInputRaw.replace('{', '{"accountId":"duplicate",');
        a.trustedContextRaw = JSON.stringify(context);
      }
      raw = JSON.stringify(a);
    }
    await assert.rejects(adapter(raw).validate(a.requestOperationId, f.planRaw), /duplicate/i);
  });
}

for (const key of ['pinnedPoliciesRaw', 'pinnedWarningEvidenceRaw', 'trustedContextRaw'] as const) {
  test(`missing required ${key} is never defaulted`, async () => {
    const f = await fullFixture(); const a = authority(f); const raw = { ...a } as Record<string, unknown>; delete raw[key];
    await assert.rejects(adapter(JSON.stringify(raw)).validate(a.requestOperationId, f.planRaw), bindingError('INVALID_AUTHORITY_PACKAGE'));
  });
}

test('authority and context reject extra fields rather than admitting self-declared authority', async () => {
  const f = await fullFixture(); const a = authority(f);
  await assert.rejects(adapter(JSON.stringify({ ...a, allowUnsafe: true })).validate(a.requestOperationId, f.planRaw),
    bindingError('INVALID_AUTHORITY_PACKAGE'));
  a.trustedContextRaw = JSON.stringify({ ...JSON.parse(a.trustedContextRaw), allowUnsafe: true });
  await assert.rejects(adapter(JSON.stringify(a)).validate(a.requestOperationId, f.planRaw), bindingError('INVALID_AUTHORITY_PACKAGE'));
});

for (const kind of ['duplicatePlan', 'fact', 'badDigest', 'allergen'] as const) {
  test(`real validator ${kind} rejection exposes no accepted proposal`, async () => {
    const f = await fullFixture(kind === 'allergen' ? state => {
      state.context.manifest.entries[0].allergenCodes = ['milk']; state.context.safety.declaredAllergenCodes = ['milk'];
    } : undefined);
    if (kind === 'duplicatePlan') f.planRaw = f.planRaw.replace('{', '{"accountId":"duplicate",');
    if (kind === 'fact') f.planRaw = JSON.stringify({ ...f.plan, facts: [{ consumed: true }] });
    if (kind === 'badDigest') f.planRaw = JSON.stringify({ ...f.plan, graphDigest: h('f') });
    const a = authority(f); const result = await adapter(JSON.stringify(a)).validate(a.requestOperationId, f.planRaw);
    assert.equal(result.status, 'REJECTED'); assert.ok(!('generatedPlanRaw' in result));
    assert.ok('validation' in result);
    if ('validation' in result) assert.deepEqual(result.validation, await validateGeneratedWeekPlanTrustedV1(
      f.planRaw, f.policiesRaw, f.contextRaw, f.warningRaw));
  });
}

test('missing warnings remain real BLOCKED result; no default false signals', async () => {
  const f = await fullFixture(); f.warningRaw = resignSet({ ...f.set, entries: [] });
  const a = authority(f); const result = await adapter(JSON.stringify(a)).validate(a.requestOperationId, f.planRaw);
  assert.equal(result.status, 'BLOCKED'); assert.ok(!('generatedPlanRaw' in result));
  assert.ok('validation' in result);
  if ('validation' in result) {
    assert.equal(result.validation.reasons[0].code, 'TRUSTED_AUTHORITY_MISSING');
  }
});

test('internally re-signed replacement policy cannot bypass independently pinned warning evidence', async () => {
  const f = await fullFixture(); const policy = structuredClone(f.policies);
  policy.composition.policy.nutritionWeights.calories = 3;
  policy.composition = fixtureSeal(withoutDigest(policy.composition), compositionPolicySnapshotContractV1, compositionPolicySnapshotEncodingV1);
  f.policiesRaw = JSON.stringify(fixtureSeal(withoutDigest(policy), trustedValidationPoliciesContractV1, trustedValidationPoliciesEncodingV1));
  const a = authority(f); const result = await adapter(JSON.stringify(a)).validate(a.requestOperationId, f.planRaw);
  assert.equal(result.status, 'REJECTED'); assert.ok(!('generatedPlanRaw' in result));
});

test('loader failure propagates without hidden retry or fabricated blocked/success state', async () => {
  const failure = new Error('private-authority-unavailable'); let calls = 0;
  const bridge = createGenerationValidationAdapterV1({ async loadForProposalRaw() { calls++; throw failure; } });
  await assert.rejects(bridge.validate(id(44), '{}'), error => error === failure); assert.equal(calls, 1);
});

test('changed proposal transport text cannot replay a package bound to the earlier bytes', async () => {
  const f = await fullFixture(); const a = authority(f);
  await assert.rejects(adapter(JSON.stringify(a)).validate(a.requestOperationId, f.planRaw + '\n'),
    bindingError('PROPOSAL_BINDING_MISMATCH'));
});

test('each retry reloads trusted authority; missing authority cannot reuse prior acceptance', async () => {
  const f = await fullFixture(); const a = authority(f); let calls = 0;
  const bridge = createGenerationValidationAdapterV1({ async loadForProposalRaw() {
    calls++; return calls === 1 ? JSON.stringify(a) : null;
  } });
  assert.equal((await bridge.validate(a.requestOperationId, f.planRaw)).status, 'ACCEPTED');
  assert.deepEqual(await bridge.validate(a.requestOperationId, f.planRaw),
    { status: 'BLOCKED', reason: 'VALIDATION_AUTHORITY_UNAVAILABLE' });
  assert.equal(calls, 2);
});

test('malformed trusted payload remains an exception; not converted into an accepted plan', async () => {
  const f = await fullFixture(); const a = authority(f); a.pinnedPoliciesRaw = '{}';
  await assert.rejects(adapter(JSON.stringify(a)).validate(a.requestOperationId, f.planRaw));
});

test('concurrent request validation has no shared account/proposal cache', async () => {
  const a = await fullFixture(); const b = await fullFixture(state => {
    state.context.input.operation.requestId = id(999); state.context.input.accountId = id(998);
    state.context.preference.accountId = id(998); state.context.safety.accountId = id(998); state.evidence.accountId = id(998);
  });
  const envelopeA = authority(a); const envelopeB = authority(b);
  let releaseA!: (raw: string) => void;
  const pendingA = new Promise<string>(resolve => { releaseA = resolve; });
  const bridge = createGenerationValidationAdapterV1({ async loadForProposalRaw(request) {
    return request === envelopeA.requestOperationId ? pendingA : JSON.stringify(envelopeB);
  } });
  const resultA = bridge.validate(envelopeA.requestOperationId, a.planRaw);
  const resultB = await bridge.validate(envelopeB.requestOperationId, b.planRaw);
  releaseA(JSON.stringify(envelopeA)); const settledA = await resultA;
  assert.equal(settledA.status, 'ACCEPTED'); assert.equal(resultB.status, 'ACCEPTED');
  if (settledA.status !== 'ACCEPTED' || resultB.status !== 'ACCEPTED') throw new Error('expected_acceptance');
  assert.equal(settledA.validation.plan.accountId, envelopeA.accountId);
  assert.equal(resultB.validation.plan.accountId, envelopeB.accountId);
});
