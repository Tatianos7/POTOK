import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutHistoryList from '../WorkoutHistoryList';
import WorkoutHistoryDayDetails from '../WorkoutHistoryDayDetails';
import type { WorkoutEntry, WorkoutHistoryDaySummary } from '../../types/workout';

const historyItems: WorkoutHistoryDaySummary[] = [
  {
    workout_day_id: 'day-1',
    date: '2026-03-29',
    exercise_count: 3,
    total_sets: 12,
    total_volume: 4200,
  },
  {
    workout_day_id: 'day-2',
    date: '2026-03-27',
    exercise_count: 2,
    total_sets: 8,
    total_volume: 1800,
  },
];

const historyEntries: WorkoutEntry[] = [
  {
    id: 'entry-1',
    workout_day_id: 'day-1',
    exercise_id: 'exercise-1',
    sets: 4,
    reps: 10,
    weight: 60,
    baseUnit: 'кг',
    displayUnit: 'кг',
    displayAmount: 60,
    created_at: '2026-03-29T10:00:00.000Z',
    updated_at: '2026-03-29T10:00:00.000Z',
    exercise: {
      id: 'exercise-1',
      name: 'Жим лёжа',
      category_id: 'chest',
      is_custom: false,
      muscles: [],
    },
  },
  {
    id: 'entry-2',
    workout_day_id: 'day-1',
    exercise_id: 'exercise-2',
    sets: 3,
    reps: 12,
    weight: 20,
    baseUnit: 'кг',
    displayUnit: 'кг',
    displayAmount: 20,
    created_at: '2026-03-29T10:10:00.000Z',
    updated_at: '2026-03-29T10:10:00.000Z',
    exercise: {
      id: 'exercise-2',
      name: 'Подъёмы на грудь (Push Press) со штангой или гантелями с очень длинным названием',
      category_id: 'shoulders',
      is_custom: false,
      muscles: [],
    },
  },
];

test('history list renders persisted workout days only', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryList
      items={historyItems}
      selectedDate={null}
      onSelect={() => {}}
    />,
  );

  assert.match(html, /29 марта 2026/);
  assert.match(html, /27 марта 2026/);
  assert.match(html, /Упражнений: 3/);
  assert.match(html, /Подходы: 12/);
  assert.match(html, /Объём: 4200/);
});

test('history list renders empty state when persisted workout days are absent', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryList
      items={[]}
      selectedDate={null}
      onSelect={() => {}}
    />,
  );

  assert.match(html, /За выбранный период тренировок нет/);
});

test('selecting history item can open correct day details read model', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryDayDetails
      date="2026-03-29"
      entries={historyEntries}
      isLoading={false}
    />,
  );

  assert.match(html, /Тренировка за 2026-03-29/);
  assert.match(html, /Упражнение/);
  assert.match(html, /Подх/);
  assert.match(html, /Пов/);
  assert.match(html, /Вес/);
  assert.match(html, /Жим лёжа/);
  assert.match(html, />4</);
  assert.match(html, />10</);
  assert.match(html, /60 кг/);
});

test('exercise name column remains constrained within table layout', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryDayDetails
      date="2026-03-29"
      entries={historyEntries}
      isLoading={false}
    />,
  );

  assert.match(html, /grid-cols-\[minmax\(0,1fr\)_48px_48px_64px\]/);
  assert.match(html, /break-words overflow-hidden/);
  assert.match(html, /Подъёмы на грудь \(Push Press\)/);
});

test('compact table headers render correctly', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryDayDetails
      date="2026-03-29"
      entries={historyEntries}
      isLoading={false}
    />,
  );

  assert.match(html, />Упражнение</);
  assert.match(html, />Подх</);
  assert.match(html, />Пов</);
  assert.match(html, />Вес</);
  assert.doesNotMatch(html, />Подходы</);
  assert.doesNotMatch(html, />Повторы</);
});

test('numeric history columns remain centered', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryDayDetails
      date="2026-03-29"
      entries={historyEntries}
      isLoading={false}
    />,
  );

  assert.match(html, /flex items-center justify-center text-center">Подх</);
  assert.match(html, /flex items-center justify-center text-center">Пов</);
  assert.match(html, /flex items-center justify-center text-center">Вес</);
  assert.match(html, /flex items-center justify-center border-l border-gray-200 px-1 text-center/);
});

test('selected date shows clean empty state when entries are absent', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryDayDetails
      date="2026-03-10"
      entries={[]}
      isLoading={false}
    />,
  );

  assert.match(html, /Для этого дня тренировка не найдена/);
});

test('history read-side does not introduce planner semantics', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryList
      items={historyItems}
      selectedDate={null}
      onSelect={() => {}}
    />,
  );

  assert.doesNotMatch(html, /ЗАПЛАНИРОВАТЬ/);
  assert.doesNotMatch(html, /planner/i);
});

test('history screen remains read-only in day details', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryDayDetails
      date="2026-03-29"
      entries={historyEntries}
      isLoading={false}
    />,
  );

  assert.doesNotMatch(html, /Редактировать/);
  assert.doesNotMatch(html, /Удалить/);
  assert.doesNotMatch(html, /ДОБАВИТЬ/);
});

test('history read-side keeps per-entry metric labels for mixed workouts', () => {
  const html = renderToStaticMarkup(
    <WorkoutHistoryDayDetails
      date="2026-03-29"
      entries={[
        ...historyEntries,
        {
          id: 'entry-3',
          workout_day_id: 'day-1',
          exercise_id: 'exercise-3',
          metricType: 'time',
          metricUnit: 'мин',
          sets: 2,
          reps: 1,
          weight: 15,
          displayAmount: 15,
          displayUnit: 'мин',
          baseUnit: 'мин',
          exercise: {
            id: 'exercise-3',
            name: 'Планка',
            category_id: 'core',
            is_custom: false,
            muscles: [],
          },
        },
        {
          id: 'entry-4',
          workout_day_id: 'day-1',
          exercise_id: 'exercise-4',
          metricType: 'distance',
          metricUnit: 'км',
          sets: 1,
          reps: 1,
          weight: 5,
          displayAmount: 5,
          displayUnit: 'км',
          baseUnit: 'км',
          exercise: {
            id: 'exercise-4',
            name: 'Бег',
            category_id: 'cardio',
            is_custom: false,
            muscles: [],
          },
        },
      ]}
      isLoading={false}
    />,
  );

  assert.match(html, /15 мин/);
  assert.match(html, /5 км/);
  assert.doesNotMatch(html, /▼/);
});
