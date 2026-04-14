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
      onOpen={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
    />,
  );

  assert.match(html, /30 сек/);
  assert.doesNotMatch(html, /▼/);
  assert.match(html, /Открыть карточку тренировки для Планка/);
  assert.match(html, /data-workout-row-content="true"/);
  assert.match(html, /grid-template-columns:24px minmax\(0, 1fr\)/);
  assert.match(html, /grid-template-columns:minmax\(0, 1fr\) 1px 48px 1px 48px 1px 72px/);
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
  assert.match(html, /grid-template-columns:minmax\(0, 1fr\) 1px 48px 1px 48px 1px 92px/);
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

test('existing row actions do not regress when tap-to-open card is added', () => {
  const html = renderToStaticMarkup(
    <ExerciseRow
      name="Жим лёжа"
      sets={4}
      reps={8}
      weight={70}
      valueText="70 кг"
      onOpen={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
      onMedia={() => {}}
    />,
  );

  assert.match(html, /Открыть карточку тренировки для Жим лёжа/);
  assert.match(html, /⋮/);
  assert.match(html, /70 кг/);
});

test('tapping action menu trigger does not share the workout card open target', () => {
  const html = renderToStaticMarkup(
    <ExerciseRow
      name="Бег"
      sets={1}
      reps={1}
      weight={3000}
      valueText="3 км"
      onOpen={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
      onMedia={() => {}}
    />,
  );

  assert.match(
    html,
    /<button[^>]*>⋮<\/button><div[^>]*aria-label="Открыть карточку тренировки для Бег"[^>]*data-workout-row-content="true"/,
  );
});

test('workout row keeps a dedicated tappable content area for opening the exercise card', () => {
  const html = renderToStaticMarkup(
    <ExerciseRow
      name="Присед"
      sets={4}
      reps={8}
      weight={80}
      valueText="80 кг"
      onOpen={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onNote={() => {}}
    />,
  );

  assert.match(html, /role="button"/);
  assert.match(html, /aria-label="Открыть карточку тренировки для Присед"/);
  assert.match(html, /data-workout-row-content="true"/);
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
