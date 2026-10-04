import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptiveMealCompositionEligibilityV1_1,
  composeAdaptiveMealV1,
  decodeMealSnapshotV1,
  type MealAnchorKindV1,
  type MealComponentCandidateV1,
  type MealComponentRoleV1,
  type MealComposerInputV1,
  type MealCompositionPolicyV1,
  type MealEnergyClassV1,
  type MealGoalProfileV1,
} from '../adaptiveNutritionMealCompositionV1';
import {
  scalePremiumRecipeCollectionV1,
  type GraphNutritionV1,
  type GraphQuantityUnitV1,
  type GraphRecipeSnapshotV1,
} from '../adaptiveNutritionGraphV1';

const nutrition = (calories: string, protein: string, fat: string, carbs: string, fiber: string): GraphNutritionV1 =>
  ({ calories, protein, fat, carbs, fiber });
const zero = nutrition('0.000', '0.000', '0.000', '0.000', '0.000');
const high = nutrition('9999.000', '9999.000', '9999.000', '9999.000', '9999.000');
const uuid = (value: number): string => `${value.toString(16).padStart(8, '0')}-0000-4000-8000-${String(value).padStart(12, '0')}`;

let identity = 100;

interface CandidateOptions {
  role: MealComponentRoleV1;
  anchorKind?: MealAnchorKindV1;
  value: GraphNutritionV1;
  name?: string;
  required?: MealComponentRoleV1[][];
  pairingTags?: string[];
  incompatiblePairingTags?: string[];
  energyClass?: MealEnergyClassV1;
  beverageClass?: 'NOT_BEVERAGE' | 'NON_CALORIC' | 'CALORIC';
  baseServings?: string;
  assignedServings?: string;
  quantity?: string;
  unit?: GraphQuantityUnitV1;
  increment?: string;
  recipeRevisionId?: string;
}

function candidate(options: CandidateOptions): MealComponentCandidateV1 {
  const base = identity;
  identity += 20;
  const recipeRevisionId = options.recipeRevisionId ?? uuid(base + 2);
  const baseServings = options.baseServings ?? '1.000';
  const assignedServings = options.assignedServings ?? baseServings;
  const unit = options.unit ?? 'g';
  const quantity = options.quantity ?? '100.000';
  const recipe: GraphRecipeSnapshotV1 = {
    recipeId: uuid(base + 1),
    recipeRevisionId,
    displayNameSnapshot: options.name ?? `${options.role} ${base}`,
    baseYield: { servings: baseServings, servingLabel: 'порция', totalYieldGrams: '100.000' },
    fullRecipeNutrition: options.value,
    ingredients: [{
      componentId: uuid(base + 3),
      recipeRevisionId,
      identity: { kind: 'canonical_food', canonicalFoodId: uuid(base + 4) },
      displayNameSnapshot: options.name ?? `${options.role} ingredient`,
      state: 'as-sold',
      quantity: { amount: quantity, unit },
      normalizedGrams: '100.000',
      normalizationEvidenceRef: unit === 'g' ? null : uuid(base + 5),
      scaling: options.increment ? { mode: 'discrete', increment: options.increment } : { mode: 'continuous' },
      nutrition: options.value,
      sortOrder: 0,
    }],
  };
  const preview = scalePremiumRecipeCollectionV1(recipe, assignedServings);
  const anchorKind = options.anchorKind ?? (options.role === 'MAIN_COMPONENT'
    ? options.required ? 'PARTIAL' : 'COMPLETE'
    : 'NONE');
  const required = options.required ?? [];
  return {
    mealComponentId: uuid(base + 6),
    eligibility: {
      contract: adaptiveMealCompositionEligibilityV1_1,
      eligibilityRevisionId: uuid(base + 7),
      recipeRevisionId,
      compositionPolicyRevision: uuid(10),
      role: options.role,
      anchorKind,
      allowedMealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
      requiredCompanionRoleSets: required,
      pairingTags: [...(options.pairingTags ?? [])].sort(),
      incompatiblePairingTags: [...(options.incompatiblePairingTags ?? [])].sort(),
      repeatFamily: `family_${base}`,
      energyClass: options.energyClass ?? 'BALANCED',
      beverageClass: options.beverageClass ?? 'NOT_BEVERAGE',
    },
    recipeRevision: recipeRevisionId,
    portionRevision: uuid(base + 8),
    recipe,
    assignedPortion: {
      source: 'potok_generator',
      portionRevisionId: uuid(base + 8),
      assignedServings,
      servingMultiplier: preview.scaleFactor,
      assignedGrams: preview.scaleFactor === '1.000' ? '100.000' : '50.000',
    },
    ingredients: preview.ingredients,
    nutrition: preview.nutrition,
  };
}

