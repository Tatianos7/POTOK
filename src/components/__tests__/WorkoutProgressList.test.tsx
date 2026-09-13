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
    latestMetricLabel: '80 кг',
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
    latestMetricLabel: 'св. вес',
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
  assert.match(html, />80 кг</);
});

test('progress screen keeps desktop table-like layout', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} />);

  assert.match(html, /sm:grid-cols-\[minmax\(0,1fr\)_56px_56px_56px\]/);
  assert.match(html, /Название упражнения/);
  assert.match(html, />Подход</);
  assert.match(html, />Повтор</);
  assert.match(html, />Метрика</);
});

test('progress screen uses mobile card layout so long exercise names do not break by letters', () => {
  const html = renderToStaticMarkup(
    <WorkoutProgressList
      rows={[
        {
          exerciseGroupKey: 'split-squat',
          exerciseName: 'Болгарские сплит-приседания с гантелями',
          latestSets: 4,
          latestReps: 15,
          latestWeight: 60,
          latestMetricLabel: '60 кг',
          setsTrend: 'up',
          repsTrend: 'up',
          weightTrend: 'up',
          lastDate: '2026-04-06',
        },
      ]}
    />,
  );

  assert.match(html, /block py-3/);
  assert.match(html, /grid grid-cols-3 gap-2 sm:contents/);
  assert.match(html, /min-w-0 break-words pb-3/);
  assert.doesNotMatch(html, /\[overflow-wrap:anywhere\]/);
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
          latestMetricLabel: '5 кг',
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

test('progress screen shows metric label instead of treating all metrics as weight', () => {
  const html = renderToStaticMarkup(
    <WorkoutProgressList
      rows={[
        {
          exerciseGroupKey: 'run',
          exerciseName: 'Беговая дорожка',
          latestSets: 1,
          latestReps: 1,
          latestWeight: 20,
          latestMetricLabel: '20 мин',
          setsTrend: 'neutral',
          repsTrend: 'neutral',
          weightTrend: 'up',
          lastDate: '2026-04-05',
        },
      ]}
    />,
  );

  assert.match(html, />Метрика</);
  assert.match(html, />20 мин</);
  assert.doesNotMatch(html, />Вес</);
});

test('empty state renders when month has no data', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={[]} isLoading={false} />);

  assert.match(html, /За выбранный месяц нет тренировочных данных/);
});

test('existing progress training screen can expose row action without breaking compact layout', () => {
  const html = renderToStaticMarkup(<WorkoutProgressList rows={rows} onRowSelect={() => {}} />);

  assert.match(html, /aria-label="Открыть прогресс упражнения Жим лежа"/);
  assert.match(html, /sm:grid-cols-\[minmax\(0,1fr\)_56px_56px_56px\]/);
});
