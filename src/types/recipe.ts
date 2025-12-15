export interface Recipe {
  id: string;
  name: string;
  image?: string;
  caloriesPer100: number;
  proteinsPer100: number;
  fatsPer100: number;
  carbsPer100: number;
  ingredients?: string[];
  instructions?: string;
  category?: string;
  isFavorite?: boolean;
  isInCollection?: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string; // для "МОИ РЕЦЕПТЫ"
}

export type RecipeTab = 'my' | 'favorites' | 'collection';

