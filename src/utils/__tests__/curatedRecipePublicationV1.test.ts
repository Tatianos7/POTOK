import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAdaptiveCatalogManifestV1 } from '../adaptiveNutritionActivationV1';
import {
  decodeAdaptiveNutritionGraphV1,
  scalePremiumRecipeCollectionV1,
  type AdaptiveNutritionGraphV1,
} from '../adaptiveNutritionGraphV1';
import {
  auditCuratedRecipePublicationV1,
  compileCuratedRecipePublicationV1,
  curatedRecipePublicationContractV1,
  type CuratedRecipeAuthoringV1,
  type CuratedRecipePublicationBlockerCodeV1,
  type CuratedRecipePublicationIdentityBoundaryV1,
} from '../curatedRecipePublicationV1';

const ids = {
  recipe: '10000000-0000-4000-8000-000000000001',
  recipeRevision: '10000000-0000-4000-8000-000000000002',
  portionRevision: '10000000-0000-4000-8000-000000000003',
  eligibilityRevision: '10000000-0000-4000-8000-000000000004',
  manifestRevision: '10000000-0000-4000-8000-000000000005',
  oatsComponent: '20000000-0000-4000-8000-000000000001',
  eggComponent: '20000000-0000-4000-8000-000000000002',
  oatsFood: '30000000-0000-4000-8000-000000000001',
  eggFood: '30000000-0000-4000-8000-000000000002',
  eggNormalization: '40000000-0000-4000-8000-000000000001',
  selection: '50000000-0000-4000-8000-000000000001',
  plan: '50000000-0000-4000-8000-000000000002',
  goal: '50000000-0000-4000-8000-000000000003',
  snapshot: '50000000-0000-4000-8000-000000000004',
  slot: '50000000-0000-4000-8000-000000000005',
};

const digest = 'a'.repeat(64);

test('food NOT_APPLICABLE cannot bypass private pointer and missing canonical evidence', () => {
  const authoring = validAuthoring();
  const food = authoring.ingredients[0];
  food.canonicalStatus = 'NOT_APPLICABLE';
  assert.ok(food.canonical);
  food.canonical.source = 'private';
  food.canonical.sharedCatalogAccessible = false;
  food.canonical.evidenceRevision = '';
  food.canonical.evidenceDigest = '';
  const readiness = auditCuratedRecipePublicationV1(authoring);
  assert.notEqual(readiness.status, 'READY_FOR_PUBLICATION');
  for (const code of ['CANONICAL_POINTER_INVALID', 'CANONICAL_FOOD_INACCESSIBLE', 'CANONICAL_EVIDENCE_MISSING']) {
    assert.ok(readiness.blockers.some((blocker) => blocker.code === code));
  }
  const nonFood = validAuthoring();
  nonFood.ingredients[0].componentKind = 'approved_non_food';
  nonFood.ingredients[0].canonicalStatus = 'NOT_APPLICABLE';
  nonFood.ingredients[0].approvedNonFoodEvidenceRef = 'owner-reviewed:non-food';
  assert.ok(!auditCuratedRecipePublicationV1(nonFood).blockers.some((blocker) => blocker.code.startsWith('CANONICAL_')));
});
const nutrition = (calories: string, protein: string, fat: string, carbs: string, fiber: string) => ({
  calories, protein, fat, carbs, fiber,
  basis: 'full_recipe' as const,
  authority: 'reviewed' as const,
  evidenceRef: 'owner-review:nutrition-v1',
  evidenceDigest: digest,
});

