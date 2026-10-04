import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptiveNutritionGraphSha256HexV1,
  decodeAdaptiveNutritionGraphV1,
  decodeGraphRecipeSnapshotV1,
  encodeAdaptiveNutritionGraphCanonicalV1,
  formatGraphDecimalForPresentationV1,
  scalePremiumRecipeCollectionV1,
  type AdaptiveNutritionGraphV1,
  type GraphComponentV1,
  type GraphNutritionV1,
  type GraphRecipeSnapshotV1,
} from '../adaptiveNutritionGraphV1';

const ids = {
  selection: '10000000-0000-4000-8000-000000000001',
  plan: '10000000-0000-4000-8000-000000000002',
  goal: '10000000-0000-4000-8000-000000000003',
  content: '10000000-0000-4000-8000-000000000004',
  recipe: '20000000-0000-4000-8000-000000000001',
  recipeRevision: '20000000-0000-4000-8000-000000000002',
  portionRevision: '20000000-0000-4000-8000-000000000003',
  chickenComponent: '30000000-0000-4000-8000-000000000001',
  riceComponent: '30000000-0000-4000-8000-000000000002',
  chickenFood: '40000000-0000-4000-8000-000000000001',
  riceFood: '40000000-0000-4000-8000-000000000002',
  evidence: '50000000-0000-4000-8000-000000000001',
};

const nutrition = (calories: string, protein: string, fat: string, carbs: string, fiber: string): GraphNutritionV1 =>
  ({ calories, protein, fat, carbs, fiber });

function component(params: {
  componentId: string;
  foodId: string;
  name: string;
  amount: string;
  nutrition: GraphNutritionV1;
  sortOrder: number;
}): GraphComponentV1 {
  return {
    componentId: params.componentId,
    recipeRevisionId: ids.recipeRevision,
    identity: { kind: 'canonical_food', canonicalFoodId: params.foodId },
    displayNameSnapshot: params.name,
    state: 'as-sold',
    quantity: { amount: params.amount, unit: 'g' },
    normalizedGrams: params.amount,
    normalizationEvidenceRef: null,
    scaling: { mode: 'continuous' },
    nutrition: params.nutrition,
    sortOrder: params.sortOrder,
  };
}

function baseRecipe(): GraphRecipeSnapshotV1 {
  return {
    recipeId: ids.recipe,
    recipeRevisionId: ids.recipeRevision,
    displayNameSnapshot: 'Курица с рисом',
    baseYield: { servings: '4.000', servingLabel: 'порция', totalYieldGrams: '600.000' },
    fullRecipeNutrition: nutrition('800.000', '80.000', '16.000', '80.000', '8.000'),
    ingredients: [
      component({ componentId: ids.chickenComponent, foodId: ids.chickenFood, name: 'Курица',
        amount: '400.000', nutrition: nutrition('400.000', '80.000', '16.000', '0.000', '0.000'), sortOrder: 0 }),
      component({ componentId: ids.riceComponent, foodId: ids.riceFood, name: 'Рис',
        amount: '200.000', nutrition: nutrition('400.000', '0.000', '0.000', '80.000', '8.000'), sortOrder: 1 }),
    ],
  };
}

function slot(dayIndex: number, slotIndex: number, assignedServings = '1.000') {
  const recipe = baseRecipe();
  const preview = scalePremiumRecipeCollectionV1(recipe, assignedServings);
  const suffix = String(dayIndex * 2 + slotIndex + 1).padStart(12, '0');
  return {
    slotId: `60000000-0000-4000-8000-${suffix}`,
    mealType: slotIndex === 0 ? 'lunch' as const : 'dinner' as const,
    sortOrder: slotIndex,
    displayLabel: null,
    plannedLocalTime: slotIndex === 0 ? '13:00' : '19:00',
    snapshot: {
      snapshotRevision: `70000000-0000-4000-8000-${suffix}`,
      recipeRevision: ids.recipeRevision,
      portionRevision: ids.portionRevision,
      recipe,
      assignedPortion: {
        source: 'potok_generator' as const,
        portionRevisionId: ids.portionRevision,
        assignedServings,
        servingMultiplier: assignedServings === '1.000' ? '0.250' : '0.500',
        assignedGrams: assignedServings === '1.000' ? '150.000' : '300.000',
      },
      ingredients: preview.ingredients,
      nutrition: preview.nutrition,
    },
  };
}

