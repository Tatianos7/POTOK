import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import SelectedExercisesEditor from '../SelectedExercisesEditor';
import type { Exercise } from '../../types/workout';

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
