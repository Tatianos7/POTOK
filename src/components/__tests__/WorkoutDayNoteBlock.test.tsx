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
  assert.match(html, /Редактировать заметку тренировки/);
  assert.match(html, /Удалить заметку тренировки/);
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
