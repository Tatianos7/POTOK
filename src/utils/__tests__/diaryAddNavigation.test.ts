import test from 'node:test';
import assert from 'node:assert/strict';

import { saveDiaryEntryForReturnToDiary } from '../diaryAddNavigation';

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
