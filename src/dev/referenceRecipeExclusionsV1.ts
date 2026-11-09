/** Exact recipe choices only. Never infer allergens, ingredients or dietary safety. */
export const referenceExclusionScope = 'EXPLICIT_RECIPE_IDS_ONLY_NOT_ALLERGEN_SCREENING';
export function decodeReferenceExcludedIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 28 || value.some(x => typeof x !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,199}$/.test(x))
    || new Set(value).size !== value.length) throw Error('INVALID_REFERENCE_EXCLUSIONS');
  return [...value].sort();
}

export function excludeReferenceRecipes<T extends {recipes: {recipeId: string}[]}>(input: T, ids: string[]): T {
  const excluded = decodeReferenceExcludedIds(ids);
  if (excluded.some(id => !input.recipes.some(r => r.recipeId === id))) throw Error('UNKNOWN_REFERENCE_RECIPE');
  return {...input, recipes: input.recipes.filter(r => !excluded.includes(r.recipeId))};
}