function validAuthoring(): CuratedRecipeAuthoringV1 {
  return {
    contract: curatedRecipePublicationContractV1,
    authoringRecipeId: 'synthetic_oats_and_egg_v1',
    nameRu: 'Синтетическая овсянка с яйцом',
    nameEn: 'Synthetic oats and egg',
    description: 'Только синтетический contract fixture.',
    status: 'REVIEWED',
    baseYield: {
      servings: '4.000', servingLabel: 'порция', totalWeightG: '350.000', servingWeightG: '87.500',
    },
    nutrition: nutrition('400.000', '20.000', '10.000', '50.000', '8.000'),
    ingredients: [
      {
        ingredientRowId: 'ingredient_oats', sortOrder: 0, nameRu: 'Овсяные хлопья', nameEn: 'Oats',
        amount: '300.000', unit: 'g', weightG: '300.000', optional: false, preparationNote: null,
        state: 'dry', componentKind: 'food', foodStableId: 'food_oats_reviewed', canonicalStatus: 'RESOLVED',
        canonical: {
          foodStableId: 'food_oats_reviewed', canonicalFoodId: ids.oatsFood, source: 'core',
          sharedCatalogAccessible: true, evidenceRevision: 'food-catalog-v1', evidenceDigest: digest,
        },
        approvedNonFoodEvidenceRef: null, normalizationEvidenceRef: null,
        nutrition: nutrition('300.000', '10.000', '5.000', '50.000', '8.000'),
        scalingMode: 'continuous', discreteIncrement: null,
      },
      {
        ingredientRowId: 'ingredient_egg', sortOrder: 1, nameRu: 'Яйцо', nameEn: 'Egg',
        amount: '1.000', unit: 'piece', weightG: '50.000', optional: false, preparationNote: null,
        state: 'raw', componentKind: 'food', foodStableId: 'food_egg_reviewed', canonicalStatus: 'RESOLVED',
        canonical: {
          foodStableId: 'food_egg_reviewed', canonicalFoodId: ids.eggFood, source: 'core',
          sharedCatalogAccessible: true, evidenceRevision: 'food-catalog-v1', evidenceDigest: digest,
        },
        approvedNonFoodEvidenceRef: null, normalizationEvidenceRef: 'owner-review:egg-weight-v1',
        nutrition: nutrition('100.000', '10.000', '5.000', '0.000', '0.000'),
        scalingMode: 'discrete', discreteIncrement: '0.500',
      },
    ],
    steps: [
      { stepRowId: 'step_1', stepOrder: 1, instruction: 'Смешайте ингредиенты.', durationMinutes: 2,
        temperatureCelsius: null },
      { stepRowId: 'step_2', stepOrder: 2, instruction: 'Приготовьте до готовности.', durationMinutes: 8,
        temperatureCelsius: 180 },
    ],
    tags: [{ value: 'high_protein', reviewStatus: 'approved' }],
    eligibility: { collectionVisible: true, planEligible: true, allowedMealTypes: ['breakfast'] },
    safety: {
      allergenReview: 'reviewed', allergenEvidenceRef: 'owner-review:allergens-v1',
      dietaryReview: 'reviewed', dietaryEvidenceRef: 'owner-review:dietary-v1',
    },
    source: { workbookRevision: 'synthetic-workbook-v1', recipeEvidenceRef: 'synthetic-fixture-only' },
  };
}

function identities(): CuratedRecipePublicationIdentityBoundaryV1 {
  return {
    recipeId: ids.recipe,
    recipeRevisionId: ids.recipeRevision,
    portionRevisionId: ids.portionRevision,
    eligibilityRevisionId: ids.eligibilityRevision,
    assignedServingsIncrement: '0.500',
    components: {
      ingredient_oats: {
        componentId: ids.oatsComponent, normalizationEvidenceId: null, approvedNonFoodDefinitionId: null,
      },
      ingredient_egg: {
        componentId: ids.eggComponent, normalizationEvidenceId: ids.eggNormalization,
        approvedNonFoodDefinitionId: null,
      },
    },
  };
}

function codes(authoring: CuratedRecipeAuthoringV1): CuratedRecipePublicationBlockerCodeV1[] {
  return auditCuratedRecipePublicationV1(authoring).blockers.map((blocker) => blocker.code);
}

test('complete authoring compiles immutable recipe, HYBRID portion, eligibility and manifest tuple', () => {
  const result = compileCuratedRecipePublicationV1(validAuthoring(), identities());
  assert.equal(result.readiness.status, 'READY_FOR_PUBLICATION');
  assert.equal(result.recipeRevision?.recipeSnapshot.ingredients[0].scaling.mode, 'continuous');
  assert.deepEqual(result.portionRevision?.componentIncrements,
    [{ componentId: ids.eggComponent, increment: '0.500' }]);
  assert.equal(result.eligibilityRevision?.planEligible, true);
  assert.deepEqual(decodeAdaptiveCatalogManifestV1({
    contract: 'potok-adaptive-catalog-manifest-v1',
    manifestRevision: ids.manifestRevision,
    recipes: [result.manifestTuple],
  }).recipes[0], result.manifestTuple);
});

test('Collection exact scaling permits a fractional piece and preserves immutable identities', () => {
  const compiled = compileCuratedRecipePublicationV1(validAuthoring(), identities());
  const preview = scalePremiumRecipeCollectionV1(compiled.recipeRevision!.recipeSnapshot, '1.000');
  const egg = preview.ingredients.find((ingredient) => ingredient.componentId === ids.eggComponent)!;
  assert.equal(egg.quantity.amount, '0.250');
  assert.equal(preview.nutrition.calories, '100.000');
  assert.equal(preview.recipeId, ids.recipe);
  assert.equal(preview.recipeRevisionId, ids.recipeRevision);
});

