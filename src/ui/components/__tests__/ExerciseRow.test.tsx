import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import ExerciseRow, { resolveExerciseMetricPopupPlacement } from '../ExerciseRow';

test('main workout screen does not render metric selector in read-only rows', () => {
  const html = renderToStaticMarkup(
    <ExerciseRow
      name="Планка"
      sets={3}
      reps={1}
      weight={30}
      metricType="time"
      valueText="30 сек"
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
    />,
  );

  assert.match(html, /30 сек/);
  assert.doesNotMatch(html, /▼/);
  assert.match(html, /grid-template-columns:24px minmax\(0, 1fr\) 1px 48px 1px 48px 1px 72px/);
});

test('editable metric selector can still be rendered without breaking row layout', () => {
  const html = renderToStaticMarkup(
    <ExerciseRow
      name="Планка"
      sets={3}
      reps={1}
      weight={30}
      metricType="time"
      valueText="30 сек"
      onMetricTypeChange={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
    />,
  );

  assert.match(html, /Время ▼/);
  assert.match(html, /grid-template-columns:24px minmax\(0, 1fr\) 1px 48px 1px 48px 1px 92px/);
});

test('metric popup placement stays within viewport near right edge', () => {
  const placement = resolveExerciseMetricPopupPlacement(
    { left: 290, right: 314, top: 100, bottom: 124 },
    { width: 320, height: 640 },
    { width: 152, height: 220 },
  );

  assert.ok(placement.left >= 8);
  assert.ok(placement.left + 152 <= 320);
});

test('metric popup placement stays within viewport near bottom edge', () => {
  const placement = resolveExerciseMetricPopupPlacement(
    { left: 180, right: 204, top: 560, bottom: 584 },
    { width: 320, height: 640 },
    { width: 152, height: 220 },
  );

  assert.ok(placement.top >= 8);
  assert.ok(placement.top + 220 <= 640);
});

test('existing row actions do not regress when metric selector is enabled', () => {
  const html = renderToStaticMarkup(
    <ExerciseRow
      name="Подтягивания"
      sets={4}
      reps={10}
      weight={0}
      metricType="bodyweight"
      valueText="св. вес"
      onMetricTypeChange={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
      onMedia={() => {}}
    />,
  );

  assert.match(html, /⋮/);
  assert.match(html, /Свой вес ▼/);
  assert.match(html, /св\. вес/);
});

test('single exercise edit via row action still works', () => {
  const html = renderToStaticMarkup(
    <ExerciseRow
      name="Подтягивания"
      sets={4}
      reps={10}
      weight={0}
      metricType="bodyweight"
      valueText="св. вес"
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
    />,
  );

  assert.match(html, /⋮/);
  assert.match(html, /св\. вес/);
});
