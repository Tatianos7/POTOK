import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import XLSX from 'xlsx';
import {
  auditCuratedRecipePublicationV1,
  compileCuratedRecipePublicationV1,
  curatedRecipePublicationContractV1,
  type CuratedRecipeAuthoringV1,
} from '../../src/utils/curatedRecipePublicationV1';
import type { RecipeCandidate } from '../recipes/validateRecipeCandidates';

const recipesPath = new URL('../../data/recipes/recipe-candidates-v1.json', import.meta.url);
const workbookPath = new URL('../../data/food-core/Food_Core_v02_with_aliases.xlsx', import.meta.url);
const sourcePackagePath = new URL('../../docs/premium/retained-sources/p5-03/source-review-package-v1.json', import.meta.url);

type SourceFood = Record<string, string>;

type SourceReviewProduct = {
  stableFoodId: string;
  proposedIdentity: Record<string, string | null>;
  proposedNutritionPer100GEdible: Record<string, string | null>;
  source: { retainedPath: string; retainedByteLength: number; retainedBytesSha256: string;
    upstreamDocumentSha256: string | null };
  fieldMappings: Record<string, string | null>;
};

function contribution(food: SourceFood, grams: number) {
  const scaled = (field: string) => (Number(food[field]) * grams / 100).toFixed(3);
  return {
    calories: scaled('calories_100g'), protein: scaled('protein_100g'), fat: scaled('fat_100g'),
    carbs: scaled('carbs_100g'), fiber: null, basis: 'full_recipe' as const,
    authority: 'reference_only' as const, evidenceRef: null, evidenceDigest: null,
  };
}

test('P5-03 source-review package pins exactly two retained excerpts without fabricating issuance', async () => {
  const packageBytes = await readFile(sourcePackagePath);
  const sourcePackage = JSON.parse(packageBytes.toString('utf8')) as {
    contract: string; status: string; retrievedDate: string; products: SourceReviewProduct[];
  };
  assert.equal(sourcePackage.contract, 'potok-p5-03-source-review-package-v1');
  assert.equal(sourcePackage.status, 'PENDING_REVIEW');
  assert.equal(sourcePackage.retrievedDate, '2026-10-13');
  assert.deepEqual(sourcePackage.products.map(({ stableFoodId }) => stableFoodId),
    ['apple', 'cottage_cheese_5_percent']);

  for (const product of sourcePackage.products) {
    const retained = await readFile(new URL(`../../${product.source.retainedPath}`, import.meta.url));
    assert.equal(retained.byteLength, product.source.retainedByteLength);
    assert.equal(createHash('sha256').update(retained).digest('hex'), product.source.retainedBytesSha256);
    assert.equal(product.source.upstreamDocumentSha256, null);
  }

  const apple = sourcePackage.products[0];
  assert.deepEqual(apple.proposedIdentity, {
    name: 'Яблоко', sourceIdentity: 'Apples, raw, with skin', scientificName: 'Malus domestica',
    foodState: 'raw', ediblePart: 'with skin; core and stem excluded', sourceRefusePercent: '10',
  });
  assert.deepEqual(apple.proposedNutritionPer100GEdible, {
    caloriesKcal: '52', proteinG: '0.26', fatG: '0.17', carbsG: '13.81', fiberG: '2.4',
  });
  assert.match(apple.fieldMappings.ediblePart ?? '', /edible portion/);

  const cottage = sourcePackage.products[1];
  assert.equal(cottage.proposedIdentity.fatMassFractionPercent, '5.0');
  assert.equal(cottage.proposedIdentity.foodState, 'as-sold');
  assert.equal(cottage.proposedIdentity.ediblePart, null);
  assert.deepEqual(cottage.proposedNutritionPer100GEdible, {
    caloriesKcal: '121', proteinG: '16.0', fatG: '5.0', carbsG: '3.0', fiberG: null,
  });
  assert.equal(cottage.fieldMappings.fiberG, null);
  assert.equal(cottage.fieldMappings.ediblePart, null);

  const raw = packageBytes.toString('utf8');
  for (const serverOwnedField of ['revisionId', 'reviewEventId', 'eventId', 'occurredAt',
    'authorityReference', 'sourceArtifactId', 'idempotencyReference']) {
    assert.equal(raw.includes(`"${serverOwnedField}"`), false, serverOwnedField);
  }
});

