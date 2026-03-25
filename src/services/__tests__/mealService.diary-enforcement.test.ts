import test from 'node:test';
import assert from 'node:assert/strict';

import type { DailyMeals, MealEntry } from '../../types';
import { mealService } from '../mealService';
import { mealEntryNotesService } from '../mealEntryNotesService';
import { recipeDiaryService } from '../recipeDiaryService';
import { DiaryCreateServiceError } from '../diaryCreateService';

function createEmptyMeals(date: string): DailyMeals {
  return {
    date,
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    water: 0,
    notes: {
      breakfast: null,
      lunch: null,
      dinner: null,
      snack: null,
    },
  };
}

function createCanonicalEntry(): MealEntry {
  return {
    id: 'entry-1',
    foodId: '11111111-1111-4111-8111-111111111111',
    food: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Яйцо',
      calories: 155,
      protein: 13,
      fat: 11,
      carbs: 1.1,
      source: 'core',
      canonical_food_id: '11111111-1111-4111-8111-111111111111',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    weight: 100,
    calories: 155,
    protein: 13,
    fat: 11,
    carbs: 1.1,
    baseUnit: 'г',
    displayUnit: 'г',
    displayAmount: 100,
    idempotencyKey: '2026-03-18:breakfast:11111111-1111-4111-8111-111111111111',
    canonicalFoodId: '11111111-1111-4111-8111-111111111111',
  };
}

test('updateMealEntry uses strict canonical update path and bypasses batch save', async () => {
  const svc = mealService as any;
  const original = {
    requireSessionUser: svc.requireSessionUser,
    getMealsFromLocalStorage: svc.getMealsFromLocalStorage,
    updateCanonicalDiaryEntryWithEnforcement: svc.updateCanonicalDiaryEntryWithEnforcement,
    reconcileLocalDiaryEntry: svc.reconcileLocalDiaryEntry,
  };

  const calls: string[] = [];

  svc.requireSessionUser = async () => 'user-1';
  svc.getMealsFromLocalStorage = () => {
    const meals = createEmptyMeals('2026-03-18');
    meals.breakfast.push(createCanonicalEntry());
    return meals;
  };
  svc.updateCanonicalDiaryEntryWithEnforcement = async () => {
    calls.push('updateCanonical');
    return {
      id: 'entry-1',
      user_id: 'user-1',
      date: '2026-03-18',
      meal_type: 'breakfast',
      canonical_food_id: '11111111-1111-4111-8111-111111111111',
      product_name: 'Яйцо',
      weight: 150,
      calories: 232.5,
      protein: 19.5,
      fat: 16.5,
      carbs: 1.65,
      fiber: 0,
      idempotency_key: '2026-03-18:breakfast:11111111-1111-4111-8111-111111111111',
      created_at: new Date().toISOString(),
    };
  };
  svc.reconcileLocalDiaryEntry = () => {
    calls.push('reconcile');
  };
  try {
    await mealService.updateMealEntry('user-1', '2026-03-18', 'breakfast', 'entry-1', {
      ...createCanonicalEntry(),
      weight: 150,
      displayAmount: 150,
    });
    assert.deepEqual(calls, ['updateCanonical', 'reconcile']);
  } finally {
    Object.assign(svc, original);
  }
});

test('updateMealEntry blocks legacy non-canonical path', async () => {
  const svc = mealService as any;
  const original = {
    requireSessionUser: svc.requireSessionUser,
    getMealsFromLocalStorage: svc.getMealsFromLocalStorage,
  };

  svc.requireSessionUser = async () => 'user-1';
  svc.getMealsFromLocalStorage = () => {
    const meals = createEmptyMeals('2026-03-18');
    meals.breakfast.push({
      ...createCanonicalEntry(),
      canonicalFoodId: null,
      foodId: 'legacy-food',
      food: { ...createCanonicalEntry().food, id: 'legacy-food', canonical_food_id: null },
    });
    return meals;
  };

  try {
    await assert.rejects(
      () =>
        mealService.updateMealEntry('user-1', '2026-03-18', 'breakfast', 'entry-1', {
          ...createCanonicalEntry(),
          canonicalFoodId: null,
          foodId: 'legacy-food',
          food: { ...createCanonicalEntry().food, id: 'legacy-food', canonical_food_id: null },
        }),
      (error: unknown) =>
        error instanceof DiaryCreateServiceError && error.code === 'resolver_not_resolved'
    );
  } finally {
    Object.assign(svc, original);
  }
});

