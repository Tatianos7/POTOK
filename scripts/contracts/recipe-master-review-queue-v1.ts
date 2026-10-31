type Row = Record<string, unknown>;
const nonblank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Offline authoring triage only. Equal names never authorize a shared food binding. */
export function buildRecipeIngredientReviewQueueV1(ingredients: Row[]) {
  const seen = new Set<string>();
  const groups = new Map<string, {
    grouping: 'EXACT_AUTHORING_NAME_ONLY' | 'UNNAMED_SOURCE_ROW';
    name: string | null;
    rows: { inputRowIndex: number; ingredientRowId: string; recipeId: string;
      recordedWeightG: unknown; canonicalStatus: unknown; recordedStableFoodId: unknown; issues: string[] }[];
  }>();
  ingredients.forEach((row, inputRowIndex) => {
    if (!nonblank(row.ingredient_row_id) || !nonblank(row.recipe_id)) throw new Error('INVALID_REVIEW_QUEUE_ROW_ID');
    if (seen.has(row.ingredient_row_id)) throw new Error('DUPLICATE_REVIEW_QUEUE_ROW_ID');
    seen.add(row.ingredient_row_id);
    const issues: string[] = [];
    if (!nonblank(row.ingredient_name_ru)) issues.push('INGREDIENT_NAME_MISSING');
    if (!positive(row.weight_g)) issues.push('INGREDIENT_GRAMS_NEED_REVIEW');
    if (row.canonical_status !== 'RESOLVED') issues.push('CANONICAL_BINDING_NEEDS_REVIEW');
    if (!nonblank(row.food_stable_id)) issues.push('STABLE_FOOD_ID_MISSING');
    if (!issues.length) return;
    // Do not normalize, fuzzy-match, combine quantities, or infer food state/brand.
    // Prefixes keep an unnamed row separate even from a matching literal name.
    const named = nonblank(row.ingredient_name_ru);
    const key = named ? `name:${row.ingredient_name_ru}` : `row:${inputRowIndex}`;
    let group = groups.get(key);
    if (!group) {
      group = { grouping: named ? 'EXACT_AUTHORING_NAME_ONLY' : 'UNNAMED_SOURCE_ROW',
        name: named ? row.ingredient_name_ru as string : null, rows: [] };
      groups.set(key, group);
    }
    group.rows.push({ inputRowIndex, ingredientRowId: row.ingredient_row_id, recipeId: row.recipe_id,
      recordedWeightG: row.weight_g ?? null, canonicalStatus: row.canonical_status ?? null,
      recordedStableFoodId: row.food_stable_id ?? null, issues });
  });
  const entries = [...groups.values()].map(group => {
    const recipeIds = [...new Set(group.rows.map(row => row.recipeId))].sort(compare);
    return { ...group, affectedRecipeCount: recipeIds.length, ingredientRowCount: group.rows.length, recipeIds };
  }).sort((a, b) => b.affectedRecipeCount - a.affectedRecipeCount || b.ingredientRowCount - a.ingredientRowCount ||
    compare(a.name ?? '', b.name ?? '') || a.rows[0].inputRowIndex - b.rows[0].inputRowIndex);
  return { contract: 'potok-recipe-ingredient-review-queue-v1', observationsOnly: true,
    groupingDoesNotEstablishIdentity: true, runtimePublishable: false,
    // Counts express potential review reach, never a promise of recipe readiness.
    blockedIngredientRows: entries.reduce((sum, entry) => sum + entry.ingredientRowCount, 0), entries };
}
