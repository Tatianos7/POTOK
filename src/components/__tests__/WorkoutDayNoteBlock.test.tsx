import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkoutDayNoteBlock from '../WorkoutDayNoteBlock';

test('existing day note is rendered on workout screen block', () => {
  const html = renderToStaticMarkup(
    <WorkoutDayNoteBlock
      note="Тренировка прошла тяжело, снизить объём в пятницу"
      onEdit={() => {}}
      onDelete={() => {}}
    />,
  );

  assert.match(html, /Заметка к тренировке/);
  assert.match(html, /Тренировка прошла тяжело/);
  assert.match(html, /workout-day-note-scroll-region/);
  assert.match(html, /max-h-32/);
  assert.match(html, /overflow-y-scroll/);
  assert.match(html, /scrollbar-gutter:stable/);
  assert.match(html, /justify-between/);
  assert.match(html, /Свернуть заметку тренировки/);
  assert.match(html, /Редактировать заметку тренировки/);
  assert.match(html, /Удалить заметку тренировки/);
  assert.match(html, /Скопировать заметку тренировки/);
});

test('workout day note block supports collapsed and expanded states', () => {
  const expandedHtml = renderToStaticMarkup(
    <WorkoutDayNoteBlock
      note="Длинная заметка для проверки"
      onEdit={() => {}}
      onDelete={() => {}}
      defaultExpanded
    />,
  );
  const collapsedHtml = renderToStaticMarkup(
    <WorkoutDayNoteBlock
      note="Длинная заметка для проверки"
      onEdit={() => {}}
      onDelete={() => {}}
      defaultExpanded={false}
    />,
  );

  assert.match(expandedHtml, /workout-day-note-scroll-region/);
  assert.match(expandedHtml, /Свернуть заметку тренировки/);
  assert.match(collapsedHtml, /Развернуть заметку тренировки/);
  assert.doesNotMatch(collapsedHtml, /workout-day-note-scroll-region/);
  assert.match(collapsedHtml, /Скопировать заметку тренировки/);
  assert.match(collapsedHtml, /Редактировать заметку тренировки/);
  assert.match(collapsedHtml, /Удалить заметку тренировки/);
});

test('no-note state remains clean for workout day note block', () => {
  const html = renderToStaticMarkup(
    <WorkoutDayNoteBlock
      note="   "
      onEdit={() => {}}
      onDelete={() => {}}
    />,
  );

  assert.equal(html, '');
});
