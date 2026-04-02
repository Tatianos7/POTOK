import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDeletedWorkoutEntryNote,
  applySavedWorkoutEntryNote,
  buildWorkoutEntryNotesById,
  cancelWorkoutEntryNoteComposer,
  openWorkoutEntryNoteComposer,
  pruneWorkoutEntryNoteSet,
  toggleWorkoutEntryNoteExpanded,
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

test('entry note action opens inline note composer above workout list', () => {
  const result = openWorkoutEntryNoteComposer('entry-1', {
    'entry-1': 'Существующая заметка',
  });

  assert.deepEqual(result, {
    activeNoteEntryId: 'entry-1',
    draft: 'Существующая заметка',
  });
});

test('cancel closes inline composer without save', () => {
  assert.deepEqual(cancelWorkoutEntryNoteComposer(), {
    activeNoteEntryId: null,
    draft: '',
  });
});

test('save persists note under correct workout entry', () => {
  const result = applySavedWorkoutEntryNote(
    'entry-2',
    'Было тяжело на последнем подходе',
    { 'entry-1': 'Старая заметка' },
    new Set(['entry-1']),
  );

  assert.deepEqual(result.notesById, {
    'entry-1': 'Старая заметка',
    'entry-2': 'Было тяжело на последнем подходе',
  });
  assert.deepEqual(Array.from(result.expandedEntryIds).sort(), ['entry-1', 'entry-2']);
  assert.equal(result.activeNoteEntryId, null);
  assert.equal(result.draft, '');
});

test('expand collapse toggle works', () => {
  const expanded = toggleWorkoutEntryNoteExpanded('entry-1', new Set());
  const collapsed = toggleWorkoutEntryNoteExpanded('entry-1', expanded);

  assert.deepEqual(Array.from(expanded), ['entry-1']);
  assert.deepEqual(Array.from(collapsed), []);
});

test('note is deleted only for the confirmed workout entry', () => {
  const result = applyDeletedWorkoutEntryNote(
    'entry-2',
    {
      'entry-1': 'Оставить',
      'entry-2': 'Удалить',
    },
    new Set(['entry-1', 'entry-2']),
  );

  assert.deepEqual(result.notesById, {
    'entry-1': 'Оставить',
  });
  assert.deepEqual(Array.from(result.expandedEntryIds), ['entry-1']);
});
