import { parseRecipeText } from '../utils/recipeParser';
import { foodService } from './foodService';
import { CalculatedIngredient } from '../utils/nutritionCalculator';
import { normalizeFoodText } from '../utils/foodNormalizer';

const isValidUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const unique = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeFoodText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getIngredientSearchQueries = (name: string): string[] => {
  const normalized = name.trim().toLowerCase();
  const variants = [normalized];

  if (normalized.endsWith('ицы')) {
    variants.push(normalized.replace(/ицы$/i, 'ица'));
  }
  if (normalized.endsWith('ы')) {
    variants.push(normalized.replace(/ы$/i, 'а'));
  }
  if (normalized.endsWith('а')) {
    variants.push(normalized.replace(/а$/i, ''));
  }
  if (/^луковиц[аы]$/i.test(normalized)) {
    variants.push('лук');
  }

  return unique(variants);
};

const resolveIngredientFood = async (name: string) => {
  const candidates: any[] = [];

  for (const query of getIngredientSearchQueries(name)) {
    const found = await foodService.search(query, { limit: 5 });
    candidates.push(...found);

    const exact = found.find((food) => {
      const queryKey = normalizeFoodText(query);
      const names = [
        food.name,
        food.name_original,
        food.normalized_name,
        ...(food.aliases ?? []),
      ]
        .filter(Boolean)
        .map((value) => normalizeFoodText(String(value)));

      return names.includes(queryKey);
    });

    if (exact) {
      return { product: exact, candidates };
    }
  }

  return { product: candidates[0] ?? null, candidates };
};

export async function analyzeRecipeTextReal(text: string): Promise<CalculatedIngredient[]> {
  const parsed = parseRecipeText(text);
  const results: CalculatedIngredient[] = [];

  for (const p of parsed) {
    if (p.unitConversionWarning || p.amountGrams <= 0) {
      results.push({
        ...p,
        proteins: 0,
        fats: 0,
        carbs: 0,
        calories: 0,
        canonical_food_id: null,
        resolution_status: 'unresolved',
        resolution_reason: 'unit_conversion_missing',
        warning: p.unitConversionWarning ?? 'Не удалось определить количество в граммах.',
      });
      continue;
    }

    const { product: prod, candidates } = await resolveIngredientFood(p.name);
    const candidateNames = unique(candidates.map((food) => food.name).filter(Boolean)).slice(0, 3);

    if (!prod) {
      results.push({
        ...p,
        proteins: 0,
        fats: 0,
        carbs: 0,
        calories: 0,
        canonical_food_id: null,
        resolution_status: 'unresolved',
        resolution_reason: 'catalog_unmatched',
        candidate_food_names: candidateNames,
        warning: 'Ингредиент не найден в каталоге.',
      });
      continue;
    }

    const canonicalFoodId =
      (isValidUUID((prod as any).canonical_food_id) ? (prod as any).canonical_food_id : null) ||
      (isValidUUID((prod as any).id) ? (prod as any).id : null);

    if (!canonicalFoodId) {
      results.push({
        ...p,
        proteins: 0,
        fats: 0,
        carbs: 0,
        calories: 0,
        canonical_food_id: null,
        resolution_status: 'unresolved',
        resolution_reason: 'catalog_unmatched',
        candidate_food_names: candidateNames,
        warning: 'Найден кандидат, но он не связан с Food Core UUID.',
      });
      continue;
    }

    const k = p.amountGrams / 100;
    results.push({
      ...p,
      proteins: prod.protein * k,
      fats: prod.fat * k,
      carbs: prod.carbs * k,
      calories: prod.calories * k,
      canonical_food_id: canonicalFoodId,
      resolution_status: 'resolved',
      resolution_reason: 'catalog_match',
      resolved_food_name: prod.name,
    });
  }

  return results;
}
