import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Today from '../Today';
import NutritionWeekPreview from '../../components/NutritionWeekPreview';
import { nutritionWeekPreviewFixture } from '../../test/nutritionWeekPreviewFixture';
import { isAdaptiveNutritionRuntimeEnabled } from '../../services/adaptiveNutritionPersistenceService';
import { shouldUseAdaptiveNutritionReadOnlyEntry } from '../../services/adaptiveNutritionReadOnlyEntry';

test('Today local preview displays dated Mon–Sun plan and four explicit food actions', () => {
  assert.equal(isAdaptiveNutritionRuntimeEnabled(), false);
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
  assert.doesNotMatch(html, /Питание \+ тренировки|14 дней/);
  const todaySource = readFileSync(new URL('../Today.tsx', import.meta.url), 'utf8');
  assert.match(todaySource, /return <Navigate to="\/paywall" replace \/>;/);
});

test('development QA preview uses the weekly UI in strict read-only mode', () => {
  const { today, weeks, scope } = nutritionWeekPreviewFixture();
  const html = renderToStaticMarkup(<NutritionWeekPreview currentUserId={scope.userId}
    today={today} weeks={weeks} source="demo" readOnly />);
  assert.match(html, /Локальный предпросмотр · демо/);
  assert.match(html, /Активная неделя/);
  assert.equal((html.match(/aria-label="(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс) \d\d\.\d\d"/g) ?? []).length, 7);
  assert.match(html, /Fixture meal 3/);
  assert.match(html, /режим просмотра без действий/);
  assert.doesNotMatch(html,
    /Съел\(а\) по плану|Съел\(а\) с изменениями|Не ел\(а\)|Было что-то ещё|Как проходит день\?|Заменить блюдо|Отменить отметку/);

  const todaySource = readFileSync(new URL('../Today.tsx', import.meta.url), 'utf8');
  assert.match(todaySource,
    /isLocalDevelopment[\s\S]*weeklyPreview'\) === 'demo'[\s\S]*source="demo" readOnly/);
});

test('adaptive read-only entry requires both verified Premium and the independent read gate', () => {
  assert.equal(shouldUseAdaptiveNutritionReadOnlyEntry(false, false), false);
  assert.equal(shouldUseAdaptiveNutritionReadOnlyEntry(false, true), false);
  assert.equal(shouldUseAdaptiveNutritionReadOnlyEntry(true, false), false);
  assert.equal(shouldUseAdaptiveNutritionReadOnlyEntry(true, true), true);
});

test('verified Premium with default-OFF read gate fails closed without legacy Today', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/today?demoGoal=1']}>
    <Today currentUserId="10000000-0000-4000-8000-000000000001" verifiedPremium />
  </MemoryRouter>);
  assert.match(html, /Персональный недельный план сейчас недоступен/);
  assert.doesNotMatch(html, /Питание \+ тренировки|14 дней/);
  assert.doesNotMatch(html, /Загружаем подтверждённый недельный план/);
});

test('explicit demo entitlement renders seven-day read-only preview without legacy plans', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/today?weeklyPreview=demo']}>
    <Today currentUserId="10000000-0000-4000-8000-000000000001" demoPremiumAccess />
  </MemoryRouter>);
  assert.match(html, /Локальный предпросмотр · демо/);
  assert.equal((html.match(/aria-label="(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс) \d\d\.\d\d"/g) ?? []).length, 7);
  assert.doesNotMatch(html, /14 дней|Съел\(а\)|Не ел\(а\)|Было что-то ещё|Заменить блюдо/);
});
