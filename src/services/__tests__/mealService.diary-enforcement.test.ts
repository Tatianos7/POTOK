import test from 'node:test';
import assert from 'node:assert/strict';

import type { DailyMeals, MealEntry } from '../../types';
import { mealService } from '../mealService';
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

test('recipe diary flow does not invent canonical food identity', async () => {
  const svc = mealService as any;
  const originalAddMealEntry = svc.addMealEntry;
  let captured: MealEntry | null = null;

  svc.addMealEntry = async (_userId: string, _date: string, _mealType: string, entry: MealEntry) => {
    captured = entry;
  };

  try {
    recipeDiaryService.saveRecipeEntry({
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
