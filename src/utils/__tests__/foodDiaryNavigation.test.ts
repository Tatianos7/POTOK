import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDiarySelectedDateFromState } from '../foodDiaryNavigation';

test('uses selectedDate from navigation state when valid', () => {
  assert.equal(
    resolveDiarySelectedDateFromState({ selectedDate: '2026-03-24' }, '2026-03-23'),
    '2026-03-24'
  );
});

test('falls back to today when navigation state is missing or invalid', () => {
  assert.equal(resolveDiarySelectedDateFromState(null, '2026-03-23'), '2026-03-23');
  assert.equal(
    resolveDiarySelectedDateFromState({ selectedDate: '24-03-2026' }, '2026-03-23'),
    '2026-03-23'
  );
});

