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
  assert.match(html, /\/exercises\/shoulders\/standing_barbell_press\.png/);
  assert.doesNotMatch(html, /Видео упражнения Жим штанги стоя/);
  assert.doesNotMatch(html, /https:\/\/example\.com\/video\.mp4/);
  assert.match(html, /Основные мышцы/);
  assert.match(html, /Карта мышц/);
  assert.match(html, /data-muscle-map=/);
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

test('custom exercise definition sheet skips empty fallback sections', () => {
  const html = renderToStaticMarkup(
    <ExerciseDefinitionSheet
      isOpen={true}
      exercise={{
        id: 'custom-1',
        name: 'Моё упражнение',
        category_id: 'custom',
        is_custom: true,
        description: '',
        mistakes: '',
        muscles: [{ id: 'm-1', name: 'Средние дельты' }],
      }}
      onClose={() => {}}
      onAddToWorkout={() => {}}
    />,
  );

  assert.match(html, /Основные мышцы/);
  assert.match(html, /Средние дельты/);
  assert.doesNotMatch(html, /Второстепенные мышцы/);
  assert.doesNotMatch(html, /Не указаны/);
  assert.doesNotMatch(html, /Описание техники пока не заполнено/);
  assert.doesNotMatch(html, /Рекомендации пока не заполнены/);
});

test('custom exercise definition sheet labels description without duplicated technique heading', () => {
  const html = renderToStaticMarkup(
    <ExerciseDefinitionSheet
      isOpen={true}
      exercise={{
        id: 'custom-2',
        name: 'Моё упражнение с описанием',
        category_id: 'custom',
        is_custom: true,
        description: 'Держите корпус ровно.',
        mistakes: '',
        muscles: [{ id: 'm-1', name: 'Средние дельты' }],
      }}
      onClose={() => {}}
      onAddToWorkout={() => {}}
    />,
  );

  assert.match(html, /Описание упражнения/);
  assert.equal((html.match(/Техника/g) ?? []).length, 1);
});

test('exercise definition sheet keeps clean empty states for missing local content', () => {
  const html = renderToStaticMarkup(
    <ExerciseDefinitionSheet
      isOpen={true}
      exercise={{
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Unknown movement',
        category_id: 'unknown',
        is_custom: false,
        description: '',
        mistakes: '',
        primary_muscles: ['Unknown muscle'],
        secondary_muscles: [],
        media: [
          { type: 'image', url: 'https://example.com/fallback-image.png', order: 0 },
          { type: 'video', url: 'https://example.com/fallback-video.mp4', order: 1 },
        ],
      }}
      onClose={() => {}}
      onAddToWorkout={() => {}}
    />,
  );

  assert.match(html, /Unknown movement/);
  assert.match(html, /https:\/\/example\.com\/fallback-image\.png/);
  assert.doesNotMatch(html, /fallback-video\.mp4/);
  assert.match(html, /Описание техники пока не заполнено/);
  assert.doesNotMatch(html, /Второстепенные мышцы/);
  assert.doesNotMatch(html, /Карта мышц/);
});
