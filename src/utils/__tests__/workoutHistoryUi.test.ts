import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyWorkoutHistoryDateSelection,
  shouldShowWorkoutHistoryRepeatButton,
  toggleWorkoutHistoryCalendar,
} from '../workoutHistoryUi';

test('compact trigger opens history calendar', () => {
  assert.equal(toggleWorkoutHistoryCalendar(false), true);
});

test('selecting date closes calendar', () => {
  const next = applyWorkoutHistoryDateSelection('2026-03-29');

  assert.equal(next.selectedDate, '2026-03-29');
  assert.equal(next.isCalendarOpen, false);
});

test('repeat button is shown only when selected date has workout entries', () => {
  assert.equal(shouldShowWorkoutHistoryRepeatButton(3, false), true);
});

test('repeat button is hidden when selected date has no workout', () => {
  assert.equal(shouldShowWorkoutHistoryRepeatButton(0, false), false);
  assert.equal(shouldShowWorkoutHistoryRepeatButton(2, true), false);
});
