export interface Recipe {
  id: string;
  name: string;
  image?: string | null;
  // Для рецептов из анализатора - общие калории (не на 100г)
  totalCalories?: number;
  totalProteins?: number;
  totalFats?: number;
  totalCarbs?: number;
  // Для дефолтных рецептов - калории на 100г
  caloriesPer100?: number;
  proteinsPer100?: number;
  fatsPer100?: number;
  carbsPer100?: number;
  ingredients?: Array<{
    name: string;
    quantity: number;
    unit: string;
    grams: number;
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  }>;
  instructions?: string;
  category?: string;
  isFavorite?: boolean;
  isInCollection?: boolean;
  source?: 'recipe_analyzer' | 'manual' | 'default' | 'meal';
  createdAt: string;
  updatedAt: string;
  userId?: string; // для "МОИ РЕЦЕПТЫ"
}

export type RecipeTab = 'my' | 'favorites' | 'collection';

