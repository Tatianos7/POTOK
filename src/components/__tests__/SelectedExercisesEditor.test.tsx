import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import SelectedExercisesEditor, { resolveMetricPickerPlacement } from '../SelectedExercisesEditor';
import type { Exercise } from '../../types/workout';
import { updateSelectedExerciseField, updateSelectedExerciseMetricType } from '../../utils/workoutEditorState';

const exercises: Exercise[] = [
  {
    id: 'exercise-1',
    name: 'Жим лёжа',
    category_id: 'chest',
    is_custom: false,
    muscles: [],
  },
];

test('weekly day-of-week planner controls are removed from workout create edit add flows', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={exercises}
      onSave={() => {}}
    />,
  );

  assert.doesNotMatch(html, /Выбрать день недели тренировки/);
  assert.doesNotMatch(html, /Сохранить на каждый/);
  assert.doesNotMatch(html, /saveForEachWeek/);
});

test('header is now a passive read label and not the metric selector source of truth', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'weight',
          sets: 3,
          reps: 12,
          weight: 20,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, />Метрика</);
  assert.match(html, /<span class="truncate">Вес<\/span>/);
  assert.doesNotMatch(html, />Метрика ▼</);
});

test('metric selector is rendered per row in edit flow', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'time',
          sets: 3,
          reps: 12,
          weight: 30,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /<span class="truncate">Время<\/span>/);
  assert.match(html, /<span class="truncate">сек<\/span>/);
});

test('row metric selector does not push value field into broken layout', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'time',
          metricUnit: 'сек',
          sets: 3,
          reps: 1,
          weight: 45,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /min-h-\[4\.35rem\]/);
  assert.match(html, /max-w-\[5\.5rem\]/);
  assert.match(html, /w-\[3\.25rem\]/);
});

test('last column keeps stable layout for metric selector, unit selector and value', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'distance',
          metricUnit: 'км',
          sets: 1,
          reps: 1,
          weight: 5,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /max-w-\[5\.5rem\]/);
  assert.match(html, /min-\[376px\]:max-w-\[6\.25rem\]/);
  assert.match(html, /flex items-center justify-center gap-1/);
});

test('row metric button renders visible label text', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'weight',
          sets: 3,
          reps: 12,
          weight: 20,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /<span class="truncate">Вес<\/span>/);
});

test('row metric button remains above value input', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'time',
          metricUnit: 'сек',
          sets: 3,
          reps: 1,
          weight: 45,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /grid min-h-\[4\.35rem\][\s\S]*?grid-rows-\[auto_1fr_auto\][\s\S]*?max-w-\[5\.5rem\][\s\S]*?Время[\s\S]*?value="45"/);
});

test('metric value field aligns horizontally with sets and reps value fields', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'weight',
          sets: 3,
          reps: 12,
          weight: 20,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.equal((html.match(/grid-rows-\[1fr_auto\]/g) || []).length, 2);
  assert.equal((html.match(/grid-rows-\[auto_1fr_auto\]/g) || []).length, 1);
  assert.match(html, /justify-items-end/);
  assert.match(html, /justify-items-center/);
  assert.equal((html.match(/self-end w-12 min-\[376px\]:w-14/g) || []).length, 2);
});

test('sets and reps inputs keep compact height after row alignment fix', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'weight',
          sets: 3,
          reps: 12,
          weight: 20,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.equal((html.match(/self-end w-12 min-\[376px\]:w-14 px-1\.5 min-\[376px\]:px-2 py-1 min-\[376px\]:py-1\.5/g) || []).length, 2);
  assert.match(html, /w-\[3\.25rem\] min-\[376px\]:w-14 px-1\.5 min-\[376px\]:px-2 py-1 min-\[376px\]:py-1\.5/);
});

test('last column uses stable two-row geometry without shifting row baseline', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'bodyweight',
          sets: 3,
          reps: 10,
          weight: 0,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /grid-rows-\[auto_1fr_auto\]/);
  assert.match(html, /self-start/);
  assert.match(html, /items-end justify-center self-end/);
  assert.equal((html.match(/self-end w-12 min-\[376px\]:w-14/g) || []).length, 2);
});

test('selected exercises editor keeps none metric rows stable', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'none',
          sets: 3,
          reps: 12,
          weight: 0,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /<span class="truncate">Без метрики<\/span>/);
  assert.match(html, /disabled=""/);
  assert.match(html, /value="0"/);
});

