import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Today from '../Today';

const currentDir = dirname(fileURLToPath(import.meta.url));
const todaySource = readFileSync(resolve(currentDir, '../Today.tsx'), 'utf8');
const demoProviderSource = readFileSync(resolve(currentDir, '../../services/demoTodayPlansProvider.ts'), 'utf8');
const constantsSource = readFileSync(resolve(currentDir, '../../utils/constants.ts'), 'utf8');
const featuresSource = readFileSync(resolve(currentDir, '../../data/features.ts'), 'utf8');

function renderToday() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <Today />
    </MemoryRouter>
  );
}

test('/today renders polished paid entry structure', () => {
  const html = renderToday();

  assert.match(html, /Today/);
  assert.match(html, /План на день/);
  assert.match(html, /План на день, который ведёт вас к цели/);
  assert.match(html, /Идите самостоятельно в бесплатном POTOK/);
  assert.match(html, /подключите поддержку: AI, программу или тренера/);
  assert.match(html, /Бесплатный Progress/);
  assert.doesNotMatch(html, /Paid Today/);
  assert.doesNotMatch(html, /PAID TODAY/);
});

test('/today renders AI, Plans, and Coach directions', () => {
  const html = renderToday();

  assert.match(html, /POTOK AI/);
  assert.match(html, /Адаптивный план под вашу цель/);
  assert.match(html, /Питание и тренировки на день/);
  assert.match(html, /Готовые программы/);
  assert.match(html, /Готовый путь без тренера/);
  assert.match(html, /Ежедневные карточки в Today/);
  assert.match(html, /Персональный тренер/);
  assert.match(html, /План от проверенного специалиста/);
  assert.doesNotMatch(html, /verified coach/);
});

test('/today renders separate soon badges without CTA separator copy', () => {
  const html = renderToday();

  assert.match(html, /Скоро/);
  assert.match(html, /Подключить AI/);
  assert.match(html, /Смотреть программы/);
  assert.match(html, /Найти тренера/);
  assert.doesNotMatch(html, /· Скоро/);
});

test('/today keeps Plans card as demo entry point', () => {
  const html = renderToday();

  assert.match(html, /Готовые программы/);
  assert.match(html, /Смотреть программы/);
  assert.match(todaySource, /setPlansPreviewOpen/);
  assert.match(todaySource, /Открыть день в Today/);
  assert.match(todaySource, /Демо-превью/);
  assert.match(todaySource, /Что появится в Today/);
  assert.match(demoProviderSource, /Похудение дома · 7 дней/);
});

test('/today demo flow uses polished Russian copy', () => {
  assert.match(todaySource, /ДЕМО-ПЛАН/);
  assert.match(todaySource, /Это пример готовой программы/);
  assert.match(todaySource, /В демо действия не записываются в дневник/);
  assert.doesNotMatch(todaySource, /Демо Today/);
  assert.doesNotMatch(todaySource, /preview готовой программы/);
  assert.doesNotMatch(todaySource, /локальное состояние demo-плана/);
  assert.doesNotMatch(todaySource, /превращается в Today items/);
});

test('/today demo flow has Today item actions and safe routes', () => {
  assert.match(demoProviderSource, /Перейти в дневник/);
  assert.match(todaySource, /navigate\('\/nutrition'\)/);
  assert.match(demoProviderSource, /Начать тренировку/);
  assert.match(todaySource, /navigate\('\/workouts'\)/);
  assert.match(demoProviderSource, /Выполнено/);
  assert.match(todaySource, /Не подходит/);
  assert.match(todaySource, /updateTodayPlanItemStatus/);
});

test('/today does not render old free self-guided checklist copy', () => {
  const html = renderToday();

  assert.doesNotMatch(html, /Self-Guided/i);
  assert.doesNotMatch(html, /Самостоятельно/);
  assert.doesNotMatch(html, /Цель дня/);
  assert.doesNotMatch(html, /Питание в рамках цели/);
  assert.doesNotMatch(html, /Провести тренировку \/ активность/);
});

test('/today renders planned-vs-actual guardrail copy', () => {
  const html = renderToday();

  assert.match(html, /План ≠ запись в дневнике/);
  assert.match(html, /План не записывается в дневник автоматически/);
  assert.match(html, /В дневник попадает только то, что вы подтвердили или выполнили/);
});

test('/today source does not call diary, workout, or legacy coach runtime write paths', () => {
  assert.doesNotMatch(todaySource, /mealService/);
  assert.doesNotMatch(todaySource, /workoutService/);
  assert.doesNotMatch(todaySource, /uiRuntimeAdapter/);
  assert.doesNotMatch(todaySource, /CoachRequestModal/);
  assert.doesNotMatch(todaySource, /addMeal|saveMeal|updateWater|addExercisesToWorkout|completeToday|skipToday/);
  assert.doesNotMatch(demoProviderSource, /mealService|workoutService/);
  assert.doesNotMatch(demoProviderSource, /addMeal|saveMeal|updateWater|addExercisesToWorkout|completeToday|skipToday/);
});

test('/today source does not implement payment, AI generation, or coach marketplace', () => {
  assert.doesNotMatch(todaySource, /stripe|checkout|payment|subscribe/i);
  assert.doesNotMatch(todaySource, /generateDailyPlan|openai|aiGeneration/i);
  assert.doesNotMatch(todaySource, /trainerMarketplace|CoachNetwork/i);
});

test('home plan entry routes to /today', () => {
  assert.match(constantsSource, /route:\s*'\/today'/);
  assert.doesNotMatch(constantsSource, /route:\s*'\/plans'/);
  assert.match(featuresSource, /route:\s*'\/today'/);
  assert.doesNotMatch(featuresSource, /route:\s*'\/plan'/);
});