function validGraph(): AdaptiveNutritionGraphV1 {
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
    '2026-09-25', '2026-09-26', '2026-09-27'];
  return {
    contract_version: 1,
    selection_id: ids.selection,
    plan_revision: ids.plan,
    goal_revision: ids.goal,
    week_anchor: dates[0],
    timezone: 'Europe/Moscow',
    generated_at: '2026-09-20T12:00:00.000Z',
    generation: { generatorVersion: 'graph-builder-v1', contentRevision: ids.content },
    days: dates.map((date, dayIndex) => ({
      date,
      dayIndex,
      targetSnapshot: nutrition('2000.000', '120.000', '70.000', '230.000', '30.000'),
      slots: dayIndex === 0 ? [slot(dayIndex, 0), slot(dayIndex, 1, '2.000')] : [slot(dayIndex, 0)],
    })),
  };
}

function graphWithDiscretePiece(fullRecipePieces: string): AdaptiveNutritionGraphV1 {
  const graph = validGraph();
  const recipe = mutate(baseRecipe(), (draft) => {
    draft.ingredients[0].displayNameSnapshot = 'Яйцо';
    draft.ingredients[0].quantity = { amount: fullRecipePieces, unit: 'piece' };
    draft.ingredients[0].normalizedGrams = '400.000';
    draft.ingredients[0].normalizationEvidenceRef = ids.evidence;
    draft.ingredients[0].scaling = { mode: 'discrete', increment: '1.000' };
  });
  const preview = scalePremiumRecipeCollectionV1(recipe, '1.000');
  graph.days[0].slots[0].snapshot.recipe = recipe;
  graph.days[0].slots[0].snapshot.ingredients = preview.ingredients;
  graph.days[0].slots[0].snapshot.nutrition = preview.nutrition;
  return graph;
}

function mutate<T>(value: T, mutation: (draft: T) => void): T {
  const draft = structuredClone(value);
  mutation(draft);
  return draft;
}

test('accepts an immutable ordered seven-day graph with a multi-slot day', () => {
  const result = decodeAdaptiveNutritionGraphV1(validGraph());
  assert.equal(result.days.length, 7);
  assert.equal(result.days[0].slots.length, 2);
  assert.equal(result.days[0].slots[0].snapshot.assignedPortion.source, 'potok_generator');
});

test('scales collection presentation from four servings to one without changing identity', () => {
  const preview = scalePremiumRecipeCollectionV1(baseRecipe(), '1.000');
  assert.equal(preview.recipeId, ids.recipe);
  assert.equal(preview.recipeRevisionId, ids.recipeRevision);
  assert.equal(preview.scaleFactor, '0.250');
  assert.deepEqual(preview.ingredients.map((item) => item.quantity.amount), ['100.000', '50.000']);
  assert.deepEqual(preview.nutrition, nutrition('200.000', '20.000', '4.000', '20.000', '2.000'));
});

test('scales collection presentation from four servings to two deterministically', () => {
  const preview = scalePremiumRecipeCollectionV1(baseRecipe(), '2.000');
  assert.equal(preview.scaleFactor, '0.500');
  assert.deepEqual(preview.ingredients.map((item) => item.quantity.amount), ['200.000', '100.000']);
  assert.deepEqual(preview.nutrition, nutrition('400.000', '40.000', '8.000', '40.000', '4.000'));
  assert.equal(formatGraphDecimalForPresentationV1('100.050', 1), '100.1');
});