test('unit selector appears only for time and distance', () => {
  const timeHtml = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'time',
          metricUnit: 'мин',
          sets: 3,
          reps: 1,
          weight: 5,
        },
      ]}
      onSave={() => {}}
    />,
  );

  const weightHtml = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'weight',
          sets: 3,
          reps: 12,
          weight: 20,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(timeHtml, /<span class="truncate">мин<\/span>/);
  assert.doesNotMatch(weightHtml, /кг ▼/);
});

test('metric selection is independent per exercise row', () => {
  const nextItems = updateSelectedExerciseMetricType([
    {
      exercise: exercises[0],
      metricType: 'weight',
      sets: 3,
      reps: 12,
      weight: 30,
    },
    {
      exercise: {
        id: 'exercise-2',
        name: 'Бег',
        category_id: 'cardio',
        is_custom: false,
        muscles: [],
      },
      metricType: 'distance',
      metricUnit: 'км',
      sets: 1,
      reps: 1,
      weight: 5,
    },
  ], 1, 'time');

  assert.equal(nextItems[0].metricType, 'weight');
  assert.equal(nextItems[1].metricType, 'time');
});

test('changing one row metric does not affect other rows', () => {
  const nextItems = updateSelectedExerciseMetricType([
    {
      exercise: exercises[0],
      metricType: 'weight',
      sets: 3,
      reps: 12,
      weight: 20,
    },
    {
      exercise: {
        id: 'exercise-2',
        name: 'Бег',
        category_id: 'cardio',
        is_custom: false,
        muscles: [],
      },
      metricType: 'distance',
      metricUnit: 'м',
      sets: 1,
      reps: 1,
      weight: 400,
    },
  ], 0, 'none');

  assert.equal(nextItems[0].metricType, 'none');
  assert.equal(nextItems[0].weight, 0);
  assert.equal(nextItems[1].metricType, 'distance');
  assert.equal(nextItems[1].metricUnit, 'м');
});

test('time unit selection is independent per row', () => {
  const nextItems = updateSelectedExerciseField([
    {
      exercise: exercises[0],
      metricType: 'time',
      metricUnit: 'сек',
      sets: 3,
      reps: 1,
      weight: 30,
    },
    {
      exercise: {
        id: 'exercise-2',
        name: 'Планка',
        category_id: 'core',
        is_custom: false,
        muscles: [],
      },
      metricType: 'time',
      metricUnit: 'сек',
      sets: 3,
      reps: 1,
      weight: 2,
    },
  ], 1, 'metricUnit', 'мин');

  assert.equal(nextItems[0].metricUnit, 'сек');
  assert.equal(nextItems[1].metricUnit, 'мин');
});

test('distance unit selection is independent per row', () => {
  const nextItems = updateSelectedExerciseField([
    {
      exercise: exercises[0],
      metricType: 'distance',
      metricUnit: 'м',
      sets: 1,
      reps: 1,
      weight: 250,
    },
    {
      exercise: {
        id: 'exercise-2',
        name: 'Бег',
        category_id: 'cardio',
        is_custom: false,
        muscles: [],
      },
      metricType: 'distance',
      metricUnit: 'м',
      sets: 1,
      reps: 1,
      weight: 500,
    },
  ], 0, 'metricUnit', 'км');

  assert.equal(nextItems[0].metricUnit, 'км');
  assert.equal(nextItems[1].metricUnit, 'м');
});

test('popup repositions near right edge', () => {
  const placement = resolveMetricPickerPlacement(
    { left: 290, right: 314, top: 100, bottom: 124 },
    { width: 320, height: 640 },
    { width: 152, height: 220 },
  );

  assert.equal(placement.directionX, 'left');
  assert.ok(placement.left >= 8);
});

test('popup repositions near bottom edge', () => {
  const placement = resolveMetricPickerPlacement(
    { left: 140, right: 164, top: 560, bottom: 584 },
    { width: 320, height: 640 },
    { width: 152, height: 220 },
  );

  assert.equal(placement.directionY, 'up');
  assert.ok(placement.top >= 8);
});

test('popup stays within viewport on 320px and small-content case', () => {
  const placement = resolveMetricPickerPlacement(
    { left: 250, right: 274, top: 40, bottom: 64 },
    { width: 320, height: 320 },
    { width: 152, height: 220 },
  );

  assert.ok(placement.left >= 8);
  assert.ok(placement.top >= 8);
  assert.ok(placement.left + 152 <= 320);
  assert.ok(placement.top + 220 <= 320 || placement.directionY === 'up');
});

