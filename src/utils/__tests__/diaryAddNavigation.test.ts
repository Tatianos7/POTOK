import test from 'node:test';
import assert from 'node:assert/strict';

import { saveDiaryEntriesForReturnToDiary, saveDiaryEntryForReturnToDiary } from '../diaryAddNavigation';

test('search result add waits for persistence before returning diary navigation state', async () => {
  const calls: string[] = [];
  let releaseAdd!: () => void;

  const pending = saveDiaryEntryForReturnToDiary({
    addMealEntry: async () => {
      calls.push('add:start');
      await new Promise<void>((resolve) => {
        releaseAdd = () => {
          calls.push('add:done');
          resolve();
        };
      });
    },
    userId: 'user-1',
    selectedDate: '2026-03-24',
    mealType: 'breakfast',
    entry: {
      id: 'entry-1',
      foodId: 'food-1',
      food: { id: 'food-1', name: 'Яйцо', calories: 155, protein: 13, fat: 11, carbs: 1.1 } as any,
      weight: 100,
      calories: 155,
      protein: 13,
      fat: 11,
      carbs: 1.1,
      baseUnit: 'г',
      displayUnit: 'г',
      displayAmount: 100,
      canonicalFoodId: 'food-1',
    },
  });

  assert.deepEqual(calls, ['add:start']);
  releaseAdd();
  const state = await pending;

  assert.deepEqual(calls, ['add:start', 'add:done']);
  assert.deepEqual(state, { selectedDate: '2026-03-24' });
});

test('add flow does not return success navigation state when persistence fails', async () => {
  await assert.rejects(
    saveDiaryEntryForReturnToDiary({
      addMealEntry: async () => {
        throw new Error('db failed');
      },
      userId: 'user-1',
      selectedDate: '2026-03-24',
      mealType: 'lunch',
      entry: {
        id: 'entry-1',
        foodId: 'food-1',
        food: { id: 'food-1', name: 'Яйцо', calories: 155, protein: 13, fat: 11, carbs: 1.1 } as any,
        weight: 100,
        calories: 155,
        protein: 13,
        fat: 11,
        carbs: 1.1,
        baseUnit: 'г',
        displayUnit: 'г',
        displayAmount: 100,
        canonicalFoodId: 'food-1',
      },
    })
  );
});

test('multi-add flow saves multiple entries through existing add path and preserves meal/date', async () => {
  const calls: string[] = [];

  const state = await saveDiaryEntriesForReturnToDiary({
    addMealEntry: async (_userId, date, mealType, entry) => {
      calls.push(`${date}:${mealType}:${entry.foodId}`);
    },
    userId: 'user-1',
    selectedDate: '2026-03-24',
    mealType: 'lunch',
    entries: [
      {
        id: 'entry-1',
        foodId: 'food-1',
        food: { id: 'food-1', name: 'Яйцо', calories: 155, protein: 13, fat: 11, carbs: 1.1 } as any,
        weight: 100,
        calories: 155,
        protein: 13,
        fat: 11,
        carbs: 1.1,
        baseUnit: 'г',
        displayUnit: 'г',
        displayAmount: 100,
        canonicalFoodId: 'food-1',
      },
      {
        id: 'entry-2',
        foodId: 'food-2',
        food: { id: 'food-2', name: 'Овсянка', calories: 370, protein: 12, fat: 6, carbs: 65 } as any,
        weight: 50,
        calories: 185,
        protein: 6,
        fat: 3,
        carbs: 32.5,
        baseUnit: 'г',
        displayUnit: 'г',
        displayAmount: 50,
        canonicalFoodId: 'food-2',
      },
    ],
  });

  assert.deepEqual(calls, [
    '2026-03-24:lunch:food-1',
    '2026-03-24:lunch:food-2',
  ]);
  assert.deepEqual(state, { selectedDate: '2026-03-24', mealType: 'lunch' });
});

test('multi-add flow waits for all persistence calls before returning success state', async () => {
  const calls: string[] = [];
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;

  const pending = saveDiaryEntriesForReturnToDiary({
    addMealEntry: async (_userId, _date, _mealType, entry) => {
      calls.push(`${entry.foodId}:start`);
      await new Promise<void>((resolve) => {
        if (entry.foodId === 'food-1') {
          releaseFirst = () => {
            calls.push('food-1:done');
            resolve();
          };
        } else {
          releaseSecond = () => {
            calls.push('food-2:done');
            resolve();
          };
        }
      });
    },
    userId: 'user-1',
    selectedDate: '2026-03-24',
    mealType: 'dinner',
    entries: [
      {
        id: 'entry-1',
        foodId: 'food-1',
        food: { id: 'food-1', name: 'Яйцо', calories: 155, protein: 13, fat: 11, carbs: 1.1 } as any,
        weight: 100,
        calories: 155,
        protein: 13,
        fat: 11,
        carbs: 1.1,
      },
      {
        id: 'entry-2',
        foodId: 'food-2',
        food: { id: 'food-2', name: 'Овсянка', calories: 370, protein: 12, fat: 6, carbs: 65 } as any,
        weight: 50,
        calories: 185,
        protein: 6,
        fat: 3,
        carbs: 32.5,
      },
    ],
  });

  assert.deepEqual(calls, ['food-1:start']);
  releaseFirst();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['food-1:start', 'food-1:done', 'food-2:start']);
  releaseSecond();

  const state = await pending;
  assert.deepEqual(calls, ['food-1:start', 'food-1:done', 'food-2:start', 'food-2:done']);
  assert.deepEqual(state, { selectedDate: '2026-03-24', mealType: 'dinner' });
});

test('multi-add flow rejects on save error and does not continue remaining entries', async () => {
  const calls: string[] = [];

  await assert.rejects(
    saveDiaryEntriesForReturnToDiary({
      addMealEntry: async (_userId, _date, _mealType, entry) => {
        calls.push(entry.foodId);
        if (entry.foodId === 'food-2') {
          throw new Error('db failed');
        }
      },
      userId: 'user-1',
      selectedDate: '2026-03-24',
      mealType: 'snack',
      entries: [
        {
          id: 'entry-1',
          foodId: 'food-1',
          food: { id: 'food-1', name: 'Яйцо', calories: 155, protein: 13, fat: 11, carbs: 1.1 } as any,
          weight: 100,
          calories: 155,
          protein: 13,
          fat: 11,
          carbs: 1.1,
        },
        {
          id: 'entry-2',
          foodId: 'food-2',
          food: { id: 'food-2', name: 'Овсянка', calories: 370, protein: 12, fat: 6, carbs: 65 } as any,
          weight: 50,
          calories: 185,
          protein: 6,
          fat: 3,
          carbs: 32.5,
        },
        {
          id: 'entry-3',
          foodId: 'food-3',
          food: { id: 'food-3', name: 'Творог', calories: 120, protein: 18, fat: 5, carbs: 3 } as any,
          weight: 80,
          calories: 96,
          protein: 14.4,
          fat: 4,
          carbs: 2.4,
        },
      ],
    })
  );

  assert.deepEqual(calls, ['food-1', 'food-2']);
});
