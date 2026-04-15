import test from 'node:test';
import assert from 'node:assert/strict';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkoutExerciseProgressView from '../WorkoutExerciseProgressView';

const baseProps = {
  exerciseName: 'Жим лежа',
  periodLabel: 'апрель 2026',
  selectedMonthDate: '2026-04-01',
  minDate: '2026-01-01',
  maxDate: '2026-12-31',
  isCalendarOpen: false,
  isLoading: false,
  errorMessage: null,
  metricRows: [
    {
      date: '2026-04-12',
      entryId: 'entry-1',
      exerciseName: 'Жим лежа',
      sets: 4,
      reps: 8,
      metricValueLabel: '85 кг',
    },
    {
      date: '2026-04-05',
      entryId: 'entry-2',
      exerciseName: 'Жим лежа',
      sets: 3,
      reps: 10,
      metricValueLabel: '80 кг',
    },
  ],
  mediaGroups: [
    {
      date: '2026-04-12',
      items: [
        {
          id: 'media-1',
          user_id: 'user-1',
          exercise_id: 'exercise-1',
          workout_entry_id: 'entry-1',
          workout_date: '2026-04-12',
          file_path: 'user-1/exercise-1/file-1.jpg',
          file_type: 'image' as const,
          created_at: '2026-04-12T10:00:00.000Z',
          kind: 'image' as const,
          previewUrl: 'https://signed.example/file-1.jpg',
        },
      ],
    },
  ],
  viewerItem: null,
  onClose: () => {},
  onToggleCalendar: () => {},
  onMonthSelect: () => {},
  pickerRef: createRef<HTMLDivElement>(),
  onOpenMedia: () => {},
  onCloseViewer: () => {},
};

test('progress exercise screen renders metrics rows and separate media block', () => {
  const html = renderToStaticMarkup(<WorkoutExerciseProgressView {...baseProps} />);

  assert.match(html, /Прогресс упражнения/);
  assert.match(html, /Жим лежа/);
  assert.match(html, /85 кг/);
  assert.match(html, /Фото\/видео/);
  assert.match(html, /data-testid="progress-exercise-media-group-2026-04-12"/);
});

test('dates without media are omitted from media block while metrics stay visible', () => {
  const html = renderToStaticMarkup(<WorkoutExerciseProgressView {...baseProps} />);

  assert.match(html, /12\.04\.2026/);
  assert.match(html, /05\.04\.2026/);
  assert.equal((html.match(/data-testid=\"progress-exercise-media-group-/g) || []).length, 1);
});

test('tapping media can open viewer and closing returns to progress exercise screen contract', () => {
  const html = renderToStaticMarkup(
    <WorkoutExerciseProgressView
      {...baseProps}
      viewerItem={{ id: 'media-1', kind: 'image', previewUrl: 'https://signed.example/file-1.jpg' }}
    />,
  );

  assert.match(html, /aria-label="Открыть фото прогресса упражнения"/);
  assert.match(html, /aria-label="Закрыть просмотр медиа"/);
  assert.match(html, /Полноэкранный просмотр медиа упражнения/);
});