test('copyMeal replays entries through addMealEntry instead of batch save', async () => {
  const svc = mealService as any;
  const original = {
    requireSessionUser: svc.requireSessionUser,
    getMealsForDate: svc.getMealsForDate,
    addMealEntry: svc.addMealEntry,
  };

  const copied: MealEntry[] = [];

  svc.requireSessionUser = async () => 'user-1';
  svc.getMealsForDate = async () => {
    const meals = createEmptyMeals('2026-03-18');
    meals.breakfast.push(createCanonicalEntry());
    return meals;
  };
  svc.addMealEntry = async (_userId: string, _date: string, _mealType: string, entry: MealEntry) => {
    copied.push(entry);
    return entry;
  };

  try {
    await mealService.copyMeal('user-1', '2026-03-18', 'breakfast', '2026-03-19', 'lunch');
    assert.equal(copied.length, 1);
    assert.equal(copied[0].foodId, '11111111-1111-4111-8111-111111111111');
    assert.equal(copied[0].food?.canonical_food_id, '11111111-1111-4111-8111-111111111111');
  } finally {
    Object.assign(svc, original);
  }
});

test('copyMeal copies note using persisted new entry id', async () => {
  const svc = mealService as any;
  const original = {
    requireSessionUser: svc.requireSessionUser,
    getMealsForDate: svc.getMealsForDate,
    addMealEntry: svc.addMealEntry,
  };
  const originalSaveNote = mealEntryNotesService.saveNote;

  const saveCalls: Array<{ entryId: string; note: string }> = [];

  svc.requireSessionUser = async () => 'user-1';
  svc.getMealsForDate = async () => {
    const meals = createEmptyMeals('2026-03-18');
    meals.breakfast.push({
      ...createCanonicalEntry(),
      note: 'источник белка',
    });
    return meals;
  };
  svc.addMealEntry = async () =>
    ({
      ...createCanonicalEntry(),
      id: 'persisted-entry-1',
    }) as MealEntry;
  (mealEntryNotesService as any).saveNote = async (_userId: string, entryId: string, note: string) => {
    saveCalls.push({ entryId, note });
  };

  try {
    await mealService.copyMeal('user-1', '2026-03-18', 'breakfast', '2026-03-19', 'lunch');
    assert.deepEqual(saveCalls, [{ entryId: 'persisted-entry-1', note: 'источник белка' }]);
  } finally {
    Object.assign(svc, original);
    (mealEntryNotesService as any).saveNote = originalSaveNote;
  }
});

test('copyMeal skips note persistence when source note is absent', async () => {
  const svc = mealService as any;
  const original = {
    requireSessionUser: svc.requireSessionUser,
    getMealsForDate: svc.getMealsForDate,
    addMealEntry: svc.addMealEntry,
  };
  const originalSaveNote = mealEntryNotesService.saveNote;

  let saveCalled = false;

  svc.requireSessionUser = async () => 'user-1';
  svc.getMealsForDate = async () => {
    const meals = createEmptyMeals('2026-03-18');
    meals.breakfast.push(createCanonicalEntry());
    return meals;
  };
  svc.addMealEntry = async () => createCanonicalEntry();
  (mealEntryNotesService as any).saveNote = async () => {
    saveCalled = true;
  };

  try {
    await mealService.copyMeal('user-1', '2026-03-18', 'breakfast', '2026-03-19', 'lunch');
    assert.equal(saveCalled, false);
  } finally {
    Object.assign(svc, original);
    (mealEntryNotesService as any).saveNote = originalSaveNote;
  }
});

test('copyMeal assigns notes to matching persisted entries for multiple copied rows', async () => {
  const svc = mealService as any;
  const original = {
    requireSessionUser: svc.requireSessionUser,
    getMealsForDate: svc.getMealsForDate,
    addMealEntry: svc.addMealEntry,
  };
  const originalSaveNote = mealEntryNotesService.saveNote;

  const saveCalls: Array<{ entryId: string; note: string }> = [];
  let addIndex = 0;

  svc.requireSessionUser = async () => 'user-1';
  svc.getMealsForDate = async () => {
    const meals = createEmptyMeals('2026-03-18');
    meals.breakfast.push({
      ...createCanonicalEntry(),
      id: 'source-1',
      note: 'первая',
    });
    meals.breakfast.push({
      ...createCanonicalEntry(),
      id: 'source-2',
      foodId: '22222222-2222-4222-8222-222222222222',
      canonicalFoodId: '22222222-2222-4222-8222-222222222222',
      food: {
        ...createCanonicalEntry().food,
        id: '22222222-2222-4222-8222-222222222222',
        canonical_food_id: '22222222-2222-4222-8222-222222222222',
        name: 'Творог',
      },
      note: null,
    });
    meals.breakfast.push({
      ...createCanonicalEntry(),
      id: 'source-3',
      foodId: '33333333-3333-4333-8333-333333333333',
      canonicalFoodId: '33333333-3333-4333-8333-333333333333',
      food: {
        ...createCanonicalEntry().food,
        id: '33333333-3333-4333-8333-333333333333',
        canonical_food_id: '33333333-3333-4333-8333-333333333333',
        name: 'Йогурт',
      },
      note: 'третья',
    });
    return meals;
  };
  svc.addMealEntry = async () => {
    addIndex += 1;
    return {
      ...createCanonicalEntry(),
      id: `persisted-${addIndex}`,
    } as MealEntry;
  };
  (mealEntryNotesService as any).saveNote = async (_userId: string, entryId: string, note: string) => {
    saveCalls.push({ entryId, note });
  };

  try {
    await mealService.copyMeal('user-1', '2026-03-18', 'breakfast', '2026-03-19', 'lunch');
    assert.deepEqual(saveCalls, [
      { entryId: 'persisted-1', note: 'первая' },
      { entryId: 'persisted-3', note: 'третья' },
    ]);
  } finally {
    Object.assign(svc, original);
    (mealEntryNotesService as any).saveNote = originalSaveNote;
  }
});