function policy(rolePatterns: MealComponentRoleV1[][]): MealCompositionPolicyV1 {
  return {
    policyRevision: uuid(10),
    maxComponents: 6,
    patterns: rolePatterns.map((roles, index) => ({
      patternId: `pattern_${index}`,
      allowedMealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
      roles,
    })),
    nutritionWeights: { calories: 1, protein: 1, fat: 1, carbs: 1, fiber: 1 },
  };
}

function input(
  candidates: MealComponentCandidateV1[],
  rolePatterns: MealComponentRoleV1[][],
  target: GraphNutritionV1,
  overrides: Partial<MealComposerInputV1> = {},
): MealComposerInputV1 {
  return {
    mealSlotId: uuid(20),
    mealSnapshotRevision: uuid(21),
    mealType: 'dinner',
    goalRevision: uuid(22),
    goalProfile: 'MAINTENANCE',
    policy: policy(rolePatterns),
    slotTarget: target,
    slotHardMaximum: high,
    currentDayNutrition: zero,
    dayTarget: target,
    dayHardMaximum: high,
    excludedRecipeRevisions: [],
    excludedRepeatFamilies: [],
    candidates,
    ...overrides,
  };
}

async function completeResult(value: MealComposerInputV1) {
  const result = await composeAdaptiveMealV1(value);
  assert.equal(result.status, 'COMPLETE');
  if (result.status !== 'COMPLETE') throw new Error('expected_complete');
  return result.meal;
}

test('1: oatmeal is a complete breakfast through anchorKind rather than a special role', async () => {
  const full = candidate({ role: 'MAIN_COMPONENT', name: 'Овсянка с яблоком',
    value: nutrition('420.000', '20.000', '12.000', '58.000', '8.000') });
  const meal = await completeResult(input([full], [['MAIN_COMPONENT']], full.nutrition, { mealType: 'breakfast' }));
  assert.deepEqual(meal.components.map((item) => item.eligibility.role), ['MAIN_COMPONENT']);
  assert.equal(meal.components[0].eligibility.anchorKind, 'COMPLETE');
});

test('2: turkey gnocchi can be a complete meal without role-specific anchor semantics', async () => {
  const gnocchi = candidate({ role: 'MAIN_COMPONENT', name: 'Ньокки с индейкой',
    value: nutrition('513.000', '32.500', '16.800', '59.500', '5.000') });
  const meal = await completeResult(input([gnocchi], [['MAIN_COMPONENT']], gnocchi.nutrition,
    { mealType: 'lunch' }));
  assert.equal(meal.components[0].eligibility.anchorKind, 'COMPLETE');
});

test('3: fish plus salad forms a lighter complete dinner', async () => {
  const fish = candidate({ role: 'MAIN_COMPONENT', name: 'Рыба', required: [['CARB_SIDE', 'SALAD']],
    value: nutrition('180.000', '32.000', '5.000', '0.000', '0.000'), energyClass: 'LIGHTER' });
  const salad = candidate({ role: 'SALAD', name: 'Салат',
    value: nutrition('90.000', '3.000', '4.000', '10.000', '5.000'), energyClass: 'LIGHTER' });
  const carb = candidate({ role: 'CARB_SIDE', name: 'Рис',
    value: nutrition('180.000', '4.000', '1.000', '38.000', '2.000') });
  const target = nutrition('270.000', '35.000', '9.000', '10.000', '5.000');
  const meal = await completeResult(input([fish, salad, carb], [['MAIN_COMPONENT', 'SALAD'],
    ['MAIN_COMPONENT', 'CARB_SIDE', 'SALAD']], target));
  assert.deepEqual(meal.components.map((item) => item.eligibility.role), ['MAIN_COMPONENT', 'SALAD']);
});

