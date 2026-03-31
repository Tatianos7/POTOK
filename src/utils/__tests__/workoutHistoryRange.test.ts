import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultWorkoutHistoryRange } from '../workoutHistoryRange';

test('history screen loads summaries for expected default period', () => {
  const range = getDefaultWorkoutHistoryRange(new Date('2026-03-30T12:00:00.000Z'));

  assert.equal(range.to, '2026-03-30');
  assert.equal(range.from, '2025-03-30');
});
