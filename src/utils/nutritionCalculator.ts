import { ParsedRecipeIngredient } from './recipeParser';

export interface CalculatedIngredient extends ParsedRecipeIngredient {
  proteins: number;
  fats: number;
  carbs: number;
  calories: number;
}

export interface NutritionTotals {
  total: { proteins: number; fats: number; carbs: number; calories: number; weight: number };
  per100: { proteins: number; fats: number; carbs: number; calories: number };
}

export function calcTotals(items: CalculatedIngredient[]): NutritionTotals {
  const total = items.reduce(
    (acc, i) => {
      acc.proteins += i.proteins;
      acc.fats += i.fats;
      acc.carbs += i.carbs;
      acc.calories += i.calories;
      acc.weight += i.amountGrams;
      return acc;
    },
    { proteins: 0, fats: 0, carbs: 0, calories: 0, weight: 0 }
  );

  const weight100 = total.weight > 0 ? total.weight : 100;
  const per100 = {
    proteins: (total.proteins * 100) / weight100,
    fats: (total.fats * 100) / weight100,
    carbs: (total.carbs * 100) / weight100,
    calories: (total.calories * 100) / weight100,
  };

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    total: {
      proteins: round(total.proteins),
      fats: round(total.fats),
      carbs: round(total.carbs),
      calories: round(total.calories),
      weight: round(total.weight),
    },
    per100: {
      proteins: round(per100.proteins),
      fats: round(per100.fats),
      carbs: round(per100.carbs),
      calories: round(per100.calories),
    },
  };
}

