import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  adaptiveNutritionCandidateManifestCanonicalBytesV2, nutritionPreferenceSnapshotCanonicalBytesV1,
  nutritionSafetySnapshotCanonicalBytesV1,
} from '../../utils/adaptiveNutritionAuthoritiesV1';
import { canonicalJsonV1 } from '../../utils/adaptiveNutritionWireV1';
import { createGenerationValidationAdapterV1 } from '../generationValidationAdapterV1';
import {
  createGenerationValidationAuthorityLoaderV1, generationValidationSourceContractV1,
  GenerationValidationSourceErrorV1, type GenerationValidationSourceV1, type StoredGenerationCanonicalV1,
} from '../generationValidationAuthorityLoaderV1';
import { fullFixture, id, resignSet, type FullFixture } from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const stored = (bytes: Uint8Array): StoredGenerationCanonicalV1 => ({
  canonicalHex: Buffer.from(bytes).toString('hex'), storageSha256: hash(bytes),
});
function changed(source: StoredGenerationCanonicalV1, change: (value: Record<string, unknown>) => void) {
  const value = JSON.parse(Buffer.from(source.canonicalHex, 'hex').toString('utf8'));
  change(value); return stored(Buffer.from(canonicalJsonV1(value, 'SAFE_INTEGER')));
}
async function source(f: FullFixture): Promise<GenerationValidationSourceV1> {
  return { contract: generationValidationSourceContractV1, requestOperationId: f.context.input.operation.requestId,
    accountId: f.context.input.accountId, evaluatedPlanRawSha256: hash(f.planRaw),
    input: { canonicalHex: Buffer.from(canonicalJsonV1(f.context.input, 'SAFE_INTEGER')).toString('hex'), generationInputDigest: f.evidence.generationInputDigest },
    manifest: stored(await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest)),
    preference: stored(await nutritionPreferenceSnapshotCanonicalBytesV1(f.context.preference)),
    safety: stored(await nutritionSafetySnapshotCanonicalBytesV1(f.context.safety)),
    validationEvidenceRaw: f.rawContext.trustedValidationEvidenceRaw, policiesRaw: f.policiesRaw, warningEvidenceRaw: f.warningRaw };
}
function loader(raw: unknown) {
  return createGenerationValidationAuthorityLoaderV1({ async readSnapshotRaw() { return raw as string | null; } });
}
function run(s: GenerationValidationSourceV1, f: FullFixture) {
  return createGenerationValidationAdapterV1(loader(JSON.stringify(s))).validate(s.requestOperationId, f.planRaw);
}
const code = (expected: GenerationValidationSourceErrorV1['code']) => (error: unknown) =>
  error instanceof GenerationValidationSourceErrorV1 && error.code === expected;

