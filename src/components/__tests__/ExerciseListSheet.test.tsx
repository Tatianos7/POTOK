import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import ExerciseListSheet, { addExerciseSelectionFromCard, toggleExerciseSelection } from '../ExerciseListSheet';
import type { Exercise, ExerciseCategory } from '../../types/workout';

const category: ExerciseCategory = {
  id: 'custom-exercises',
  name: 'Мои упражнения',
  order: 999,
};

const customExercise: Exercise = {
  id: 'custom-1',
  name: 'Мой жим',
  category_id: 'cat-1',
  is_custom: true,
  created_by_user_id: 'user-1',
  muscles: [{ id: 'm-1', name: 'Средний пучок' }],
};

const systemExercise: Exercise = {
  id: 'system-1',
  name: 'Жим лёжа',
  category_id: 'cat-2',
  is_custom: false,
  muscles: [{ id: 'm-2', name: 'Средний пучок' }],
};

test('custom exercise list no longer renders nested button structure', () => {
  const html = renderToStaticMarkup(
    <ExerciseListSheet
      isOpen={true}
      onClose={() => {}}
      category={category}
      exercises={[customExercise]}
      onExercisesSelect={() => {}}
      onEditExercise={() => {}}
    />,
  );

  assert.match(html, /Открыть карточку упражнения Мой жим/);
  assert.match(html, /Выбрать Мой жим/);
  assert.match(html, /Редактировать Мой жим/);
  assert.doesNotMatch(html, /<button[^>]*>\s*<button/i);
});

test('edit entry point remains renderable for custom exercise', () => {
  const html = renderToStaticMarkup(
    <ExerciseListSheet
      isOpen={true}
      onClose={() => {}}
      category={category}
      exercises={[customExercise]}
      onExercisesSelect={() => {}}
      onEditExercise={() => {}}
    />,
  );

  assert.match(html, /title="Редактировать упражнение"/);
  assert.match(html, /aria-label="Редактировать Мой жим"/);
});

test('custom exercise list no longer exposes delete entry point', () => {
  const html = renderToStaticMarkup(
    <ExerciseListSheet
      isOpen={true}
      onClose={() => {}}
      category={category}
      exercises={[customExercise]}
      onExercisesSelect={() => {}}
      onEditExercise={() => {}}
    />,
  );

  assert.doesNotMatch(html, /Удалить Мой жим/);
  assert.doesNotMatch(html, /Удалить упражнение/);
});

test('system exercise list behavior does not expose custom edit entry point', () => {
  const html = renderToStaticMarkup(
    <ExerciseListSheet
      isOpen={true}
      onClose={() => {}}
      category={category}
      exercises={[systemExercise]}
      onExercisesSelect={() => {}}
    />,
  );

  assert.doesNotMatch(html, /Редактировать Жим лёжа/);
  assert.doesNotMatch(html, /Удалить Жим лёжа/);
});

test('checkbox selection contract does not auto-open exercise card', () => {
  const next = toggleExerciseSelection(new Set<string>(), customExercise.id);
  assert.equal(next.has(customExercise.id), true);
  assert.equal(next.size, 1);
});

test('add to workout from exercise card keeps multi-select contract', () => {
  const initial = new Set<string>(['system-1']);
  const next = addExerciseSelectionFromCard(initial, customExercise.id);
  assert.deepEqual(Array.from(next).sort(), ['custom-1', 'system-1']);
});

test('add to workout from exercise card does not duplicate existing selection', () => {
  const initial = new Set<string>([customExercise.id]);
  const next = addExerciseSelectionFromCard(initial, customExercise.id);
  assert.deepEqual(Array.from(next), [customExercise.id]);
});
