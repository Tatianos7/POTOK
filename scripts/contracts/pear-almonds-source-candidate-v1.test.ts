import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeFoodEvidenceSourceDecimalV1 } from '../../src/utils/foodReviewedEvidenceV1';
const base = new URL('../../docs/premium/retained-sources/pear-almonds-review-20261030/', import.meta.url);
const p = JSON.parse(readFileSync(new URL('source-candidate-v1.json', base), 'utf8'));
const minor = (s: string) => BigInt(normalizeFoodEvidenceSourceDecimalV1(s).replace('.', ''));
const decimal = (n: bigint) => `${n / 1000n}.${String(n % 1000n).padStart(3, '0')}`;

test('mapping retains the exact existing parent policy and its definition bytes without approving it', () => {
  const root = new URL('../../', import.meta.url);
  const bytes = readFileSync(new URL(p.mapping.parentPackagePath, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), p.mapping.parentPackageSha256);
  const parent = JSON.parse(bytes.toString('utf8'));
  assert.equal(parent.carbsMappingPolicy.version, p.mapping.referencedPolicyVersion);
  assert.deepEqual(parent.carbsMappingPolicy.definitionSourceBindings, p.mapping.parentDefinitionBindings);
  for (const digest of p.mapping.parentDefinitionBindings) {
    const capture = parent.additionalRetainedSources.find((s: { sha256: string }) => s.sha256 === digest);
    assert.ok(capture, `Missing retained definition ${digest}`);
    assert.equal(createHash('sha256').update(readFileSync(new URL(capture.retainedPath, root))).digest('hex'), digest);
  }
  assert.equal(p.mapping.foodSpecificApproval, false);
});

test('retained primary source captures match their actual byte hashes and exact record/page locators', () => {
  for (const item of [...p.ingredients.map((i: typeof p.ingredients[number]) => ({ path: i.source.capturePath, sha256: i.source.captureSha256 })), p.mapping.semanticsCapture]) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(item.path, base))).digest('hex'), item.sha256);
  }
  assert.deepEqual(p.ingredients.map((i: typeof p.ingredients[number]) => [i.sourceCode, i.source.pdfPageOneBased]), [['NDB09252', 707], ['NDB12061', 18]]);
});
test('explicit source fiber is excluded once under the referenced existing policy, keeping source calories', () => {
  assert.equal(p.mapping.referencedPolicyVersion, 'potok-source-total-including-fiber-to-available-v1');
  for (const i of p.ingredients) {
    assert.equal(i.basis, 'PER_100_G_EDIBLE');
    assert.equal(decimal(minor(i.sourceFacts.totalCarbohydrate) - minor(i.sourceFacts.fiber)), i.candidatePer100G.carbs);
    for (const key of ['calories', 'protein', 'fat', 'fiber']) assert.equal(normalizeFoodEvidenceSourceDecimalV1(i.sourceFacts[key]), i.candidatePer100G[key]);
  }
});
test('independent fixed-point arithmetic reproduces edible input totals without applying refuse twice', () => {
  for (const key of ['calories', 'protein', 'fat', 'carbs', 'fiber']) {
    const total = p.ingredients.reduce((n: bigint, i: typeof p.ingredients[number]) => n + minor(i.candidatePer100G[key]) * minor(i.inputEdibleGrams) / 100000n, 0n);
    const expected = key === 'carbs' ? p.referenceInputCalculation.candidateAvailableCarbohydrate : p.referenceInputCalculation[key];
    assert.equal(decimal(total), expected);
  }
  assert.equal(p.referenceInputCalculation.sourceTotalCarbohydrate, '31.724');
  const sourceTotal = p.ingredients.reduce((n: bigint, i: typeof p.ingredients[number]) =>
    n + minor(i.sourceFacts.totalCarbohydrate) * minor(i.inputEdibleGrams) / 100000n, 0n);
  assert.equal(decimal(sourceTotal), p.referenceInputCalculation.sourceTotalCarbohydrate);
  assert.equal(decimal(minor('31.724') - minor('8.080')), '23.644');
  assert.deepEqual(p.ingredients.map((i: typeof p.ingredients[number]) => i.inputEdibleGrams), ['180.000', '20.000']);
});
test('workbook reference discrepancy stays explicit; no reference, measurement or approval is overwritten', () => {
  assert.equal(p.sourceWorkbook.modified, false); assert.equal(p.sourceWorkbook.referenceNutrition.carbs, '31.7');
  assert.equal(p.referenceInputCalculation.candidateAvailableCarbsRounded1dp, '23.6');
  for (const key of ['measuredFinishedYieldG', 'measuredServingMassG', 'confirmedServings', 'reviewedRecipeNutrition']) assert.equal(p.referenceInputCalculation[key], null);
  assert.ok(Object.values(p.gates).every(v => v === false));
  assert.ok(p.ingredients.every((i: typeof p.ingredients[number]) => i.canonicalFoodId === null && i.reviewedNutritionEvidenceRevision === null));
});