test('stored canonical sources project through loader and real validator without changing digest domains', async () => {
  const f = await fullFixture(); const s = await source(f); const calls: string[][] = [];
  const port = createGenerationValidationAuthorityLoaderV1({ async readSnapshotRaw(request, proposal) {
    calls.push([request, proposal]); return JSON.stringify(s);
  } });
  const raw = await port.loadForProposalRaw(s.requestOperationId, s.evaluatedPlanRawSha256);
  assert.ok(raw); const envelope = JSON.parse(raw);
  // Actual DB request digest already hashes {contract,input}; other storage uses raw SHA.
  assert.equal(s.input!.generationInputDigest, f.evidence.generationInputDigest);
  assert.notEqual(hash(Buffer.from(s.input!.canonicalHex, 'hex')), s.input!.generationInputDigest);
  assert.equal(envelope.generationInputDigest, f.evidence.generationInputDigest);
  const context = JSON.parse(envelope.trustedContextRaw);
  assert.deepEqual(JSON.parse(context.candidateManifestRaw), f.context.manifest);
  assert.deepEqual(JSON.parse(context.preferenceSnapshotRaw), f.context.preference);
  assert.deepEqual(JSON.parse(context.safetySnapshotRaw), f.context.safety);
  const result = await createGenerationValidationAdapterV1(port).validate(s.requestOperationId, f.planRaw);
  assert.equal(result.status, 'ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error('expected_accept');
  assert.equal(result.validation.validationEvidenceDigest, f.evidence.digest);
  assert.equal(result.generatedPlanRaw, f.planRaw);
  assert.deepEqual(calls, [[s.requestOperationId, s.evaluatedPlanRawSha256], [s.requestOperationId, s.evaluatedPlanRawSha256]]);
  assert.ok(Object.isFrozen(port));
});

for (const field of ['input', 'manifest', 'preference', 'safety', 'validationEvidenceRaw', 'policiesRaw', 'warningEvidenceRaw'] as const) {
  test(`missing ${field} returns unavailable, never synthesized authority`, async () => {
    const f = await fullFixture(); const s = await source(f); s[field] = null;
    assert.equal(await loader(JSON.stringify(s)).loadForProposalRaw(s.requestOperationId, s.evaluatedPlanRawSha256), null);
    const result = await run(s, f);
    assert.deepEqual(result, { status: 'BLOCKED', reason: 'VALIDATION_AUTHORITY_UNAVAILABLE' });
  });
}

for (const field of ['input', 'manifest', 'preference', 'safety'] as const) {
  test(`${field} storage bytes cannot use a mismatching digest`, async () => {
    const f = await fullFixture(); const s = await source(f); if (field === 'input') s.input!.generationInputDigest = 'f'.repeat(64);
    else s[field]!.storageSha256 = 'f'.repeat(64);
    await assert.rejects(run(s, f), code('STORAGE_DIGEST_MISMATCH'));
  });
  test(`${field} rehashed noncanonical bytes are not silently normalized`, async () => {
    const f = await fullFixture(); const s = await source(f);
    const altered = stored(Buffer.concat([Buffer.from(s[field]!.canonicalHex, 'hex'), Buffer.from('\n')]));
    if (field === 'input') s.input!.canonicalHex = altered.canonicalHex; else s[field] = altered;
    await assert.rejects(run(s, f), code('STORAGE_CANONICAL_MISMATCH'));
  });
}

test('raw byte SHA cannot replace the stored typed generation input digest', async () => {
  const f = await fullFixture(); const s = await source(f); s.input!.generationInputDigest = hash(Buffer.from(s.input!.canonicalHex, 'hex'));
  await assert.rejects(run(s, f), code('STORAGE_DIGEST_MISMATCH'));
});

test('stored UTF-8 BOM cannot be silently stripped from canonical input bytes', async () => {
  const f = await fullFixture(); const s = await source(f);
  s.input!.canonicalHex = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s.input!.canonicalHex, 'hex')]).toString('hex');
  await assert.rejects(run(s, f));
});

test('malformed stored UTF-8 is rejected instead of decoded with replacement characters', async () => {
  const f = await fullFixture(); const s = await source(f); s.input!.canonicalHex = Buffer.from([0xc3, 0x28]).toString('hex');
  await assert.rejects(run(s, f), /encoded data|encoding/i);
});

for (const field of ['manifest', 'preference', 'safety'] as const) {
  test(`rehashed ${field} identity substitution remains bound to durable input`, async () => {
    const f = await fullFixture(); const s = await source(f);
    s[field] = changed(s[field]!, value => { value[field === 'manifest' ? 'manifestRevision' : 'revisionId'] = id(999); });
    await assert.rejects(run(s, f), code('SOURCE_BINDING_MISMATCH'));
  });
}

test('outer request binding and nested account binding are independently checked', async () => {
  const f = await fullFixture(); const s = await source(f); const request = s.requestOperationId;
  s.requestOperationId = id(999);
  await assert.rejects(loader(JSON.stringify(s)).loadForProposalRaw(request, s.evaluatedPlanRawSha256), code('SOURCE_BINDING_MISMATCH'));
  s.requestOperationId = request; s.accountId = id(999);
  await assert.rejects(run(s, f), code('SOURCE_BINDING_MISMATCH'));
});

