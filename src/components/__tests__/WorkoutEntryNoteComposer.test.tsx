import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutEntryNoteComposer from '../WorkoutEntryNoteComposer';

test('entry note composer renders inline block above workout list', () => {
  const html = renderToStaticMarkup(
    <WorkoutEntryNoteComposer
      isOpen
      value="Заметка"
      onChange={() => {}}
      onCancel={() => {}}
      onSave={() => {}}
    />,
  );

  assert.match(html, /Добавить заметку/i);
  assert.match(html, /textarea/i);
  assert.match(html, /Отменить/i);
  assert.match(html, /ОК/i);
});

test('closed entry note composer renders nothing', () => {
  const html = renderToStaticMarkup(
    <WorkoutEntryNoteComposer
      isOpen={false}
      value=""
      onChange={() => {}}
      onCancel={() => {}}
      onSave={() => {}}
    />,
  );

  assert.equal(html, '');
});