test('4: fish plus carb and salad satisfies the reviewed higher-energy target', async () => {
  const fish = candidate({ role: 'MAIN_COMPONENT', required: [['CARB_SIDE', 'SALAD']],
    value: nutrition('180.000', '32.000', '5.000', '0.000', '0.000') });
  const carb = candidate({ role: 'CARB_SIDE', value: nutrition('180.000', '4.000', '1.000', '38.000', '2.000') });
  const salad = candidate({ role: 'SALAD', value: nutrition('90.000', '3.000', '4.000', '10.000', '5.000') });
  const target = nutrition('450.000', '39.000', '10.000', '48.000', '7.000');
  const meal = await completeResult(input([fish, carb, salad], [['MAIN_COMPONENT', 'SALAD'],
    ['MAIN_COMPONENT', 'CARB_SIDE', 'SALAD']], target));
  assert.deepEqual(meal.components.map((item) => item.eligibility.role), ['MAIN_COMPONENT', 'CARB_SIDE', 'SALAD']);
});

test('5: cutlet, buckwheat and vegetables form a complete lunch', async () => {
  const cutlet = candidate({ role: 'MAIN_COMPONENT', required: [['CARB_SIDE'], ['VEGETABLE_SIDE', 'SALAD']],
    value: nutrition('250.000', '28.000', '14.000', '3.000', '1.000') });
  const buckwheat = candidate({ role: 'CARB_SIDE', value: nutrition('170.000', '6.000', '2.000', '34.000', '5.000') });
  const vegetables = candidate({ role: 'VEGETABLE_SIDE', value: nutrition('80.000', '3.000', '2.000', '12.000', '6.000') });
  const target = nutrition('500.000', '37.000', '18.000', '49.000', '12.000');
  const meal = await completeResult(input([cutlet, buckwheat, vegetables],
    [['MAIN_COMPONENT', 'CARB_SIDE', 'VEGETABLE_SIDE']], target, { mealType: 'lunch' }));
  assert.equal(meal.nutrition.calories, '500.000');
});

test('partial anchor without its reviewed companion is deterministically rejected', async () => {
  const main = candidate({ role: 'MAIN_COMPONENT', required: [['SALAD']],
    value: nutrition('200.000', '30.000', '8.000', '0.000', '0.000') });
  const result = await composeAdaptiveMealV1(input([main], [['MAIN_COMPONENT']], main.nutrition));
  assert.deepEqual(result, { status: 'INCOMPLETE', reasons: ['NO_COMPLETE_COMPATIBLE_COMPOSITION'] });
});

test('6: caloric beverage contributes to authoritative meal nutrition', async () => {
  const full = candidate({ role: 'MAIN_COMPONENT', value: nutrition('350.000', '25.000', '10.000', '40.000', '6.000') });
  const drink = candidate({ role: 'BEVERAGE', beverageClass: 'CALORIC',
    value: nutrition('120.000', '6.000', '4.000', '15.000', '0.000') });
  const target = nutrition('470.000', '31.000', '14.000', '55.000', '6.000');
  const meal = await completeResult(input([full, drink], [['MAIN_COMPONENT', 'BEVERAGE']], target));
  assert.deepEqual(meal.nutrition, target);
});