test('candidate SHA binding cannot be changed by a source response for a different proposal', async () => {
  const f = await fullFixture(); const s = await source(f); s.evaluatedPlanRawSha256 = 'f'.repeat(64);
  await assert.rejects(run(s, f), code('SOURCE_BINDING_MISMATCH'));
});

test('duplicate keys in source and stored input rejected before parsing loses them', async () => {
  const f = await fullFixture(); const s = await source(f);
  await assert.rejects(loader(JSON.stringify(s).replace('{', '{"accountId":"duplicate",'))
    .loadForProposalRaw(s.requestOperationId, s.evaluatedPlanRawSha256), /duplicate/i);
  const raw = Buffer.from(s.input!.canonicalHex, 'hex').toString('utf8').replace('{', '{"accountId":"duplicate",');
  s.input!.canonicalHex = Buffer.from(raw).toString('hex'); await assert.rejects(run(s, f), /duplicate/i);
});

test('stored content with an added self-declared digest is rejected instead of treated as publication', async () => {
  const f = await fullFixture(); const s = await source(f);
  s.manifest = changed(s.manifest!, value => { value.digest = f.context.manifest.digest; });
  await assert.rejects(run(s, f), /fields/);
});

test('missing warning entries stay blocked through the assembled authority and actual validator', async () => {
  const f = await fullFixture(); const s = await source(f);
  s.warningEvidenceRaw = resignSet({ ...f.set, entries: [] });
  const result = await run(s, f); assert.equal(result.status, 'BLOCKED'); assert.ok(!('generatedPlanRaw' in result));
});

test('malformed provided source is not concealed by a different missing prerequisite', async () => {
  const f = await fullFixture(); const s = await source(f); s.manifest = null;
  s.preference!.canonicalHex = 'not-hex'; await assert.rejects(run(s, f), code('INVALID_SOURCE_PACKAGE'));
});

test('invalid raw source types and unknown fields do not enter decoder or caller coercion', async () => {
  const f = await fullFixture(); const s = await source(f);
  for (const value of [{}, [], undefined, new String('{}')]) {
    await assert.rejects(loader(value).loadForProposalRaw(s.requestOperationId, s.evaluatedPlanRawSha256), code('INVALID_SOURCE_PACKAGE'));
  }
  await assert.rejects(loader(JSON.stringify({ ...s, allowMissing: true }))
    .loadForProposalRaw(s.requestOperationId, s.evaluatedPlanRawSha256), code('INVALID_SOURCE_PACKAGE'));
});

test('arguments rejected before store calls; storage failures propagate without hidden retries', async () => {
  let calls = 0; const failure = new Error('storage_failure');
  const port = createGenerationValidationAuthorityLoaderV1({ async readSnapshotRaw() { calls++; throw failure; } });
  await assert.rejects(port.loadForProposalRaw('bad-id', 'f'.repeat(64)), code('INVALID_SOURCE_ARGUMENT'));
  await assert.rejects(port.loadForProposalRaw(id(44), 'bad-hash'), code('INVALID_SOURCE_ARGUMENT'));
  assert.equal(calls, 0);
  await assert.rejects(port.loadForProposalRaw(id(44), 'f'.repeat(64)), error => error === failure);
  assert.equal(calls, 1);
});

test('no cached acceptance survives a missing source on the next snapshot read', async () => {
  const f = await fullFixture(); const s = await source(f); let calls = 0;
  const port = createGenerationValidationAuthorityLoaderV1({ async readSnapshotRaw() {
    calls++; return calls === 1 ? JSON.stringify(s) : null;
  } });
  assert.ok(await port.loadForProposalRaw(s.requestOperationId, s.evaluatedPlanRawSha256));
  assert.equal(await port.loadForProposalRaw(s.requestOperationId, s.evaluatedPlanRawSha256), null); assert.equal(calls, 2);
});
