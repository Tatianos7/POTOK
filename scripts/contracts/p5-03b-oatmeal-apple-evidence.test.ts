import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditCuratedRecipePublicationV1, compileCuratedRecipePublicationV1, curatedRecipePublicationContractV1,
  type CuratedRecipeAuthoringV1 } from '../../src/utils/curatedRecipePublicationV1';

const path = new URL('../../docs/premium/retained-sources/p5-03b/source-package-v1.json', import.meta.url);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const loadPackage = async () => JSON.parse(await readFile(path, 'utf8'));

// Source-candidate reference check, not an activated runtime converter/issuer.
function mappedOats(oats: { referenceKind: string; brand: string | null; sourceIdentity: string;
  foodState: string; basis: string; sourceFacts: Record<string, string | null> }) {
  if (oats.referenceKind !== 'GENERIC' || oats.brand !== null
    || oats.sourceIdentity !== 'Cereals, oats, regular and quick, not fortified, dry'
    || oats.foodState !== 'dry' || oats.basis !== 'PER_100_G_EDIBLE'
    || oats.sourceFacts.carbohydrateSemantics !== 'TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER') {
    throw new Error('INAPPLICABLE_SOURCE');
  }
  const minor = (v: string | null) => {
    if (v === null || !/^(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/.test(v)) throw new Error('UNKNOWN_NUTRIENT');
    const [w, f = ''] = v.split('.'); return BigInt(w) * 1000n + BigInt(f.padEnd(3, '0'));
  };
  const result = minor(oats.sourceFacts.totalCarbohydrate) - minor(oats.sourceFacts.fiber);
  if (result < 0n) throw new Error('NEGATIVE_AVAILABLE');
  return `${result / 1000n}.${String(result % 1000n).padStart(3, '0')}`;
}

async function parentBinding(pkg: Awaited<ReturnType<typeof loadPackage>>) {
  const b = await readFile(new URL(`../../${pkg.parent.packagePath}`, import.meta.url));
  assert.equal(sha(b), pkg.parent.packageSha256);
  const parent = JSON.parse(b.toString('utf8'));
  const apple = parent.products[pkg.appleReuse.parentProductIndex];
  assert.equal(apple.stableFoodId, 'apple');
  assert.equal(apple.source.retainedBytesSha256, pkg.appleReuse.retainedSourceSha256);
  assert.equal(parent.carbsMappingPolicy.version, pkg.parent.policyVersion);
  assert.deepEqual(parent.carbsMappingPolicy.definitionSourceBindings, pkg.parent.policyDefinitionBindings);
  assert.equal(pkg.appleReuse.policyVersion, parent.carbsMappingPolicy.version);
  return apple;
}

test('P5-03B reuses pinned parent apple and preserves recipe/source bytes', async () => {
  const pkg = await loadPackage(); const apple = await parentBinding(pkg);
  assert.equal(pkg.parent.head, 'dc3ed6e8bb4f0cfb0534b5d632dee0018856040c');
  assert.equal(apple.sourceFactsPer100GEdible.carbsG, '13.81');
  assert.equal(apple.proposedNutritionPer100GEdible.carbsG, '11.41');
  assert.equal(apple.proposedNutritionPer100GEdible.caloriesKcal, '52');
  const bytes = await readFile(new URL(`../../${pkg.recipe.sourcePath}`, import.meta.url));
  assert.equal(sha(bytes), pkg.recipe.sourceSha256);
  const recipe = JSON.parse(bytes.toString('utf8')).find((r: { stable_recipe_id: string }) => r.stable_recipe_id === pkg.recipe.id);
  assert.equal(recipe.servings, pkg.recipe.servings);
  assert.deepEqual(recipe.ingredients, pkg.recipe.ingredients.map((i: { stable_food_id: string; amount_g: number }) =>
    ({ stable_food_id: i.stable_food_id, amount_g: i.amount_g })));
  assert.equal(pkg.appleReuse.independentAppleRevisionCreated, false);
});

test('P5-03B rejects drifted apple source/policy/retained bindings', async () => {
  const original = await loadPackage();
  for (const patch of [(p: typeof original) => { p.parent.packageSha256 = '0'.repeat(64); },
    (p: typeof original) => { p.appleReuse.retainedSourceSha256 = '0'.repeat(64); },
    (p: typeof original) => { p.appleReuse.policyVersion = 'foreign'; },
    (p: typeof original) => { p.parent.policyDefinitionBindings = []; }]) {
    const p = structuredClone(original); patch(p); await assert.rejects(parentBinding(p));
  }
});

test('P5-03B generic dry oats map exact totals and reject brand/state/unknown fiber/semantics', async () => {
  const pkg = await loadPackage(); assert.equal(mappedOats(pkg.oats), '57.600');
  assert.equal(pkg.oats.mappedCandidate.calories, '379.000');
  const bytes = await readFile(new URL(`../../${pkg.oats.source.retainedPath}`, import.meta.url));
  assert.equal(bytes.length, pkg.oats.source.byteLength); assert.equal(sha(bytes), pkg.oats.source.sha256);
  for (const patch of [(p: typeof pkg.oats) => { p.brand = 'QUAKER'; },
    (p: typeof pkg.oats) => { p.referenceKind = 'BRANDED'; },
    (p: typeof pkg.oats) => { p.sourceIdentity = 'flavored oats'; },
    (p: typeof pkg.oats) => { p.foodState = 'cooked'; },
    (p: typeof pkg.oats) => { p.sourceFacts.fiber = null; },
    (p: typeof pkg.oats) => { p.sourceFacts.carbohydrateSemantics = 'UNKNOWN'; },
    (p: typeof pkg.oats) => { p.sourceFacts.totalCarbohydrate = '1'; }]) {
    const p = structuredClone(pkg.oats); patch(p); assert.throws(() => mappedOats(p));
  }
});

test('P5-03B food input subtotal is exact and never invents water or finished yield', async () => {
  const p = await loadPackage(); const apple = await parentBinding(p);
  const base = [p.oats.mappedCandidate, { calories: apple.proposedNutritionPer100GEdible.caloriesKcal,
    protein: apple.proposedNutritionPer100GEdible.proteinG, fat: apple.proposedNutritionPer100GEdible.fatG,
    carbs: apple.proposedNutritionPer100GEdible.carbsG, fiber: apple.proposedNutritionPer100GEdible.fiberG }];
  for (const field of ['calories', 'protein', 'fat', 'carbs', 'fiber']) {
    const values = base.map((v, i) => Number(v[field]) * [50, 120][i] / 100);
    values.forEach((v, i) => assert.equal(v.toFixed(3), p.foodInputCandidate.contributions[i][field]));
    assert.equal(values.reduce((a, b) => a + b, 0).toFixed(3), p.foodInputCandidate.foodSubtotal[field]);
  }
  assert.equal(p.water.confirmedNutritionContribution, null);
  assert.equal(p.foodInputCandidate.completeRecipeNutrition, null);
  assert.equal(p.recipe.inputMassSumG, 370);
  assert.equal(p.recipe.measuredFinishedYieldG, null);
  assert.equal(p.physicalProtocol.measuredResults, null);
  assert.equal(p.statuses.PHYSICAL_COOKING_REQUIRED, true);
});

function waterProjection(): CuratedRecipeAuthoringV1 {
  const nutrition = { calories: null, protein: null, fat: null, carbs: null, fiber: null,
    basis: 'full_recipe' as const, authority: 'reference_only' as const, evidenceRef: null, evidenceDigest: null };
  return { contract: curatedRecipePublicationContractV1, authoringRecipeId: 'oatmeal_with_apple',
    nameRu: 'Овсяная каша с яблоком', nameEn: null, description: 'Unissued projection for water blocker only',
    status: 'NEEDS_REVIEW', baseYield: { servings: '1.000', servingLabel: 'порция', totalWeightG: null, servingWeightG: null },
    nutrition, ingredients: [{ ingredientRowId: 'water', sortOrder: 0, nameRu: 'Вода', nameEn: null,
      amount: '200.000', unit: 'g', weightG: '200.000', optional: false, preparationNote: null,
      state: 'as-sold', componentKind: 'approved_non_food', foodStableId: null, canonicalStatus: 'NOT_APPLICABLE',
      canonical: null, approvedNonFoodEvidenceRef: null, normalizationEvidenceRef: null, nutrition,
      scalingMode: null, discreteIncrement: null }], steps: [], tags: [],
    eligibility: { collectionVisible: false, planEligible: false, allowedMealTypes: ['breakfast'] },
    safety: { allergenReview: 'blocked', allergenEvidenceRef: null, dietaryReview: 'blocked', dietaryEvidenceRef: null },
    source: { workbookRevision: null, recipeEvidenceRef: null } };
}

test('P5-03B real water projection fails closed on nonfood approval and nutrition, food relabel does not bypass', async () => {
  const p = await loadPackage(); assert.equal(p.water.approvedNonFoodDefinitionBinding, null);
  const a = waterProjection(); let codes = auditCuratedRecipePublicationV1(a).blockers.map(b => b.code);
  assert.ok(codes.includes('NON_NUTRITIVE_APPROVAL_MISSING')); assert.ok(codes.includes('SOURCE_CONFLICT'));
  a.ingredients[0].componentKind = 'food'; a.ingredients[0].foodStableId = 'water';
  codes = auditCuratedRecipePublicationV1(a).blockers.map(b => b.code);
  assert.ok(codes.includes('CANONICAL_POINTER_INVALID')); assert.ok(codes.includes('CANONICAL_FOOD_ID_MISSING'));
  assert.equal(p.water.manifestIngredientIdsIncludesWater, false);
  assert.equal(p.statuses.WATER_COMPONENT_READY, false);
  assert.equal(p.statuses.SOURCE_DATA_READY_FOR_ISSUANCE_INPUT, false);
  assert.equal(p.statuses.CAN_ISSUE_REAL_REVIEWED_EVIDENCE, false); assert.equal(p.statuses.CAN_ASSEMBLE, false);
});

function explicitWaterZero(water: { identity: Record<string, unknown>;
  sourceCandidate: { recordId: string; version: string; basis: string;
    sourceFacts: Record<string, unknown>; fieldMappings: Record<string, string>; units: Record<string, string> } }) {
  const i = water.identity, s = water.sourceCandidate;
  if (i.referenceIdentity !== 'ordinary plain as-used potable tap drinking water'
    || i.foodState !== 'as-sold' || i.usageState !== 'as-used potable water before cooking'
    || ['sugarOrOtherAdditives', 'mineralWater', 'carbonated', 'flavored'].some(k => i[k] !== false)
    || s.recordId !== 'NDB 14411' || s.version !== 'SR Release 28 (2015)' || s.basis !== 'PER_100_G_EDIBLE') {
    throw new Error('INAPPLICABLE_WATER_SOURCE');
  }
  for (const [target, source] of [['calories', 'calories'], ['protein', 'protein'],
    ['fat', 'fat'], ['carbs', 'totalCarbohydrate'], ['fiber', 'fiber']]) {
    const value = s.sourceFacts[source];
    if (typeof value !== 'string' || !/^0(?:\.0+)?$/.test(value)
      || !s.fieldMappings[target] || s.units[target] !== (target === 'calories' ? 'kcal' : 'g')) {
      throw new Error('EXPLICIT_ZERO_PROOF_REQUIRED');
    }
  }
  return { calories: '0.000', protein: '0.000', fat: '0.000', carbs: '0.000', fiber: '0.000' };
}

test('water candidate binds official SR28 numeric zero record, exact identity and retained bytes', async () => {
  const p = await loadPackage(); const w = p.water; const s = w.sourceCandidate;
  assert.deepEqual(explicitWaterZero(w), s.mappedCandidate);
  assert.equal(s.officialTitle, 'Beverages, water, tap, drinking (1)');
  assert.equal(s.ndbId, '14411'); assert.equal(s.fdcId, null);
  assert.equal(s.dataType, 'USDA Standard Reference food-composition record');
  assert.equal(s.source.hashScope, 'RETAINED_UTF8_EXCERPT_ONLY');
  const bytes = await readFile(new URL(`../../${s.source.retainedPath}`, import.meta.url));
  assert.equal(bytes.length, s.source.byteLength); assert.equal(sha(bytes), s.source.sha256);
  assert.match(bytes.toString('utf8'), /Fiber, total dietary: 0.0 g/);
  assert.equal(w.massG, '200'); assert.equal(p.recipe.ingredients[1].amount_g, 200);
  assert.deepEqual(p.foodInputCandidate.sourceCandidateInputTotal, p.foodInputCandidate.foodSubtotal);
  assert.equal(w.confirmedNutritionContribution, null);
  assert.equal(w.approvedNonFoodDefinitionBinding, null);
  assert.equal(w.approvedNonFoodEvidenceRef, null);
  const compiled = compileCuratedRecipePublicationV1(waterProjection(), {
    recipeId: '', recipeRevisionId: '', portionRevisionId: '', eligibilityRevisionId: '',
    assignedServingsIncrement: '', components: { water: { componentId: '',
      normalizationEvidenceId: null, approvedNonFoodDefinitionId: null } },
  });
  assert.equal(compiled.recipeRevision, null); assert.equal(compiled.manifestTuple, null);

  assert.equal(w.definitionMechanism.currentAuthorizedIssuer, null);
  assert.equal(w.definitionMechanism.serverIssuerFound, false);
  assert.equal(w.manifestIngredientIdsIncludesWater, false);
  assert.equal(p.statuses.WATER_SOURCE_CANDIDATE_READY, true);
  assert.equal(p.statuses.WATER_DEFINITION_CONTRACT_AVAILABLE, false);
  assert.equal(p.statuses.WATER_COMPONENT_READY, false);
  assert.equal(p.statuses.SOURCE_DATA_READY_FOR_ISSUANCE_INPUT, false);
  assert.equal(p.statuses.PHYSICAL_COOKING_REQUIRED, true);
  assert.equal(p.statuses.CAN_ISSUE_REAL_REVIEWED_EVIDENCE, false);
  assert.equal(p.statuses.CAN_ASSEMBLE, false);
  const raw = JSON.stringify(w);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/.test(raw), false);
  await parentBinding(p);
});

test('water source rejects blank, missing, implicit zero and incompatible identity/basis/units', async () => {
  const p = await loadPackage(); const w = p.water;
  for (const field of ['calories', 'protein', 'fat', 'totalCarbohydrate', 'fiber']) {
    for (const value of [null, '', '—', 0, '0.1', undefined]) {
      const candidate = structuredClone(w); candidate.sourceCandidate.sourceFacts[field] = value;
      assert.throws(() => explicitWaterZero(candidate));
    }
  }
  for (const field of ['sugarOrOtherAdditives', 'mineralWater', 'carbonated', 'flavored']) {
    const candidate = structuredClone(w); candidate.identity[field] = true;
    assert.throws(() => explicitWaterZero(candidate));
  }
  for (const change of [(c: typeof w) => { c.sourceCandidate.units.fiber = 'mg'; },
    (c: typeof w) => { c.sourceCandidate.basis = 'PER_SERVING'; },
    (c: typeof w) => { c.sourceCandidate.recordId = 'OTHER'; },
    (c: typeof w) => { delete c.sourceCandidate.fieldMappings.fiber; }]) {
    const candidate = structuredClone(w); change(candidate); assert.throws(() => explicitWaterZero(candidate));
  }
});
