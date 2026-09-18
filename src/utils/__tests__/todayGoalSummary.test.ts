import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTodayGoalSummaryForUser,
  type TodayGoalStorageReader,
} from '../todayGoalSummary';

function createStorage(values: Record<string, string>): TodayGoalStorageReader & { reads: string[] } {
  const reads: string[] = [];

  return {
    reads,
    getItem(key: string) {
      reads.push(key);
      return values[key] ?? null;
    },
  };
}

const currentGoal = JSON.stringify({
  goalType: 'weight-loss',
  startWeight: 70,
  currentWeight: 66,
  targetWeight: 55,
});

test('Today goal lookup reads only the exact current-user key', () => {
  const storage = createStorage({
    goal_other: JSON.stringify({ goalType: 'gain', currentWeight: 80, targetWeight: 90 }),
    goal_current: currentGoal,
  });

  assert.deepEqual(getTodayGoalSummaryForUser('current', storage), {
    goalType: 'weight-loss',
    startWeight: 70,
    currentWeight: 66,
    targetWeight: 55,
  });
  assert.deepEqual(storage.reads, ['goal_current']);
});

test('Today goal lookup ignores valid goals owned by other users', () => {
  const storage = createStorage({
    goal_other: currentGoal,
  });

  assert.equal(getTodayGoalSummaryForUser('current', storage), null);
  assert.deepEqual(storage.reads, ['goal_current']);
});

test('multiple goal keys cannot change the current-user result', () => {
  const storage = createStorage({
    goal_alpha: JSON.stringify({ goalType: 'gain', currentWeight: 60 }),
    goal_beta: JSON.stringify({ goalType: 'maintain', currentWeight: 75 }),
    goal_current: currentGoal,
  });

  assert.equal(getTodayGoalSummaryForUser('current', storage)?.targetWeight, 55);
  assert.deepEqual(storage.reads, ['goal_current']);
});

test('switching users re-resolves the goal from each exact user key', () => {
  const storage = createStorage({
    goal_first: JSON.stringify({ goalType: 'weight-loss', currentWeight: 70, targetWeight: 55 }),
    goal_second: JSON.stringify({ goalType: 'gain', currentWeight: 60, targetWeight: 68 }),
  });

  assert.equal(getTodayGoalSummaryForUser('first', storage)?.goalType, 'weight-loss');
  assert.equal(getTodayGoalSummaryForUser('second', storage)?.goalType, 'gain');
  assert.deepEqual(storage.reads, ['goal_first', 'goal_second']);
});

test('malformed current-user goal fails closed without falling back to another user', () => {
  const storage = createStorage({
    goal_current: '{invalid json',
    goal_other: currentGoal,
  });

  assert.equal(getTodayGoalSummaryForUser('current', storage), null);
  assert.deepEqual(storage.reads, ['goal_current']);
});

test('missing current-user goal returns no goal', () => {
  const storage = createStorage({});

  assert.equal(getTodayGoalSummaryForUser('current', storage), null);
  assert.deepEqual(storage.reads, ['goal_current']);
});

test('missing current user id returns no goal without reading storage', () => {
  const storage = createStorage({ goal_other: currentGoal });

  assert.equal(getTodayGoalSummaryForUser(undefined, storage), null);
  assert.equal(getTodayGoalSummaryForUser(null, storage), null);
  assert.equal(getTodayGoalSummaryForUser('', storage), null);
  assert.deepEqual(storage.reads, []);
});

test('unavailable or throwing storage returns no goal', () => {
  assert.equal(getTodayGoalSummaryForUser('current', null), null);
  assert.equal(
    getTodayGoalSummaryForUser('current', {
      getItem() {
        throw new Error('storage unavailable');
      },
    }),
    null,
  );
});
