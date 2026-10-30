import assert from 'node:assert/strict';
import test from 'node:test';
import { generationWeekSearchContractV1, searchGenerationWeekRawV1 } from '../generationWeekSearchV1';
import { fullFixture, fixtureWeekValidationInput } from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import { validateWeekSnapshotRawV2 } from '../../utils/adaptiveNutritionMealBalanceV1';

async function fixture() {
  const f = await fullFixture();
  const { days, ...weekHeader } = fixtureWeekValidationInput(f);
  return { input: { contract: generationWeekSearchContractV1, weekHeader,
    dayOptions: days.map(day => [day]), maxEvaluations: 16 }, manifest: f.rawContext.candidateManifestRaw };
}

test('assembles all seven days and returns the real V2 validator result, frozen', async () => {
  const { input, manifest } = await fixture();
  const before = JSON.stringify(input);
  const result = await searchGenerationWeekRawV1(before, manifest);
  assert.equal(result.status, 'FEASIBLE_PROPOSAL');
  if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.equal(result.evaluated, 1);
  assert.equal(result.totalCombinations, 1);
  assert.deepEqual(result.optionIndexes, [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(result.validation, await validateWeekSnapshotRawV2(result.weekRaw, manifest));
  assert.equal(Object.isFrozen(result.validation.reasons), true);
  assert.equal(Object.isFrozen(result.optionIndexes), true);
  assert.equal(JSON.stringify(input), before);
  assert.equal('acceptedPlanRaw' in result, false);
});

test('backtracks from an invalid day without weakening requirements', async () => {
  const { input, manifest } = await fixture();
  const bad = structuredClone(input.dayOptions[6][0]);
  bad.meals[0].validationInput.requirements.produceRequired = true;
  input.dayOptions[6].unshift(bad);
  const raw = JSON.stringify(input);
  const result = await searchGenerationWeekRawV1(raw, manifest);
  assert.equal(result.status, 'FEASIBLE_PROPOSAL');
  if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.equal(result.evaluated, 2);
  assert.equal(result.optionIndexes[6], 1);
  assert.equal(JSON.stringify(input), raw);
  assert.deepEqual(await searchGenerationWeekRawV1(raw, manifest), result);
});

test('a budget cut is distinct from exhaustive infeasibility and exposes no proposal', async () => {
  const { input, manifest } = await fixture();
  const bad = structuredClone(input.dayOptions[6][0]);
  bad.meals[0].validationInput.requirements.produceRequired = true;
  input.dayOptions[6].unshift(bad);
  input.maxEvaluations = 1;
  assert.deepEqual(await searchGenerationWeekRawV1(JSON.stringify(input), manifest), {
    status: 'SEARCH_LIMIT_REACHED', evaluated: 1, totalCombinations: 2,
  });
});

test('cross-day family limits reject a locally complete seven-day menu', async () => {
  const f = await fullFixture(state => {
    for (const entry of state.context.manifest.entries) entry.repeatFamily = 'same_family';
  });
  const { days, ...weekHeader } = fixtureWeekValidationInput(f);
  const result = await searchGenerationWeekRawV1(JSON.stringify({ contract: generationWeekSearchContractV1,
    weekHeader, dayOptions: days.map(day => [day]), maxEvaluations: 1 }), f.rawContext.candidateManifestRaw);
  assert.deepEqual(result, { status: 'NO_FEASIBLE_WEEK_IN_POOL', evaluated: 1, totalCombinations: 1 });
});

test('exhaustion includes the final combination at the exact budget boundary', async () => {
  const { input, manifest } = await fixture();
  input.dayOptions[0][0].meals[0].validationInput.requirements.produceRequired = true;
  input.maxEvaluations = 1;
  assert.equal((await searchGenerationWeekRawV1(JSON.stringify(input), manifest)).status, 'NO_FEASIBLE_WEEK_IN_POOL');
});

test('missing evidence is reported as blocked, never as proof that no week exists', async () => {
  const { input, manifest } = await fixture();
  const raw = JSON.parse(JSON.stringify(input));
  raw.dayOptions[0][0].goalTarget = null;
  assert.equal((await searchGenerationWeekRawV1(JSON.stringify(raw), manifest)).status, 'BLOCKED_MISSING_EVIDENCE');
});

test('preserves permitted warnings on a feasible proposal', async () => {
  const f = await fullFixture(state => {
    state.balance.policy.allowedWarningCodes.push('LONG_PREPARATION_BURDEN');
    state.balance.policy.allowedWarningCodes.sort();
  });
  const { days, ...weekHeader } = fixtureWeekValidationInput(f);
  days[0].meals[0].validationInput.warningSignals = {
    ...days[0].meals[0].validationInput.warningSignals, longPreparationBurden: true,
  };
  const result = await searchGenerationWeekRawV1(JSON.stringify({ contract: generationWeekSearchContractV1,
    weekHeader, dayOptions: days.map(day => [day]), maxEvaluations: 1 }), f.rawContext.candidateManifestRaw);
  assert.equal(result.status, 'FEASIBLE_PROPOSAL');
  if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.equal(result.validation.status, 'VALID_WITH_WARNINGS');
  assert.ok(result.validation.reasons.some(reason => reason.code === 'LONG_PREPARATION_BURDEN'));
});

test('malformed visited evidence aborts instead of being skipped as an unsuitable meal', async () => {
  const { input, manifest } = await fixture();
  input.dayOptions[0][0].meals[0].validationInput.componentEvidence[0].manifestDigest = '0'.repeat(64);
  await assert.rejects(searchGenerationWeekRawV1(JSON.stringify(input), manifest));
});

test('wrong dates and stale goal revision cannot produce a feasible proposal', async () => {
  for (const field of ['date', 'goalRevision'] as const) {
    const { input, manifest } = await fixture();
    input.dayOptions[3][0][field] = field === 'date' ? '2026-10-08' : '00000000-0000-4000-8000-000000009999';
    assert.equal((await searchGenerationWeekRawV1(JSON.stringify(input), manifest)).status,
      field === 'goalRevision' ? 'BLOCKED_MISSING_EVIDENCE' : 'NO_FEASIBLE_WEEK_IN_POOL');
  }
});

test('raw boundaries reject duplicate and escaped duplicate keys in both sources', async () => {
  const { input, manifest } = await fixture();
  const raw = JSON.stringify(input);
  await assert.rejects(searchGenerationWeekRawV1(raw.replace('{', '{"maxEvaluations":1,'), manifest));
  await assert.rejects(searchGenerationWeekRawV1(raw.replace('{', '{"max\\u0045valuations":1,'), manifest));
  await assert.rejects(searchGenerationWeekRawV1(raw, manifest.replace('{', '{"digest":"x",')));
});

test('rejects oversized, non-string and unsupported inputs', async () => {
  const { input, manifest } = await fixture();
  await assert.rejects(searchGenerationWeekRawV1(' '.repeat(8_000_001), manifest), /too_large/);
  await assert.rejects(searchGenerationWeekRawV1(null as unknown as string, manifest), /strings_required/);
  await assert.rejects(searchGenerationWeekRawV1(JSON.stringify({ ...input, contract: 'other' }), manifest), /unsupported/);
  await assert.rejects(searchGenerationWeekRawV1(JSON.stringify({ ...input, extra: true }), manifest), /invalid_week_search_input/);
});

test('enforces finite search budgets and bounded complete day pools', async () => {
  const { input, manifest } = await fixture();
  for (const maxEvaluations of [0, -1, 1.5, 1025, '1', null]) {
    await assert.rejects(searchGenerationWeekRawV1(JSON.stringify({ ...input, maxEvaluations }), manifest), /budget/);
  }
  for (const dayOptions of [[], input.dayOptions.slice(0, 6), [...input.dayOptions, input.dayOptions[0]],
    [[], ...input.dayOptions.slice(1)], [Array(17).fill(input.dayOptions[0][0]), ...input.dayOptions.slice(1)]]) {
    await assert.rejects(searchGenerationWeekRawV1(JSON.stringify({ ...input, dayOptions }), manifest));
  }
});
