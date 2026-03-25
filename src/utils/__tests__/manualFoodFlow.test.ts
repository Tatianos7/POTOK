import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDiaryReturnNavigationState } from '../manualFoodFlow';

test('manual food create flow builds diary navigation state with selectedDate', () => {
  assert.deepEqual(buildDiaryReturnNavigationState('2026-03-24'), {
    selectedDate: '2026-03-24',
  });
});