test('Adaptive assigned portion rejects a piece amount outside the reviewed increment', () => {
  const compiled = compileCuratedRecipePublicationV1(validAuthoring(), identities());
  const recipe = compiled.recipeRevision!.recipeSnapshot;
  const preview = scalePremiumRecipeCollectionV1(recipe, '1.000');
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
    '2026-09-25', '2026-09-26', '2026-09-27'];
  const graph: AdaptiveNutritionGraphV1 = {
    contract_version: 1, selection_id: ids.selection, plan_revision: ids.plan, goal_revision: ids.goal,
    week_anchor: dates[0], timezone: 'Europe/Moscow', generated_at: '2026-09-20T12:00:00.000Z',
    generation: { generatorVersion: 'synthetic-v1', contentRevision: ids.manifestRevision },
    days: dates.map((date, dayIndex) => ({
      date, dayIndex, targetSnapshot: null,
      slots: dayIndex === 0 ? [{
        slotId: ids.slot, mealType: 'breakfast', sortOrder: 0, displayLabel: null, plannedLocalTime: null,
        snapshot: {
          snapshotRevision: ids.snapshot, recipeRevision: ids.recipeRevision,
          portionRevision: ids.portionRevision, recipe,
          assignedPortion: {
            source: 'potok_generator', portionRevisionId: ids.portionRevision,
            assignedServings: '1.000', servingMultiplier: '0.250', assignedGrams: '87.500',
          },
          ingredients: preview.ingredients, nutrition: preview.nutrition,
        },
      }] : [],
    })),
  };
  assert.throws(() => decodeAdaptiveNutritionGraphV1(graph), /discrete_component_not_divisible/);
});

test('unresolved and ambiguous canonical foods fail closed', () => {
  const unresolved = validAuthoring();
  unresolved.ingredients[0].canonicalStatus = 'UNRESOLVED';
  unresolved.ingredients[0].canonical = null;
  assert.ok(codes(unresolved).includes('CANONICAL_UNRESOLVED'));
  const ambiguous = validAuthoring();
  ambiguous.ingredients[0].canonicalStatus = 'AMBIGUOUS';
  ambiguous.ingredients[0].canonical = null;
  assert.ok(codes(ambiguous).includes('CANONICAL_AMBIGUOUS'));
});

test('name-only and private canonical pointers cannot become shared curated content', () => {
  const nameOnly = validAuthoring();
  nameOnly.ingredients[0].canonicalStatus = 'UNRESOLVED';
  nameOnly.ingredients[0].canonical = null;
  assert.ok(codes(nameOnly).includes('CANONICAL_FOOD_ID_MISSING'));
  assert.ok(codes(nameOnly).includes('CANONICAL_EVIDENCE_MISSING'));
  const privateFood = validAuthoring();
  privateFood.ingredients[0].canonical!.source = 'private';
  privateFood.ingredients[0].canonical!.sharedCatalogAccessible = false;
  assert.ok(codes(privateFood).includes('CANONICAL_FOOD_INACCESSIBLE'));
  assert.ok(codes(privateFood).includes('CANONICAL_POINTER_INVALID'));
});

test('missing fiber, bad servings and nutrition mismatch are deterministic blockers', () => {
  const missingFiber = validAuthoring();
  missingFiber.nutrition.fiber = null;
  assert.ok(codes(missingFiber).includes('FIBER_MISSING'));
  const badServings = validAuthoring();
  badServings.baseYield.servings = '0.000';
  assert.ok(codes(badServings).includes('BASE_SERVINGS_INVALID'));
  const mismatch = validAuthoring();
  mismatch.nutrition.calories = '401.000';
  assert.ok(codes(mismatch).includes('NUTRITION_CONTRIBUTION_MISMATCH'));
});

test('duplicate ingredient identity/order and missing discrete increment fail closed', () => {
  const duplicate = validAuthoring();
  duplicate.ingredients[1].ingredientRowId = duplicate.ingredients[0].ingredientRowId;
  duplicate.ingredients[1].sortOrder = 0;
  const duplicateCodes = codes(duplicate);
  assert.ok(duplicateCodes.includes('INGREDIENT_ID_DUPLICATE'));
  assert.ok(duplicateCodes.includes('INGREDIENT_ORDER_INVALID'));
  const noIncrement = validAuthoring();
  noIncrement.ingredients[1].discreteIncrement = null;
  assert.ok(codes(noIncrement).includes('DISCRETE_INCREMENT_MISSING'));
});

test('recipe name cannot be authoring identity and unreviewed tags block publication', () => {
  const nameIdentity = validAuthoring();
  nameIdentity.authoringRecipeId = nameIdentity.nameRu;
  assert.ok(codes(nameIdentity).includes('RECIPE_NAME_IDENTITY_FORBIDDEN'));
  const tag = validAuthoring();
  tag.tags[0].reviewStatus = 'needs_review';
  assert.ok(codes(tag).includes('TAG_NOT_REVIEWED'));
});

test('conflicting total and per-serving yield blocks publication', () => {
  const authoring = validAuthoring();
  authoring.baseYield.servingWeightG = '90.000';
  assert.ok(codes(authoring).includes('YIELD_CONFLICT'));
});

test('compiler does not mint or accept invalid persistent publication identities', () => {
  const invalid = identities();
  invalid.recipeId = 'not-a-uuid';
  const result = compileCuratedRecipePublicationV1(validAuthoring(), invalid);
  assert.equal(result.readiness.status, 'BLOCKED');
  assert.equal(result.recipeRevision, null);
  assert.ok(result.readiness.blockers.some((blocker) => blocker.code === 'PUBLICATION_IDENTITY_INVALID'));
});