test('canonical bytes and digest are deterministic across object key insertion order', async () => {
  const graph = validGraph();
  const reordered = { days: graph.days, generation: graph.generation, generated_at: graph.generated_at,
    timezone: graph.timezone, week_anchor: graph.week_anchor, goal_revision: graph.goal_revision,
    plan_revision: graph.plan_revision, selection_id: graph.selection_id, contract_version: graph.contract_version };
  assert.deepEqual(encodeAdaptiveNutritionGraphCanonicalV1(graph), encodeAdaptiveNutritionGraphCanonicalV1(reordered));
  assert.equal(await adaptiveNutritionGraphSha256HexV1(graph), await adaptiveNutritionGraphSha256HexV1(reordered));
  assert.match(await adaptiveNutritionGraphSha256HexV1(graph), /^[0-9a-f]{64}$/);
});

test('rejects six and eight day graphs', () => {
  assert.throws(() => decodeAdaptiveNutritionGraphV1(mutate(validGraph(), (graph) => { graph.days.pop(); })),
    /exactly_7_days/);
  assert.throws(() => decodeAdaptiveNutritionGraphV1(mutate(validGraph(), (graph) => {
    graph.days.push(structuredClone(graph.days[6]));
  })), /exactly_7_days/);
});

test('rejects duplicate or non-contiguous dates and non-Monday anchor', () => {
  assert.throws(() => decodeAdaptiveNutritionGraphV1(mutate(validGraph(), (graph) => {
    graph.days[1].date = graph.days[0].date;
  })), /day_sequence_mismatch/);
  assert.throws(() => decodeAdaptiveNutritionGraphV1(mutate(validGraph(), (graph) => {
    graph.week_anchor = '2026-09-22';
  })), /monday/);
});

test('rejects duplicate slots', () => {
  assert.throws(() => decodeAdaptiveNutritionGraphV1(mutate(validGraph(), (graph) => {
    graph.days[1].slots[0].slotId = graph.days[0].slots[0].slotId;
  })), /duplicate_slot_id/);
});

test('rejects missing recipe and portion revision identities', () => {
  const missingRecipe = validGraph() as unknown as Record<string, unknown>;
  const recipe = (((missingRecipe.days as Array<Record<string, unknown>>)[0].slots as Array<Record<string, unknown>>)[0]
    .snapshot as Record<string, unknown>).recipe as Record<string, unknown>;
  delete recipe.recipeRevisionId;
  assert.throws(() => decodeAdaptiveNutritionGraphV1(missingRecipe), /recipe_snapshot_fields/);

  const missingPortion = validGraph() as unknown as Record<string, unknown>;
  const assigned = ((((missingPortion.days as Array<Record<string, unknown>>)[0].slots as Array<Record<string, unknown>>)[0]
    .snapshot as Record<string, unknown>).assignedPortion as Record<string, unknown>);
  delete assigned.portionRevisionId;
  assert.throws(() => decodeAdaptiveNutritionGraphV1(missingPortion), /assigned_portion_fields/);
});

test('rejects invalid base yield and selected collection servings', () => {
  assert.throws(() => decodeGraphRecipeSnapshotV1(mutate(baseRecipe(), (recipe) => {
    recipe.baseYield.servings = '0.000';
  })), /base_yield_servings_value/);
  assert.throws(() => scalePremiumRecipeCollectionV1(baseRecipe(), '0.000'), /selected_servings_value/);
  assert.throws(() => scalePremiumRecipeCollectionV1(baseRecipe(), '-1.000'), /selected_servings_decimal/);
});

test('rejects malformed decimals and invalid assigned portion ratios', () => {
  assert.throws(() => decodeGraphRecipeSnapshotV1(mutate(baseRecipe(), (recipe) => {
    recipe.baseYield.servings = '4e0';
  })), /base_yield_servings_decimal/);
  assert.throws(() => decodeAdaptiveNutritionGraphV1(mutate(validGraph(), (graph) => {
    graph.days[0].slots[0].snapshot.assignedPortion.servingMultiplier = '0.500';
  })), /multiplier_mismatch/);
});

