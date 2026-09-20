import type { PremiumRecipe } from '../services/premiumCatalogService';
import type { CuratedRecipeEligibility, CuratedRecipeTag, MealType } from '../types/adaptiveNutrition';

export const PREMIUM_NUTRITION_FILTERS: ReadonlyArray<{ tag: CuratedRecipeTag; label: string }> = [
  { tag: 'cut', label: 'Сушка' }, { tag: 'bulk', label: 'Набор' },
  { tag: 'vegan', label: 'Веган' }, { tag: 'high_protein', label: 'Белковое' },
  { tag: 'high_carb', label: 'Углеводное' }, { tag: 'keto', label: 'Кето' },
];

/** Compatibility for the unpersisted first-stage tag spelling, never name inference. */
export function normalizeCuratedRecipeTag(value: string): CuratedRecipeTag | null {
  const aliases: Record<string, CuratedRecipeTag> = { gain: 'bulk', 'high-protein': 'high_protein', 'higher-carb': 'high_carb' };
  const tags: CuratedRecipeTag[] = ['cut', 'bulk', 'vegan', 'high_protein', 'high_carb', 'keto',
    'lower-carb', 'lower-fat', 'high-volume', 'energy-dense', 'pre-workout', 'post-workout'];
  return Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] :
    (tags.includes(value as CuratedRecipeTag) ? value as CuratedRecipeTag : null);
}

/** Metadata must be reviewed; titles/macros alone never imply dietary eligibility. */
export function filterCuratedRecipes(recipes: PremiumRecipe[], eligibility: CuratedRecipeEligibility[], filter: {
  purpose: 'collection' | 'plan'; tags?: CuratedRecipeTag[]; mealType?: MealType;
}): PremiumRecipe[] {
  const metadata = new Map<string, CuratedRecipeEligibility[]>();
  for (const entry of eligibility) metadata.set(entry.recipeId, [...(metadata.get(entry.recipeId) ?? []), entry]);
  const counts = new Map<string, number>();
  for (const recipe of recipes) counts.set(recipe.id, (counts.get(recipe.id) ?? 0) + 1);
  return recipes.filter((recipe) => {
    const entries = metadata.get(recipe.id);
    if (!recipe.isActive || counts.get(recipe.id) !== 1 || entries?.length !== 1) return false;
    const entry = entries[0];
    if (entry.origin !== 'potok-curated' || entry.review !== 'approved') return false;
    if (filter.purpose === 'collection' ? !entry.collectionVisible : !entry.planEligible) return false;
    return (!filter.mealType || entry.mealTypes.includes(filter.mealType)) &&
      (filter.tags ?? []).every((tag) => entry.tags.includes(tag));
  });
}
