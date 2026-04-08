import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutProgressMonthPicker, {
  clampMonthDateForBounds,
  getYearNavigationTargetMonthDate,
} from '../WorkoutProgressMonthPicker';

test('progress period picker opens as overlay and does not participate in normal layout flow', () => {
  const html = renderToStaticMarkup(
    <WorkoutProgressMonthPicker
      selectedMonthDate="2026-04-01"
      minDate="2025-04-01"
      maxDate="2026-04-30"
      onMonthSelect={() => {}}
    />,
  );

  assert.match(html, /absolute left-0 right-0 top-full z-20/);
  assert.match(html, /data-testid="progress-month-picker-overlay"/);
});

test('progress screen uses month-only selection contract', () => {
  const html = renderToStaticMarkup(
    <WorkoutProgressMonthPicker
      selectedMonthDate="2026-04-01"
      minDate="2025-04-01"
      maxDate="2026-04-30"
      onMonthSelect={() => {}}
    />,
  );

  assert.match(html, />Янв</);
  assert.match(html, />Дек</);
  assert.doesNotMatch(html, />Пн</);
  assert.doesNotMatch(html, />31</);
});

test('prev year does not go below minMonthKey', () => {
  const target = getYearNavigationTargetMonthDate(2026, 2, -1, '2025-04', '2026-12');

  assert.equal(target, '2025-04-01');
});

test('next year does not go above maxMonthKey', () => {
  const target = getYearNavigationTargetMonthDate(2025, 11, 1, '2024-01', '2026-08');

  assert.equal(target, '2026-08-01');
});

test('mid-year bounds are clamped correctly', () => {
  assert.equal(clampMonthDateForBounds('2025-02-01', '2025-04', '2026-09'), '2025-04-01');
  assert.equal(clampMonthDateForBounds('2026-11-01', '2025-04', '2026-09'), '2026-09-01');
});

test('month inside range is not broken by clamp', () => {
  const target = getYearNavigationTargetMonthDate(2026, 7, -1, '2025-04', '2027-12');

  assert.equal(target, '2025-07-01');
});
