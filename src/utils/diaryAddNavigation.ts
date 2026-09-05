import { MealEntry } from '../types';
import { buildDiaryReturnNavigationState } from './manualFoodFlow';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type AddMealEntryFn = (
  userId: string,
  selectedDate: string,
  mealType: MealType,
  entry: MealEntry
) => Promise<unknown>;

interface SaveDiaryEntryParams {
  addMealEntry: AddMealEntryFn;
  userId: string;
  selectedDate: string;
  mealType: MealType;
  entry: MealEntry;
}

interface SaveDiaryEntriesParams {
  addMealEntry: AddMealEntryFn;
  userId: string;
  selectedDate: string;
  mealType: MealType;
  entries: MealEntry[];
}

export async function saveDiaryEntryForReturnToDiary(
  params: SaveDiaryEntryParams
): Promise<{ selectedDate: string }> {
  await params.addMealEntry(params.userId, params.selectedDate, params.mealType, params.entry);
  return buildDiaryReturnNavigationState(params.selectedDate);
}

export async function saveDiaryEntriesForReturnToDiary(
  params: SaveDiaryEntriesParams
): Promise<{ selectedDate: string; mealType: MealType }> {
  for (const entry of params.entries) {
    await params.addMealEntry(params.userId, params.selectedDate, params.mealType, entry);
  }

  return {
    ...buildDiaryReturnNavigationState(params.selectedDate),
    mealType: params.mealType,
  };
}
