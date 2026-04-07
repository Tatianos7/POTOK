import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyWorkoutProgressMonthSelection,
  formatWorkoutProgressMonthLabel,
  getWorkoutProgressMonthPeriod,
} from '../workoutProgressPeriod';

test('progress workouts screen loads current month by default via month period contract', () => {
  const period = getWorkoutProgressMonthPeriod('2026-04-06');

  assert.equal(period.from, '2026-04-01');
  assert.equal(period.to, '2026-04-30');
});

test('month picker changes selected month correctly', () => {
  const next = applyWorkoutProgressMonthSelection('2026-02-14');
  const period = getWorkoutProgressMonthPeriod(next.selectedMonthDate);

  assert.equal(next.isCalendarOpen, false);
  assert.equal(next.selectedMonthDate, '2026-02-01');
  assert.equal(period.from, '2026-02-01');
  assert.equal(period.to, '2026-02-28');
});

test('month label is formatted correctly', () => {
  assert.equal(formatWorkoutProgressMonthLabel('2026-03-25'), 'март 2026');
});
