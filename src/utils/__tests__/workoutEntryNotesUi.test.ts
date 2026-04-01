import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorkoutEntryNotesById,
  pruneWorkoutEntryNoteSet,
} from '../workoutEntryNotesUi';

test('Workouts screen builds entryNotesById correctly for loaded workout entries', () => {
  const result = buildWorkoutEntryNotesById(
    ['entry-1', 'entry-2'],
    {
      'entry-1': 'Не форсировать последний подход',
      'entry-3': 'Чужая заметка',
    },
  );

  assert.deepEqual(result, {
    'entry-1': 'Не форсировать последний подход',
  });
});

test('Workouts note foundation ignores empty note text and prunes stale expanded ids', () => {
  const result = buildWorkoutEntryNotesById(
    ['entry-1', 'entry-2'],
    {
      'entry-1': '   ',
      'entry-2': 'Контроль траектории',
    },
  );
  const expanded = pruneWorkoutEntryNoteSet(['entry-2'], new Set(['entry-1', 'entry-2']));

  assert.deepEqual(result, {
    'entry-2': 'Контроль траектории',
  });
  assert.deepEqual(Array.from(expanded), ['entry-2']);
});
