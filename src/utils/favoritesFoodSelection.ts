import { Food } from '../types';

export interface FavoriteFoodCandidate {
  foodId: string;
  foodName: string;
  weight: number;
  lastUsedAt: string;
}

export type FavoriteFoodSelectionResult =
  | { kind: 'resolved'; food: Food }
  | { kind: 'blocked_suspicious_zero'; food: Food }
  | { kind: 'not_found' };

export interface FavoriteFoodSelectionDeps {
  getFoodById: (foodId: string, userId?: string) => Food | null;
  search: (query: string, options?: { limit?: number; userId?: string }) => Promise<Food[]>;
  hydrateFoodForDiarySelection: (food: Food, userId?: string) => Promise<Food>;
  isSuspiciousFood: (food: Food) => boolean;
}

export async function resolveFavoriteFoodForAdd(
  recentFood: FavoriteFoodCandidate,
  userId: string | undefined,
  deps: FavoriteFoodSelectionDeps
): Promise<FavoriteFoodSelectionResult> {
  let food: Food | null = null;

  if (recentFood.foodId && recentFood.foodId.trim()) {
    food = deps.getFoodById(recentFood.foodId, userId);
  }

  if (!food) {
    const searchResults = await deps.search(recentFood.foodName.trim(), { limit: 5, userId });
    if (searchResults.length > 0) {
      food = searchResults[0];
    }
  }

  if (!food) {
    return { kind: 'not_found' };
  }

  const hydrated = await deps.hydrateFoodForDiarySelection(food, userId);
  if (deps.isSuspiciousFood(hydrated)) {
    return { kind: 'blocked_suspicious_zero', food: hydrated };
  }

  return { kind: 'resolved', food: hydrated };
}
