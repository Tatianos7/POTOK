import assert from 'node:assert/strict';
import test from 'node:test';
import { fullFixture, fixtureWeekValidationInput, fixtureValidationResults, resignEntry } from './trustedGeneratedWeekFixturesV1';
import { validateDaySnapshotRawV2 } from '../adaptiveNutritionMealBalanceV1';
import { createPreparedMealWarningDecoderRawV2, decodePreparedMealWarningEvidenceRawV2, decodeMealWarningEvidenceRawV1 } from '../trustedMealWarningEvidenceV1';

test('standalone V2 day produces the exact existing weekly-child result, including UTC', async () => {
  const f = await fullFixture(); const week = fixtureWeekValidationInput(f); const actual = await fixtureValidationResults(f);
  for (let i = 0; i < 7; i++) {
    assert.deepEqual(await validateDaySnapshotRawV2(JSON.stringify(week.days[i]), f.rawContext.candidateManifestRaw), actual.days[i].validation);
  }
});

test('day V2 independently rejects metadata and manifest classification substitution', async () => {
  const f = await fullFixture(); const day = fixtureWeekValidationInput(f).days[0];
  day.meals[0].validationInput.componentEvidence[0].specialty = true;
  await assert.rejects(validateDaySnapshotRawV2(JSON.stringify(day), f.rawContext.candidateManifestRaw), /classification_mismatch/);
});

test('day V2 retains raw-only admission and duplicate-key rejection on both inputs', async () => {
  const f = await fullFixture(); const day = JSON.stringify(fixtureWeekValidationInput(f).days[0]);
  for (const args of [[{} as unknown as string, f.rawContext.candidateManifestRaw], [day, null as unknown as string],
    [day.replace('{', '{"date":"2026-09-28",'), f.rawContext.candidateManifestRaw],
    [day, f.rawContext.candidateManifestRaw.replace('{', '{"digest":"x",')]]) {
    await assert.rejects(validateDaySnapshotRawV2(args[0], args[1]));
  }
});

test('prepared warning boundary reuses the exact original entry validation without a fabricated plan', async () => {
  const f = await fullFixture(); const meal = JSON.stringify(f.plan.graph.days[0].slots[0].mealSnapshot);
  const raw = JSON.stringify(f.set.entries[0]);
  const prepared = await decodePreparedMealWarningEvidenceRawV2(raw, f.policiesRaw, f.contextRaw, meal);
  assert.deepEqual(prepared, await decodeMealWarningEvidenceRawV1(raw, f.policiesRaw, f.contextRaw, f.planRaw));
  assert.equal(Object.isFrozen(prepared.signals), true);
});

test('prepared warnings reject other meals, policies and falsely typed signals even when independently re-signed', async () => {
  const f = await fullFixture(); const meal = JSON.stringify(f.plan.graph.days[0].slots[0].mealSnapshot);
  for (const raw of [JSON.stringify(f.set.entries[1]), JSON.stringify(resignEntry({ ...f.set.entries[0], validationEvidenceDigest: '0'.repeat(64) })),
    JSON.stringify(resignEntry({ ...f.set.entries[0], validationPolicyRevision: f.context.input.compositionPolicyRevision })),
    JSON.stringify({ ...f.set.entries[0], signals: { ...f.set.entries[0].signals, longPreparationBurden: 'false' } })]) {
    await assert.rejects(decodePreparedMealWarningEvidenceRawV2(raw, f.policiesRaw, f.contextRaw, meal));
  }
});

test('prepared warning raw boundary rejects duplicate keys and non-primitive arguments before coercion', async () => {
  const f = await fullFixture(); const args = [JSON.stringify(f.set.entries[0]), f.policiesRaw, f.contextRaw,
    JSON.stringify(f.plan.graph.days[0].slots[0].mealSnapshot)];
  for (let i = 0; i < 4; i++) {
    const bad = [...args]; bad[i] = {} as unknown as string;
    await assert.rejects(decodePreparedMealWarningEvidenceRawV2(bad[0], bad[1], bad[2], bad[3]), /RAW_JSON_STRING_REQUIRED/);
  }
  await assert.rejects(decodePreparedMealWarningEvidenceRawV2(args[0].replace('{', '{"signals":{},'), args[1], args[2], args[3]), /Duplicate/);
});

test('attempt-scoped warning decoder preserves all entry bindings, including concurrent independent meals', async () => {
  const f = await fullFixture();
  const decoder = await createPreparedMealWarningDecoderRawV2(f.policiesRaw, f.contextRaw);
  assert.equal(Object.isFrozen(decoder), true);
  await Promise.all(f.plan.graph.days.map(async (day, index) => {
    const meal = JSON.stringify(day.slots[0].mealSnapshot), raw = JSON.stringify(f.set.entries[index]);
    assert.deepEqual(await decoder.decode(raw, meal), await decodePreparedMealWarningEvidenceRawV2(raw, f.policiesRaw, f.contextRaw, meal));
    await assert.rejects(decoder.decode(JSON.stringify(f.set.entries[(index + 1) % 7]), meal));
    await assert.rejects(decoder.decode(JSON.stringify({...f.set.entries[index], digest: '0'.repeat(64)}), meal));
    await assert.rejects(decoder.decode(raw, meal.replace('{', '{"digest":"duplicate",')), /Duplicate/);
  }));
});

test('attempt-scoped decoder admits fresh raw context and never coerces hostile objects', async () => {
  const f = await fullFixture();let traps = 0;
  const hostile = {toString(){traps++;throw Error('coercion');}} as unknown as string;
  for (const args of [[hostile,f.contextRaw],[f.policiesRaw,hostile],
    [f.policiesRaw,f.contextRaw.replace('{','{"contract":"duplicate",')]]) {
    await assert.rejects(createPreparedMealWarningDecoderRawV2(args[0],args[1]));
  }
  const decoder = await createPreparedMealWarningDecoderRawV2(f.policiesRaw,f.contextRaw);
  const raw=JSON.stringify(f.set.entries[0]),meal=JSON.stringify(f.plan.graph.days[0].slots[0].mealSnapshot);
  await assert.rejects(decoder.decode(hostile,meal),/RAW_JSON_STRING_REQUIRED/);
  await assert.rejects(decoder.decode(raw,hostile),/RAW_JSON_STRING_REQUIRED/);
  await assert.rejects(createPreparedMealWarningDecoderRawV2(f.policiesRaw.replace('{','{"digest":"duplicate",'),f.contextRaw));
  assert.deepEqual(await decoder.decode(raw,meal),f.set.entries[0]);assert.equal(traps,0);
});
