import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutProgressList from '../WorkoutProgressList';
import type { WorkoutProgressRow } from '../../types/workout';

const rows: WorkoutProgressRow[] = [
  {
    exerciseGroupKey: 'bench',
    exerciseName: 'Жим лежа',
    latestSets: 4,
    latestReps: 8,
    latestWeight: 80,
    setsTrend: 'up',
    repsTrend: 'down',
    weightTrend: 'return',
    lastDate: '2026-04-04',
  },
  {
    exerciseGroupKey: 'pullup',
    exerciseName: 'Подтягивания',
    latestSets: 3,
    latestReps: 10,
    latestWeight: 0,
    setsTrend: 'neutral',
    repsTrend: 'neutral',
    weightTrend: 'up',
    lastDate: '2026-04-03',
  },
];

test('progress screen renders one row per exercise', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} />);

  assert.match(html, /Жим лежа/);
  assert.match(html, /Подтягивания/);
});

test('progress screen shows latest sets reps and weight correctly', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} />);

  assert.match(html, />4</);
  assert.match(html, />8</);
  assert.match(html, />80</);
});

test('progress screen keeps compact table-like layout', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} />);

  assert.match(html, /grid-cols-\[minmax\(0,1fr\)_56px_56px_56px\]/);
  assert.match(html, /Название упражнения/);
  assert.match(html, />Подход</);
  assert.match(html, />Повтор</);
  assert.match(html, />Вес</);
});

test('progress screen keeps exercise name column wide enough for mobile wrapping', () => {
  const html = renderToStaticMarkup(
    <WorkoutProgressList
      rows={[
        {
          exerciseGroupKey: 'split-squat',
          exerciseName: 'Болгарские сплит-приседания с гантелями',
          latestSets: 4,
          latestReps: 15,
          latestWeight: 60,
          setsTrend: 'up',
          repsTrend: 'up',
          weightTrend: 'up',
          lastDate: '2026-04-06',
        },
      ]}
    />,
  );

  assert.match(html, /min-w-0 py-4 pr-2/);
  assert.match(html, /\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(html, /78px_78px_78px/);
});

test('up trend renders correct indicator', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} />);

  assert.match(html, /Рост показателя/);
});

test('down trend renders correct indicator', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} />);

  assert.match(html, /Снижение показателя/);
});

test('return trend renders orange bar indicator', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} />);

  assert.match(html, /data-trend="return"/);
  assert.match(html, /Возврат к базовому уровню/);
});

test('neutral trend renders no indicator', () => {
  const html = renderToStaticMarkup(
    <WorkoutProgressList
      rows={[
        {
          exerciseGroupKey: 'neutral',
          exerciseName: 'Супермен',
          latestSets: 2,
          latestReps: 20,
          latestWeight: 5,
          setsTrend: 'neutral',
          repsTrend: 'neutral',
          weightTrend: 'neutral',
          lastDate: '2026-04-05',
        },
      ]}
    />,
  );

  assert.doesNotMatch(html, /Рост показателя/);
  assert.doesNotMatch(html, /Снижение показателя/);
  assert.doesNotMatch(html, /data-trend="return"/);
});

test('empty state renders when month has no data', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={[]} isLoading={false} />);

  assert.match(html, /За выбранный месяц нет тренировочных данных/);
});
