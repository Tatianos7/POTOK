import { mealService } from './mealService';
import { Food, MealEntry } from '../types';

interface SaveRecipeParams {
  userId: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeName: string;
  weight: number;
  per100: { calories: number; proteins: number; fats: number; carbs: number };
  totals: { calories: number; proteins: number; fats: number; carbs: number };
}

const uuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

class RecipeDiaryService {
  saveRecipeEntry(params: SaveRecipeParams): MealEntry {
    const { userId, date, mealType, recipeName, weight, per100, totals } = params;
    const recipeId = `recipe_${uuid()}`;
    const now = new Date().toISOString();

    const food: Food = {
      id: recipeId,
      name: recipeName,
      calories: per100.calories,
      protein: per100.proteins,
      fat: per100.fats,
      carbs: per100.carbs,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    } as Food;

    const entry: MealEntry = {
      id: `meal_${uuid()}`,
      foodId: recipeId,
      food,
      weight,
      calories: totals.calories,
      protein: totals.proteins,
      fat: totals.fats,
      carbs: totals.carbs,
    };

    mealService.addMealEntry(userId, date, mealType, entry);
    return entry;
  }
}

export const recipeDiaryService = new RecipeDiaryService();