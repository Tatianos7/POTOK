import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutEntryInlineNote from '../WorkoutEntryInlineNote';

test('entry note collapsed and expanded states render correctly', () => {
  const expandedHtml = renderToStaticMarkup(
    <WorkoutEntryInlineNote
      note="Было сложно на последнем подходе"
      isExpanded
      onToggle={() => {}}
      onRequestDelete={() => {}}
      onConfirmDelete={() => {}}
      onCancelDelete={() => {}}
    />,
  );
  const collapsedHtml = renderToStaticMarkup(
    <WorkoutEntryInlineNote
      note="Было сложно на последнем подходе"
      isExpanded={false}
      onToggle={() => {}}
      onRequestDelete={() => {}}
      onConfirmDelete={() => {}}
      onCancelDelete={() => {}}
    />,
  );

  assert.match(expandedHtml, /Было сложно на последнем подходе/);
  assert.match(expandedHtml, /Удалить заметку/);
  assert.match(expandedHtml, /Свернуть заметку/);
  assert.doesNotMatch(collapsedHtml, /Было сложно на последнем подходе/);
  assert.match(collapsedHtml, /Развернуть заметку/);
});

test('delete note confirm opens correctly', () => {
  const html = renderToStaticMarkup(
    <WorkoutEntryInlineNote
      note="Текст"
      isExpanded
      isDeleteConfirmOpen
      onToggle={() => {}}
      onRequestDelete={() => {}}
      onConfirmDelete={() => {}}
      onCancelDelete={() => {}}
    />,
  );

  assert.match(html, /Удалить заметку\?/);
  assert.match(html, /Да/);
  assert.match(html, /Нет/);
});