test('7: water or reviewed unsweetened beverage adds no nutrition distortion', async () => {
  const full = candidate({ role: 'MAIN_COMPONENT', value: nutrition('350.000', '25.000', '10.000', '40.000', '6.000') });
  const water = candidate({ role: 'BEVERAGE', beverageClass: 'NON_CALORIC', value: zero });
  const meal = await completeResult(input([full, water], [['MAIN_COMPONENT', 'BEVERAGE']], full.nutrition));
  assert.deepEqual(meal.nutrition, full.nutrition);
});

test('tofu, rice and broccoli can be one reviewed plant-based complete recipe', async () => {
  const tofuBowl = candidate({ role: 'MAIN_COMPONENT', name: 'Тофу с рисом и брокколи',
    value: nutrition('480.000', '28.000', '16.000', '58.000', '11.000') });
  const meal = await completeResult(input([tofuBowl], [['MAIN_COMPONENT']], tofuBowl.nutrition,
    { mealType: 'lunch' }));
  assert.equal(meal.components[0].eligibility.anchorKind, 'COMPLETE');
});

test('hummus can be a partial MAIN_COMPONENT without a false protein-only label', async () => {
  const hummus = candidate({ role: 'MAIN_COMPONENT', name: 'Хумус',
    required: [['CARB_SIDE'], ['VEGETABLE_SIDE', 'SALAD']],
    value: nutrition('180.000', '7.000', '10.000', '18.000', '6.000') });
  const toast = candidate({ role: 'CARB_SIDE', name: 'Цельнозерновой тост',
    value: nutrition('120.000', '4.000', '2.000', '22.000', '4.000') });
  const vegetables = candidate({ role: 'VEGETABLE_SIDE', name: 'Овощные палочки',
    value: nutrition('60.000', '2.000', '0.000', '12.000', '5.000') });
  const target = nutrition('360.000', '13.000', '12.000', '52.000', '15.000');
  const meal = await completeResult(input([hummus, toast, vegetables],
    [['MAIN_COMPONENT', 'CARB_SIDE', 'VEGETABLE_SIDE']], target, { mealType: 'snack' }));
  assert.equal(meal.components[0].eligibility.anchorKind, 'PARTIAL');
});

test('cottage cheese can be a partial dairy anchor with bread or fruit companion', async () => {
  const cottageCheese = candidate({ role: 'MAIN_COMPONENT', name: 'Творог', required: [['CARB_SIDE', 'EXTRA']],
    value: nutrition('180.000', '28.000', '7.000', '6.000', '0.000') });
  const fruit = candidate({ role: 'EXTRA', name: 'Яблоко',
    value: nutrition('80.000', '0.000', '0.000', '21.000', '4.000') });
  const target = nutrition('260.000', '28.000', '7.000', '27.000', '4.000');
  const meal = await completeResult(input([cottageCheese, fruit], [['MAIN_COMPONENT', 'EXTRA']], target,
    { mealType: 'snack' }));
  assert.equal(meal.components[0].eligibility.anchorKind, 'PARTIAL');
});

test('caloric smoothie can be the one complete snack anchor while retaining BEVERAGE role', async () => {
  const smoothie = candidate({ role: 'BEVERAGE', anchorKind: 'COMPLETE', beverageClass: 'CALORIC',
    name: 'Белковый смузи', value: nutrition('222.000', '18.600', '5.200', '28.800', '7.700') });
  const meal = await completeResult(input([smoothie], [['BEVERAGE']], smoothie.nutrition, { mealType: 'snack' }));
  assert.equal(meal.components[0].eligibility.role, 'BEVERAGE');
  assert.equal(meal.components[0].eligibility.anchorKind, 'COMPLETE');
});

test('two anchors are rejected even when their roles differ', async () => {
  const breakfast = candidate({ role: 'MAIN_COMPONENT', value: nutrition('350.000', '20.000', '10.000', '45.000', '7.000') });
  const smoothie = candidate({ role: 'BEVERAGE', anchorKind: 'COMPLETE', beverageClass: 'CALORIC',
    value: nutrition('200.000', '15.000', '5.000', '25.000', '5.000') });
  const result = await composeAdaptiveMealV1(input([breakfast, smoothie], [['MAIN_COMPONENT', 'BEVERAGE']], high));
  assert.equal(result.status, 'INCOMPLETE');
});

