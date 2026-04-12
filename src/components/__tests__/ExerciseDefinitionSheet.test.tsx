import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import ExerciseDefinitionSheet from '../ExerciseDefinitionSheet';
import type { Exercise } from '../../types/workout';

const exercise: Exercise = {
  id: 'exercise-1',
  name: 'Жим штанги стоя',
  category_id: 'shoulders',
  is_custom: false,
  description: 'Держите корпус ровно.',
  mistakes: 'Не отклоняйтесь назад.',
  primary_muscles: ['Дельты'],
  secondary_muscles: ['Трицепс'],
  muscle_map_image_url: 'https://example.com/muscles.png',
  media: [
    { type: 'image', url: 'https://example.com/image.png', order: 0 },
    { type: 'video', url: 'https://example.com/video.mp4', order: 1 },
  ],
};

test('exercise definition sheet renders read-only card content', () => {
  const html = renderToStaticMarkup(
    <ExerciseDefinitionSheet
      isOpen={true}
      exercise={exercise}
      onClose={() => {}}
      onAddToWorkout={() => {}}
    />,
  );

  assert.match(html, /Карточка упражнения/);
  assert.match(html, /Жим штанги стоя/);
  assert.match(html, /Добавить в тренировку/);
  assert.match(html, /Видео упражнения Жим штанги стоя/);
  assert.match(html, /Основные мышцы/);
});

test('exercise definition sheet keeps add button honest when exercise already selected', () => {
  const html = renderToStaticMarkup(
    <ExerciseDefinitionSheet
      isOpen={true}
      exercise={exercise}
      isSelected={true}
      onClose={() => {}}
      onAddToWorkout={() => {}}
    />,
  );

  assert.match(html, /Уже добавлено/);
  assert.match(html, /disabled=""/);
});
