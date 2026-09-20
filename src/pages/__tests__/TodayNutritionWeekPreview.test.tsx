import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Today from '../Today';
import NutritionWeekPreview from '../../components/NutritionWeekPreview';
import { nutritionWeekPreviewFixture } from '../../test/nutritionWeekPreviewFixture';

test('Today local preview displays dated Mon–Sun plan and four explicit food actions', () => {
  const fixture = nutritionWeekPreviewFixture();
  const html = renderToStaticMarkup(<MemoryRouter><Today currentUserId={fixture.scope.userId}
    weeklyPreview={{ today: fixture.today, weeks: fixture.weeks, source: 'catalog-preview' }} /></MemoryRouter>);
  for (const text of ['Активная неделя', 'Дни активной недели', 'План — это рекомендация', 'Fixture meal 3',
    'Съел(а) по плану', 'Съел(а) с изменениями', 'Не ел(а)', '+ Было что-то ещё',
    'Следующая неделя — предварительная', 'записи в дневник пока недоступны']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/aria-label="(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс) \d\d\.\d\d"/g) ?? []).length, 7);
  assert.doesNotMatch(html, /Fixture meal 10|Завершено|Выполнено/);
});

test('preview cannot reveal foreign-account meals or provisional week as active', () => {
  const { today, weeks } = nutritionWeekPreviewFixture();
  for (const currentUserId of [undefined, 'account-B']) {
    const html = renderToStaticMarkup(<NutritionWeekPreview currentUserId={currentUserId} today={today} weeks={weeks} source="demo" />);
    assert.match(html, /недоступен/);
    assert.doesNotMatch(html, /Fixture meal/);
  }
  const html = renderToStaticMarkup(<NutritionWeekPreview currentUserId="account-A" today={today}
    weeks={{ ...weeks, active: weeks.provisional }} source="demo" />);
  assert.match(html, /недоступен/);
});

test('missing actual catalog day stays empty without borrowing demo meals', () => {
  const { today, weeks, scope } = nutritionWeekPreviewFixture();
  weeks.active.days[2].sourceDay = null;
  const html = renderToStaticMarkup(<NutritionWeekPreview currentUserId={scope.userId} today={today} weeks={weeks} source="catalog-preview" />);
  assert.match(html, /Блюда на этот день ещё не подготовлены/);
  assert.doesNotMatch(html, /Fixture meal|Съел\(а\) по плану/);
});

test('URL alone never enables preview without the development build flag', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/today?weeklyPreview=demo']}>
    <Today currentUserId="account-A" /></MemoryRouter>);
  assert.doesNotMatch(html, /Локальный предпросмотр|Дни активной недели/);
  assert.match(html, /Мой Поток/);
});