test('8: Adaptive HYBRID portions accept valid and reject invalid countable increments', async () => {
  const valid = candidate({ role: 'MAIN_COMPONENT', value: nutrition('160.000', '14.000', '10.000', '2.000', '0.000'),
    unit: 'piece', quantity: '1.000', increment: '1.000' });
  assert.equal((await composeAdaptiveMealV1(input([valid], [['MAIN_COMPONENT']], valid.nutrition))).status, 'COMPLETE');
  const invalid = candidate({ role: 'MAIN_COMPONENT', value: nutrition('320.000', '28.000', '20.000', '4.000', '0.000'),
    unit: 'piece', quantity: '1.000', increment: '1.000', baseServings: '2.000', assignedServings: '1.000' });
  await assert.rejects(() => composeAdaptiveMealV1(input([invalid], [['MAIN_COMPONENT']], invalid.nutrition)),
    /discrete_increment_violation/);
});

test('9: the same recipe revision cannot occupy two component roles', async () => {
  const sharedRevision = uuid(800);
  const main = candidate({ role: 'MAIN_COMPONENT', required: [['CARB_SIDE']], recipeRevisionId: sharedRevision,
    value: nutrition('200.000', '30.000', '8.000', '0.000', '0.000') });
  const side = candidate({ role: 'CARB_SIDE', recipeRevisionId: sharedRevision,
    value: nutrition('150.000', '4.000', '1.000', '30.000', '3.000') });
  const result = await composeAdaptiveMealV1(input([main, side], [['MAIN_COMPONENT', 'CARB_SIDE']], high));
  assert.equal(result.status, 'INCOMPLETE');
});

test('10: reviewed incompatible pairing tags fail closed', async () => {
  const main = candidate({ role: 'MAIN_COMPONENT', required: [['SALAD']], incompatiblePairingTags: ['cold_only'],
    value: nutrition('200.000', '30.000', '8.000', '0.000', '0.000') });
  const salad = candidate({ role: 'SALAD', pairingTags: ['cold_only'],
    value: nutrition('100.000', '3.000', '5.000', '10.000', '5.000') });
  const result = await composeAdaptiveMealV1(input([main, salad], [['MAIN_COMPONENT', 'SALAD']], high));
  assert.equal(result.status, 'INCOMPLETE');
});

test('11: a carb-heavy day selects the reviewed vegetable-side composition', async () => {
  const main = candidate({ role: 'MAIN_COMPONENT', required: [['CARB_SIDE', 'VEGETABLE_SIDE']],
    value: nutrition('200.000', '30.000', '8.000', '0.000', '0.000') });
  const carb = candidate({ role: 'CARB_SIDE', value: nutrition('180.000', '4.000', '1.000', '40.000', '2.000') });
  const vegetables = candidate({ role: 'VEGETABLE_SIDE', value: nutrition('80.000', '3.000', '2.000', '10.000', '6.000') });
  const target = nutrition('280.000', '33.000', '10.000', '10.000', '6.000');
  const meal = await completeResult(input([main, carb, vegetables], [['MAIN_COMPONENT', 'CARB_SIDE'],
    ['MAIN_COMPONENT', 'VEGETABLE_SIDE']], target, {
    currentDayNutrition: nutrition('1000.000', '60.000', '30.000', '190.000', '18.000'),
    dayTarget: nutrition('1280.000', '93.000', '40.000', '200.000', '24.000'),
  }));
  assert.deepEqual(meal.components.map((item) => item.eligibility.role), ['MAIN_COMPONENT', 'VEGETABLE_SIDE']);
});

