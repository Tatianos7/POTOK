import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutProgressMonthPicker from '../WorkoutProgressMonthPicker';

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