test('multi-exercise workout editor still renders all selected exercises', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'weight',
          sets: 3,
          reps: 12,
          weight: 20,
        },
        {
          exercise: {
            id: 'exercise-2',
            name: 'Планка',
            category_id: 'core',
            is_custom: false,
            muscles: [],
          },
          metricType: 'time',
          sets: 3,
          reps: 1,
          weight: 30,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.match(html, /Жим лёжа/);
  assert.match(html, /Планка/);
  assert.match(html, /<span class="truncate">Вес<\/span>/);
  assert.match(html, /<span class="truncate">Время<\/span>/);
});

test('mixed rows with different metric types remain visually stable', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'weight',
          sets: 3,
          reps: 12,
          weight: 20,
        },
        {
          exercise: {
            id: 'exercise-2',
            name: 'Планка',
            category_id: 'core',
            is_custom: false,
            muscles: [],
          },
          metricType: 'time',
          metricUnit: 'мин',
          sets: 3,
          reps: 1,
          weight: 2,
        },
        {
          exercise: {
            id: 'exercise-3',
            name: 'Бег',
            category_id: 'cardio',
            is_custom: false,
            muscles: [],
          },
          metricType: 'distance',
          metricUnit: 'км',
          sets: 1,
          reps: 1,
          weight: 5,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.equal((html.match(/max-w-\[5\.5rem\]/g) || []).length, 3);
  assert.ok((html.match(/min-h-\[4\.35rem\]/g) || []).length >= 3);
  assert.equal((html.match(/grid-rows-\[auto_1fr_auto\]/g) || []).length, 3);
});

test('time and distance unit selector do not break lower-row alignment', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: exercises[0],
          metricType: 'time',
          metricUnit: 'мин',
          sets: 3,
          reps: 1,
          weight: 5,
        },
        {
          exercise: {
            id: 'exercise-2',
            name: 'Бег',
            category_id: 'cardio',
            is_custom: false,
            muscles: [],
          },
          metricType: 'distance',
          metricUnit: 'км',
          sets: 1,
          reps: 1,
          weight: 5,
        },
      ]}
      onSave={() => {}}
    />,
  );

  assert.equal((html.match(/grid-rows-\[auto_1fr_auto\]/g) || []).length, 2);
  assert.equal((html.match(/items-end justify-center self-end/g) || []).length, 2);
});

test('header and footer remain fixed while only list area scrolls on long list', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={Array.from({ length: 8 }, (_, index) => ({
        exercise: {
          id: `exercise-${index + 1}`,
          name: `Упражнение ${index + 1}`,
          category_id: 'category',
          is_custom: false,
          muscles: [],
        },
        metricType: 'weight' as const,
        sets: 3,
        reps: 12,
        weight: 20,
      }))}
      onSave={() => {}}
      onAddExercise={() => {}}
    />,
  );

  assert.match(html, /h-\[min\(92dvh,42rem\)\]/);
  assert.match(html, /flex-shrink-0/);
  assert.match(html, /flex-1 min-h-0 overflow-hidden/);
  assert.match(html, /h-full min-h-\[14rem\] overflow-y-auto overflow-x-hidden overscroll-contain/);
  assert.match(html, /ДОБАВИТЬ УПРАЖНЕНИЕ/);
  assert.match(html, /СОХРАНИТЬ/);
});

test('layout stays stable on 320px width and with one exercise', () => {
  const html = renderToStaticMarkup(
    <SelectedExercisesEditor
      isOpen={true}
      onClose={() => {}}
      exercises={[]}
      initialSelectedExercises={[
        {
          exercise: {
            id: 'exercise-1',
            name: 'Очень длинное название упражнения для мобильного режима',
            category_id: 'category',
            is_custom: false,
            muscles: [],
          },
          metricType: 'distance',
          sets: 3,
          reps: 12,
          weight: 2,
        },
      ]}
      onSave={() => {}}
      onAddExercise={() => {}}
    />,
  );

  assert.match(html, /min-w-\[320px\]/);
  assert.match(html, /min-h-\[26rem\]/);
  assert.match(html, /h-full min-h-\[14rem\]/);
  assert.match(html, /self-end w-12 min-\[376px\]:w-14/);
  assert.match(html, /max-w-\[5\.5rem\]/);
  assert.match(html, /w-\[3\.25rem\]/);
  assert.match(html, /grid-rows-\[auto_1fr_auto\]/);
  assert.match(html, /<span class="truncate">Дист<\/span>/);
  assert.match(html, /<span class="truncate">км<\/span>/);
  assert.match(html, />Метрика</);
  assert.match(html, /ДОБАВИТЬ УПРАЖНЕНИЕ/);
  assert.match(html, /СОХРАНИТЬ/);
});
