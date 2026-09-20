import type { Recipe } from '../types/recipe';

export function visiblePrivateRecipes(recipes: Recipe[], currentUserId?: string): Recipe[] {
  if (!currentUserId?.trim()) return [];
  return recipes.filter((recipe) => recipe.userId === currentUserId && recipe.source !== 'default');
}
