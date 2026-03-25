import { parseRecipeText } from '../utils/recipeParser';
import { foodService } from './foodService';
import { CalculatedIngredient } from '../utils/nutritionCalculator';

const isValidUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Заготовка под реальную базу (Росстат/Скурихин/EAN)
// Сейчас просто возвращает пустые макросы, но структура готова
export async function analyzeRecipeTextReal(text: string): Promise<CalculatedIngredient[]> {
  const parsed = parseRecipeText(text);
  const results: CalculatedIngredient[] = [];

  for (const p of parsed) {
    // TODO: заменить на публичный метод поиска по имени, когда появится
    const found =
      (foodService as any).searchLocal?.(p.name) ||
      (await foodService.search(p.name)) ||
      [];
    const prod = Array.isArray(found) ? found[0] : found;
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
      });
      continue;
    }
    const k = p.amountGrams / 100;
    const canonicalFoodId =
      (isValidUUID((prod as any).canonical_food_id) ? (prod as any).canonical_food_id : null) ||
      (isValidUUID((prod as any).id) ? (prod as any).id : null);
    results.push({
      ...p,
      proteins: prod.protein * k,
      fats: prod.fat * k,
      carbs: prod.carbs * k,
      calories: prod.calories * k,
      canonical_food_id: canonicalFoodId,
      resolution_status: canonicalFoodId ? 'resolved' : 'unresolved',
      resolution_reason: canonicalFoodId ? 'catalog_match' : 'catalog_unmatched',
    });
  }

  return results;
}