test('P5-03 pilot remains bound to the real candidate and fails closed on missing reviewed evidence', async () => {
  const [recipesBytes, workbookBytes] = await Promise.all([
    readFile(recipesPath), readFile(workbookPath),
  ]);
  assert.equal(createHash('sha256').update(recipesBytes).digest('hex'),
    '9045469af6af882d10c42ad8bb6dbb3fc8efb24e83f2aa833626ea8211d2d96c');
  assert.equal(createHash('sha256').update(workbookBytes).digest('hex'),
    'd6f271958c41582f5e1c97d64befa4af28307379d364a20bdd99b228ba2f66a8');

  const recipes = JSON.parse(recipesBytes.toString('utf8')) as RecipeCandidate[];
  const recipe = recipes.find((item) => item.stable_recipe_id === 'cottage_cheese_with_apple');
  assert.ok(recipe);
  assert.equal(recipe.title, 'Творог с яблоком');
  assert.equal(recipe.servings, 1);
  assert.deepEqual(recipe.ingredients, [
    { stable_food_id: 'cottage_cheese_5_percent', amount_g: 150 },
    { stable_food_id: 'apple', amount_g: 100 },
  ]);

  const workbook = XLSX.read(workbookBytes, { type: 'buffer', cellDates: false });
  const foods = XLSX.utils.sheet_to_json<SourceFood>(workbook.Sheets.foods_import, { defval: '', raw: false });
  const cottage = foods.find((food) => food.id === 'cottage_cheese_5_percent');
  const apple = foods.find((food) => food.id === 'apple');
  assert.ok(cottage && apple);
  assert.deepEqual(
    [cottage, apple].map(({ id, canonical_food_id, calories_100g, protein_100g, fat_100g, carbs_100g, fiber_100g }) =>
      ({ id, canonical_food_id, calories_100g, protein_100g, fat_100g, carbs_100g, fiber_100g })),
    [
      { id: 'cottage_cheese_5_percent', canonical_food_id: 'cottage_cheese_5_percent',
        calories_100g: '121', protein_100g: '17.2', fat_100g: '5.0', carbs_100g: '1.8', fiber_100g: '' },
      { id: 'apple', canonical_food_id: 'apple', calories_100g: '47', protein_100g: '0.4',
        fat_100g: '0.4', carbs_100g: '9.8', fiber_100g: '' },
    ],
  );

  const authoring: CuratedRecipeAuthoringV1 = {
    contract: curatedRecipePublicationContractV1,
    authoringRecipeId: recipe.stable_recipe_id,
    nameRu: recipe.title,
    nameEn: null,
    description: recipe.description,
    status: 'NEEDS_REVIEW',
    baseYield: { servings: '1.000', servingLabel: 'порция', totalWeightG: null, servingWeightG: null },
    nutrition: {
      calories: '228.500', protein: '26.200', fat: '7.900', carbs: '12.500', fiber: null,
      basis: 'full_recipe', authority: 'reference_only', evidenceRef: null, evidenceDigest: null,
    },
    ingredients: [
      { ingredientRowId: 'cottage_cheese_5_percent', sortOrder: 0, nameRu: 'Творог 5%', nameEn: null,
        amount: '150.000', unit: 'g', weightG: '150.000', optional: false, preparationNote: null,
        state: 'unknown', componentKind: 'food', foodStableId: cottage.id, canonicalStatus: 'UNRESOLVED',
        canonical: null, approvedNonFoodEvidenceRef: null, normalizationEvidenceRef: null,
        nutrition: contribution(cottage, 150), scalingMode: null, discreteIncrement: null },
      { ingredientRowId: 'apple', sortOrder: 1, nameRu: 'Яблоко', nameEn: null,
        amount: '100.000', unit: 'g', weightG: '100.000', optional: false, preparationNote: 'без сердцевины',
        state: 'fresh', componentKind: 'food', foodStableId: apple.id, canonicalStatus: 'UNRESOLVED',
        canonical: null, approvedNonFoodEvidenceRef: null, normalizationEvidenceRef: null,
        nutrition: contribution(apple, 100), scalingMode: null, discreteIncrement: null },
    ],
    steps: recipe.steps.map((instruction, index) => ({ stepRowId: `candidate_step_${index + 1}`,
      stepOrder: index + 1, instruction, durationMinutes: null, temperatureCelsius: null })),
    tags: recipe.tags.map((value) => ({ value, reviewStatus: 'needs_review' as const })),
    eligibility: { collectionVisible: false, planEligible: true, allowedMealTypes: ['snack'] },
    safety: { allergenReview: 'blocked', allergenEvidenceRef: null,
      dietaryReview: 'blocked', dietaryEvidenceRef: null },
    source: { workbookRevision: null, recipeEvidenceRef: null },
  };

  const readiness = auditCuratedRecipePublicationV1(authoring);
  const codes = new Set(readiness.blockers.map((blocker) => blocker.code));
  assert.equal(readiness.status, 'BLOCKED');
  for (const code of ['RECIPE_STATUS_NOT_REVIEWED', 'FIBER_MISSING', 'CANONICAL_UNRESOLVED',
    'CANONICAL_FOOD_ID_MISSING', 'CANONICAL_EVIDENCE_MISSING', 'PORTION_POLICY_MISSING',
    'ALLERGEN_CONTRACT_BLOCKED', 'DIETARY_CONTRACT_BLOCKED', 'SOURCE_CONFLICT']) {
    assert.ok(codes.has(code as never), code);
  }

  const compiled = compileCuratedRecipePublicationV1(authoring, {
    recipeId: '', recipeRevisionId: '', portionRevisionId: '', eligibilityRevisionId: '',
    assignedServingsIncrement: '', components: {},
  });
  assert.equal(compiled.readiness.status, 'BLOCKED');
  assert.equal(compiled.recipeRevision, null);
  assert.equal(compiled.portionRevision, null);
  assert.equal(compiled.eligibilityRevision, null);
  assert.equal(compiled.manifestTuple, null);
});
