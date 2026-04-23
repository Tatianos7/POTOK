import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutExerciseCardSheet, {
  WORKOUT_EXERCISE_CARD_SUCCESS_MESSAGE,
  buildWorkoutExerciseCardDraftMediaItems,
  getWorkoutExerciseCardMediaSectionOrder,
  getWorkoutExerciseCardViewerLabel,
  removeWorkoutExerciseCardDraftMedia,
} from '../WorkoutExerciseCardSheet';
import type { WorkoutEntry } from '../../types/workout';

const entry: WorkoutEntry = {
  id: 'entry-1',
  workout_day_id: 'day-1',
  exercise_id: 'exercise-1',
  metricType: 'time',
  metricUnit: 'сек',
  sets: 3,
  reps: 1,
  weight: 45,
  displayAmount: 45,
  displayUnit: 'сек',
  exercise: {
    id: 'exercise-1',
    name: 'Планка',
    category_id: 'core',
    is_custom: false,
    description: 'Держите корпус ровно.',
    mistakes: 'Не прогибайте поясницу.',
    primary_muscles: ['Пресс'],
    muscle_map_image_url: 'https://example.com/muscle-map.png',
    media: [
      { type: 'image', url: 'https://example.com/technique-image.png', order: 0 },
      { type: 'video', url: 'https://example.com/technique-video.mp4', order: 1 },
    ],
    muscles: [
      { id: 'muscle-1', name: 'Прямая мышца живота' },
    ],
  },
};

test('workout exercise card renders exercise title', () => {
  const html = renderToStaticMarkup(
    <WorkoutExerciseCardSheet
      isOpen={true}
      entry={entry}
      onClose={() => {}}
    />,
  );

  assert.match(html, /Карточка тренировки/);
  assert.match(html, /Планка/);
});

test('workout exercise card renders read-only technique and muscle content', () => {
  const html = renderToStaticMarkup(
    <WorkoutExerciseCardSheet
      isOpen={true}
      entry={entry}
      onClose={() => {}}
    />,
  );

  assert.match(html, /Моя тренировка/);
  assert.match(html, /Техника/);
  assert.match(html, /Техника видео Планка/);
  assert.match(html, /Основные работающие мышцы/);
  assert.match(html, /abs/);
  assert.match(html, /Второстепенные мышцы/);
  assert.match(html, /Ягодичные, Передние дельты/);
  assert.match(html, /Исходное положение/);
  assert.match(html, /Упритесь на предплечья и носки/);
  assert.match(html, /Ошибки/);
});

test('save button is disabled when no draft media is selected', () => {
  const html = renderToStaticMarkup(
    <WorkoutExerciseCardSheet
      isOpen={true}
      entry={entry}
      onClose={() => {}}
    />,
  );

  assert.match(html, /Загрузить фото\/видео/);
  assert.match(html, /Фото и видео для этого упражнения ещё не добавлены/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Сохранить/);
});

test('selecting local media adds draft items to workout exercise card', () => {
  const files = [
    new File(['img'], 'photo-1.jpg', { type: 'image/jpeg', lastModified: 1 }),
    new File(['vid'], 'video-1.mp4', { type: 'video/mp4', lastModified: 2 }),
  ];

  const items = buildWorkoutExerciseCardDraftMediaItems(files, (file) => `blob:${file.name}`);

  assert.equal(items.length, 2);
  assert.equal(items[0].kind, 'image');
  assert.equal(items[1].kind, 'video');
  assert.equal(items[0].previewUrl, 'blob:photo-1.jpg');
});

test('removing draft media updates local card state correctly', () => {
  const files = [
    new File(['img'], 'photo-1.jpg', { type: 'image/jpeg', lastModified: 1 }),
    new File(['vid'], 'video-1.mp4', { type: 'video/mp4', lastModified: 2 }),
  ];
  const revoked: string[] = [];
  const items = buildWorkoutExerciseCardDraftMediaItems(files, (file) => `blob:${file.name}`);

  const next = removeWorkoutExerciseCardDraftMedia(items, items[0].id, (url) => revoked.push(url));

  assert.equal(next.length, 1);
  assert.equal(next[0].label, 'video-1.mp4');
  assert.deepEqual(revoked, ['blob:photo-1.jpg']);
});

test('file name caption is not rendered under preview tile and local-only placeholder text is removed', () => {
  const html = renderToStaticMarkup(
    <WorkoutExerciseCardSheet
      isOpen={true}
      entry={entry}
      onClose={() => {}}
    />,
  );

  assert.doesNotMatch(html, /На этом шаге файлы живут только локально/);
  assert.doesNotMatch(html, /Сохранение в storage и базу ещё не подключено/);
  assert.doesNotMatch(html, /truncate px-3 py-2 text-xs/);
});

test('draft media preview renders only inside workout exercise card shell', () => {
  const html = renderToStaticMarkup(
    <WorkoutExerciseCardSheet
      isOpen={true}
      entry={entry}
      onClose={() => {}}
    />,
  );

  assert.match(html, /Моя тренировка/);
  assert.doesNotMatch(html, /workout-entry-row-media-preview/);
});

test('draft media section is rendered before persisted media section', () => {
  assert.deepEqual(getWorkoutExerciseCardMediaSectionOrder(true, true), ['draft', 'persisted']);
  assert.deepEqual(getWorkoutExerciseCardMediaSectionOrder(true, false), ['draft']);
  assert.deepEqual(getWorkoutExerciseCardMediaSectionOrder(false, true), ['persisted']);
});

test('viewer labels support both image and video media', () => {
  assert.equal(getWorkoutExerciseCardViewerLabel('image'), 'Открыть фото упражнения');
  assert.equal(getWorkoutExerciseCardViewerLabel('video'), 'Открыть видео упражнения');
  const html = renderToStaticMarkup(
    <WorkoutExerciseCardSheet
      isOpen={true}
      entry={entry}
      onClose={() => {}}
    />,
  );

  assert.doesNotMatch(html, /aria-label="Закрыть просмотр медиа"/);
});

test('successful save keeps success feedback without auto-close contract', () => {
  assert.equal(WORKOUT_EXERCISE_CARD_SUCCESS_MESSAGE, 'Сохранено');
});

test('custom workout exercise card skips empty fallback sections', () => {
  const html = renderToStaticMarkup(
    <WorkoutExerciseCardSheet
      isOpen={true}
      entry={{
        ...entry,
        exercise_id: 'custom-exercise-1',
        exercise: {
          id: 'custom-exercise-1',
          name: 'Моё упражнение',
          category_id: 'custom',
          is_custom: true,
          description: 'Держите корпус ровно.',
          mistakes: '',
          muscles: [{ id: 'm-1', name: 'Средние дельты' }],
        },
      }}
      onClose={() => {}}
    />,
  );

  assert.match(html, /Моё упражнение/);
  assert.match(html, /Основные работающие мышцы/);
  assert.match(html, /Средние дельты/);
  assert.match(html, /Техника/);
  assert.match(html, /Описание упражнения/);
  assert.doesNotMatch(html, /Моя тренировка/);
  assert.doesNotMatch(html, /Загрузить фото\/видео/);
  assert.doesNotMatch(html, /Фото и видео для этого упражнения ещё не добавлены/);
  assert.doesNotMatch(html, /Второстепенные мышцы/);
  assert.doesNotMatch(html, /Не указаны/);
  assert.doesNotMatch(html, /Описание техники пока не заполнено/);
  assert.doesNotMatch(html, /Рекомендации пока не заполнены/);
  assert.doesNotMatch(html, /Сохранить/);
});