test('recipe diary flow waits for authoritative persistence and keeps canonical food identity null', async () => {
  const svc = mealService as any;
  const originalAddMealEntry = svc.addMealEntry;
  let captured: MealEntry | null = null;

  svc.addMealEntry = async (_userId: string, _date: string, _mealType: string, entry: MealEntry) => {
    captured = entry;
    return {
      ...entry,
      id: 'persisted-recipe-entry-1',
    } as MealEntry;
  };

  try {
    const persisted = await recipeDiaryService.saveRecipeEntry({
      userId: 'user-1',
      date: '2026-03-18',
      mealType: 'dinner',
      recipeName: 'Омлет',
      weight: 250,
      per100: { calories: 120, proteins: 10, fats: 8, carbs: 3 },
      totals: { calories: 300, proteins: 25, fats: 20, carbs: 7.5 },
    });

    assert.ok(captured);
    const capturedEntry = captured as MealEntry;
    assert.equal(capturedEntry.recipeId?.startsWith('recipe_'), true);
    assert.equal(capturedEntry.canonicalFoodId ?? null, null);
    assert.equal(persisted.id, 'persisted-recipe-entry-1');
    assert.equal(persisted.canonicalFoodId ?? null, null);
  } finally {
    svc.addMealEntry = originalAddMealEntry;
  }
});

test('recipe diary flow propagates persistence failures instead of returning false success', async () => {
  const svc = mealService as any;
  const originalAddMealEntry = svc.addMealEntry;

  svc.addMealEntry = async () => {
    throw new Error('db write failed');
  };

  try {
    await assert.rejects(
      () =>
        recipeDiaryService.saveRecipeEntry({
          userId: 'user-1',
          date: '2026-03-18',
          mealType: 'dinner',
          recipeName: 'Омлет',
          weight: 250,
          per100: { calories: 120, proteins: 10, fats: 8, carbs: 3 },
          totals: { calories: 300, proteins: 25, fats: 20, carbs: 7.5 },
        }),
      /db write failed/
    );
  } finally {
    svc.addMealEntry = originalAddMealEntry;
  }
});

test('reconcileLocalDiaryEntry keeps persisted non-zero snapshot values', () => {
  const svc = mealService as any;
  const original = {
    getMealsFromLocalStorage: svc.getMealsFromLocalStorage,
    createEmptyMeals: svc.createEmptyMeals,
    saveMealsToLocalStorage: svc.saveMealsToLocalStorage,
    setSyncStatus: svc.setSyncStatus,
    publishFoodDiaryChanged: svc.publishFoodDiaryChanged,
  };

  let savedMeals: DailyMeals | null = null;

  svc.getMealsFromLocalStorage = () => {
    const meals = createEmptyMeals('2026-03-18');
    meals.breakfast.push({
      ...createCanonicalEntry(),
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    });
    return meals;
  };
  svc.createEmptyMeals = createEmptyMeals;
  svc.saveMealsToLocalStorage = (_userId: string, meals: DailyMeals) => {
    savedMeals = meals;
    return true;
  };
  svc.setSyncStatus = () => {};
  svc.publishFoodDiaryChanged = () => {};

  try {
    svc.reconcileLocalDiaryEntry(
      'user-1',
      '2026-03-18',
      'breakfast',
      '2026-03-18:breakfast:11111111-1111-4111-8111-111111111111',
      {
        id: 'entry-1',
        user_id: 'user-1',
        date: '2026-03-18',
        meal_type: 'breakfast',
        canonical_food_id: '11111111-1111-4111-8111-111111111111',
        product_name: 'Яйцо',
        weight: 150,
        calories: 232.5,
        protein: 19.5,
        fat: 16.5,
        carbs: 1.65,
        fiber: 0,
        idempotency_key: '2026-03-18:breakfast:11111111-1111-4111-8111-111111111111',
        created_at: new Date().toISOString(),
      }
    );

    assert.ok(savedMeals);
    const reconciledMeals = savedMeals as DailyMeals;
    assert.equal(reconciledMeals.breakfast[0].calories, 232.5);
    assert.equal(reconciledMeals.breakfast[0].protein, 19.5);
    assert.equal(reconciledMeals.breakfast[0].fat, 16.5);
    assert.equal(reconciledMeals.breakfast[0].carbs, 1.65);
    assert.equal(reconciledMeals.breakfast[0].food.calories, 155);
    assert.equal(reconciledMeals.breakfast[0].food.protein, 13);
  } finally {
    Object.assign(svc, original);
  }
});
