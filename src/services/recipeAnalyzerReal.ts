import { parseIngredients } from '../utils/ingredientParser';
import { foodService } from './foodService';
import { CalculatedIngredient } from '../utils/nutritionCalculator';

// Заготовка под реальную базу (Росстат/Скурихин/EAN)
// Сейчас просто возвращает пустые макросы, но структура готова
export async function analyzeRecipeTextReal(text: string): Promise<CalculatedIngredient[]> {
  const parsed = parseIngredients(text);
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
    });
  }

  return results;
}