test('rejects negative nutrition and inconsistent totals', () => {
  assert.throws(() => decodeGraphRecipeSnapshotV1(mutate(baseRecipe(), (recipe) => {
    recipe.ingredients[0].nutrition.calories = '-1.000';
  })), /component_nutrition_calories_decimal/);
  assert.throws(() => decodeAdaptiveNutritionGraphV1(mutate(validGraph(), (graph) => {
    graph.days[0].slots[0].snapshot.nutrition.calories = '201.000';
  })), /assigned_nutrition_mismatch/);
});

test('rejects unresolved, ambiguous, and live-only ingredient or recipe references', () => {
  for (const kind of ['unresolved', 'ambiguous']) {
    assert.throws(() => decodeGraphRecipeSnapshotV1(mutate(baseRecipe(), (recipe) => {
      recipe.ingredients[0].identity = { kind } as never;
    })), /unresolved_or_ambiguous/);
  }
  assert.throws(() => decodeGraphRecipeSnapshotV1({ ...baseRecipe(), liveRecipeLookup: true }), /recipe_snapshot_fields/);
  assert.throws(() => decodeGraphRecipeSnapshotV1(mutate(baseRecipe(), (recipe) => {
    recipe.ingredients[0].identity = { kind: 'canonical_food', canonicalFoodId: 'latest-by-name' };
  })), /canonical_food_uuid/);
});

test('rejects malformed UUIDs and unknown contract versions', () => {
  assert.throws(() => decodeAdaptiveNutritionGraphV1({ ...validGraph(), selection_id: 'not-a-uuid' }),
    /selection_uuid/);
  assert.throws(() => decodeAdaptiveNutritionGraphV1({ ...validGraph(), contract_version: 2 }),
    /unsupported_graph_contract_version/);
});

test('rejects user-controlled portion picker state in an Adaptive graph', () => {
  const graph = validGraph() as unknown as Record<string, unknown>;
  const assigned = ((((graph.days as Array<Record<string, unknown>>)[0].slots as Array<Record<string, unknown>>)[0]
    .snapshot as Record<string, unknown>).assignedPortion as Record<string, unknown>);
  assigned.selectedServings = '2.000';
  assert.throws(() => decodeAdaptiveNutritionGraphV1(graph), /assigned_portion_fields/);
});

test('Collection allows exact fractional piece presentation for four-to-one scaling', () => {
  const recipe = mutate(baseRecipe(), (draft) => {
    draft.ingredients[0].displayNameSnapshot = 'Яйцо';
    draft.ingredients[0].quantity = { amount: '1.000', unit: 'piece' };
    draft.ingredients[0].normalizedGrams = '150.000';
    draft.ingredients[0].normalizationEvidenceRef = ids.evidence;
    draft.ingredients[0].scaling = { mode: 'discrete', increment: '1.000' };
  });
  const preview = scalePremiumRecipeCollectionV1(recipe, '1.000');
  assert.equal(preview.recipeId, recipe.recipeId);
  assert.equal(preview.recipeRevisionId, recipe.recipeRevisionId);
  assert.equal(preview.ingredients[0].quantity.amount, '0.250');
  assert.equal(preview.ingredients[0].nutrition.calories, '100.000');
  assert.deepEqual(preview.nutrition, nutrition('200.000', '20.000', '4.000', '20.000', '2.000'));
});

test('Adaptive HYBRID accepts a generator portion that respects the reviewed piece increment', () => {
  const graph = graphWithDiscretePiece('4.000');
  const decoded = decodeAdaptiveNutritionGraphV1(graph);
  assert.equal(decoded.days[0].slots[0].snapshot.ingredients[0].quantity.amount, '1.000');
  assert.deepEqual(decoded.days[0].slots[0].snapshot.recipe.ingredients[0].scaling,
    { mode: 'discrete', increment: '1.000' });
});

test('Adaptive HYBRID rejects a generator portion that violates the reviewed piece increment', () => {
  assert.throws(() => decodeAdaptiveNutritionGraphV1(graphWithDiscretePiece('1.000')),
    /discrete_component_not_divisible/);
});