test('12: mass-gain target can select a reviewed energy-dense EXTRA', async () => {
  const full = candidate({ role: 'MAIN_COMPONENT', value: nutrition('500.000', '30.000', '15.000', '60.000', '8.000') });
  const extra = candidate({ role: 'EXTRA', energyClass: 'ENERGY_DENSE',
    value: nutrition('250.000', '8.000', '18.000', '16.000', '3.000') });
  const target = nutrition('750.000', '38.000', '33.000', '76.000', '11.000');
  const meal = await completeResult(input([full, extra], [['MAIN_COMPONENT'], ['MAIN_COMPONENT', 'EXTRA']], target,
    { goalProfile: 'MASS_GAIN' }));
  assert.deepEqual(meal.components.map((item) => item.eligibility.role), ['MAIN_COMPONENT', 'EXTRA']);
});

test('13: weight-loss profile does not blindly remove a carb side needed by nutrition targets', async () => {
  const main = candidate({ role: 'MAIN_COMPONENT', required: [['CARB_SIDE', 'VEGETABLE_SIDE']],
    value: nutrition('200.000', '30.000', '8.000', '0.000', '0.000') });
  const carb = candidate({ role: 'CARB_SIDE', value: nutrition('150.000', '4.000', '1.000', '30.000', '4.000') });
  const vegetables = candidate({ role: 'VEGETABLE_SIDE', energyClass: 'LIGHTER',
    value: nutrition('60.000', '3.000', '1.000', '8.000', '5.000') });
  const target = nutrition('350.000', '34.000', '9.000', '30.000', '4.000');
  const meal = await completeResult(input([main, carb, vegetables], [['MAIN_COMPONENT', 'CARB_SIDE'],
    ['MAIN_COMPONENT', 'VEGETABLE_SIDE']], target, { goalProfile: 'WEIGHT_LOSS' }));
  assert.deepEqual(meal.components.map((item) => item.eligibility.role), ['MAIN_COMPONENT', 'CARB_SIDE']);
});

test('14: immutable historical meal remains valid after a future recipe revision exists', async () => {
  const original = candidate({ role: 'MAIN_COMPONENT', value: nutrition('420.000', '24.000', '12.000', '50.000', '8.000') });
  const meal = await completeResult(input([original], [['MAIN_COMPONENT']], original.nutrition));
  const historicalRevision = meal.components[0].recipeRevision;
  const future = structuredClone(original);
  future.recipe.recipeRevisionId = uuid(999);
  future.recipeRevision = uuid(999);
  future.eligibility.recipeRevisionId = uuid(999);
  assert.equal((await decodeMealSnapshotV1(meal)).components[0].recipeRevision, historicalRevision);
  assert.notEqual(future.recipeRevision, historicalRevision);
});

test('canonical meal digest is deterministic and protects the historical payload', async () => {
  const full = candidate({ role: 'MAIN_COMPONENT', value: nutrition('420.000', '24.000', '12.000', '50.000', '8.000') });
  const first = await completeResult(input([full], [['MAIN_COMPONENT']], full.nutrition));
  const second = await completeResult(input([full], [['MAIN_COMPONENT']], full.nutrition));
  assert.equal(first.digest, second.digest);
  const changed = structuredClone(first);
  changed.nutrition.calories = '421.000';
  await assert.rejects(() => decodeMealSnapshotV1(changed), /nutrition_mismatch|digest_mismatch/);
});

test('goal profile is a tie-breaker while exact nutrition constraints remain primary', async () => {
  const light = candidate({ role: 'MAIN_COMPONENT', energyClass: 'LIGHTER',
    value: nutrition('400.000', '25.000', '12.000', '45.000', '8.000') });
  const dense = candidate({ role: 'MAIN_COMPONENT', energyClass: 'ENERGY_DENSE',
    value: nutrition('400.000', '25.000', '12.000', '45.000', '8.000') });
  for (const [goal, expected] of [['WEIGHT_LOSS', light], ['MASS_GAIN', dense]] as Array<[MealGoalProfileV1,
    MealComponentCandidateV1]>) {
    const meal = await completeResult(input([light, dense], [['MAIN_COMPONENT']], light.nutrition,
      { goalProfile: goal }));
    assert.equal(meal.components[0].mealComponentId, expected.mealComponentId);
  }
});
