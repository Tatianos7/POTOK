import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Today from '../Today';
import { getHomeFeatureCards } from '../../utils/constants';

const currentDir = dirname(fileURLToPath(import.meta.url));
const todaySource = readFileSync(resolve(currentDir, '../Today.tsx'), 'utf8');
const demoProviderSource = readFileSync(resolve(currentDir, '../../services/demoTodayPlansProvider.ts'), 'utf8');
const smartDayProviderSource = readFileSync(resolve(currentDir, '../../services/demoSmartDayProvider.ts'), 'utf8');

function renderToday(route = '/today') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <Today />
    </MemoryRouter>
  );
}

test('/today renders My Potok as the primary premium hub', () => {
  const html = renderToday();

  assert.match(html, /Мой Поток/);
  assert.match(todaySource, /Ваше питание, тренировки и рекомендации на сегодня/);
  assert.doesNotMatch(html, /Smart Day/);
  assert.doesNotMatch(html, /Соберите день под состояние/);
  assert.doesNotMatch(html, /Похудение дома · 7 дней/);
});

test('/today renders clean no-goal empty state by default', () => {
  const html = renderToday();

  assert.match(html, /Мой Поток/);
  assert.match(html, /Рассчитайте свою цель/);
  assert.match(html, /и здесь появится ваш план/);
  assert.match(html, /Рассчитать цель/);
  assert.match(html, /Создать замеры/);
  assert.doesNotMatch(html, /TODAY Premium/i);
  assert.doesNotMatch(html, /Показать демо планов/);
  assert.doesNotMatch(html, /План ≠ запись в дневнике/);
  assert.doesNotMatch(html, /План не записывается/);
  assert.doesNotMatch(html, /Рассчитайте цель — здесь появятся ваши планы/);
  assert.doesNotMatch(html, /POTOK подберёт питание и тренировки под вашу цель, режим и уровень/);
  assert.doesNotMatch(html, /Ваши планы на 14 дней/);
  assert.doesNotMatch(html, /Питание \+ тренировки/);
  assert.doesNotMatch(html, /Питание без сложной готовки/);
  assert.doesNotMatch(html, /Тренировки дома/);
  assert.doesNotMatch(html, /Быстрое питание и короткие тренировки/);
  assert.doesNotMatch(html, /Нет времени/);
  assert.doesNotMatch(html, /Список покупок/);
});

test('/today no-goal source uses centered title and fixed bottom actions', () => {
  assert.match(todaySource, /whitespace-nowrap text-center/);
  assert.match(todaySource, /fixed inset-x-0 bottom-0/);
  assert.match(todaySource, /fullWidth align="center"/);
});

test('/today empty state routes to goal and measurements screens', () => {
  assert.match(todaySource, /navigate\('\/goal'\)/);
  assert.match(todaySource, /navigate\('\/measurements'\)/);
});

test('/today existing-goal state shows goal summary, progress, edit actions, and plans', () => {
  const html = renderToday('/today?demoGoal=1');

  assert.match(html, /Мой Поток/);
  assert.match(html, /Похудение/);
  assert.match(html, /70 кг/);
  assert.match(html, /●/);
  assert.match(html, /50 кг/);
  assert.doesNotMatch(html, /70 → 50 кг/);
  assert.match(html, /Дополните данные, чтобы POTOK точнее подобрал план/);
  assert.match(html, /Дополнить данные/);
  assert.match(html, /Изменить цель/);
  assert.doesNotMatch(html, /Редактировать цель/);
  assert.match(html, /Создать замеры/);
  assert.match(html, /Питание \+ тренировки/);
  assert.match(html, /Питание без сложной готовки/);
  assert.match(html, /Тренировки дома/);
  assert.match(html, /Быстрое питание и короткие тренировки/);
  assert.doesNotMatch(html, /Ваши планы на 14 дней/);
  assert.doesNotMatch(html, /Выберите mock-план/);
  assert.doesNotMatch(html, /План ≠ запись в дневнике/);
  assert.doesNotMatch(html, /План не записывается/);
});

test('/today existing-goal polish uses calm goal label, compact rows, and compact bottom actions', () => {
  assert.match(todaySource, /text-lg font-semibold leading-6 text-stone-900">\{goalLabel\}/);
  assert.match(todaySource, /rounded-lg border border-stone-200 bg-white px-3 py-2/);
  assert.match(todaySource, /variant="primary" size="md" fullWidth/);
  assert.match(todaySource, /pb-56/);
  assert.doesNotMatch(todaySource, /text-2xl font-semibold leading-7 text-stone-950">\{goalLabel\}/);
});

test('/today progress marker position follows current weight between start and target', () => {
  const startHtml = renderToday('/today?demoGoal=1');
  const midHtml = renderToday('/today?demoGoalMid=1');
  const targetHtml = renderToday('/today?demoGoalAtTarget=1');

  assert.match(startHtml, /left:8%/);
  assert.match(midHtml, /left:37%/);
  assert.match(midHtml, /63 кг/);
  assert.match(targetHtml, /left:92%/);
  assert.match(targetHtml, /50 кг/);
  assert.doesNotMatch(targetHtml, /70 → 50 кг/);
});

test('/today existing-goal state only shows current weight marker label when it differs from start and target', () => {
  const startHtml = renderToday('/today?demoGoal=1');
  const html = renderToday('/today?demoGoalNoCurrent=1');
  const targetHtml = renderToday('/today?demoGoalAtTarget=1');

  assert.match(html, /Похудение/);
  assert.match(html, /●/);
  assert.doesNotMatch(html, /70 кг/);
  assert.doesNotMatch(html, /Цель 50 кг/);
  assert.doesNotMatch(startHtml, /top-0[^>]*>70 кг/);
  assert.doesNotMatch(html, /top-0[^>]*>50 кг/);
  assert.doesNotMatch(targetHtml, /top-0[^>]*>50 кг/);
});

test('/today does not include subscription mutation or demo-access controls in My Potok UI', () => {
  assert.doesNotMatch(todaySource, /Выйти из демо Premium/);
  assert.doesNotMatch(todaySource, /updatePremiumStatus/);
  assert.doesNotMatch(todaySource, /profileService/);
});

test('/today demo goal state renders 14-day plan cards', () => {
  const html = renderToday('/today?demoGoal=1');

  assert.match(html, /Питание \+ тренировки/);
  assert.match(html, /Питание без сложной готовки/);
  assert.match(html, /Тренировки дома/);
  assert.match(html, /Быстрое питание и короткие тренировки/);
  assert.match(html, /14 дней/);
  assert.doesNotMatch(html, /Ваши планы на 14 дней/);
  assert.doesNotMatch(html, /Выберите mock-план/);
  assert.doesNotMatch(html, /<h3[^>]*>Нет времени<\/h3>/);
});

test('/today source supports selected plan preview and 14 days without showing all day details by default', () => {
  assert.match(todaySource, /type TodayView = 'home' \| 'plan_preview' \| 'day_preview'/);
  assert.match(todaySource, /setTodayView\('plan_preview'\)/);
  assert.match(todaySource, /setTodayView\('day_preview'\)/);
  assert.match(todaySource, /Array\.from\(\{ length: 14 \}/);
  assert.match(todaySource, /Выбрать план/);
  assert.match(todaySource, /Посмотреть дни/);
  assert.match(todaySource, /День \{day\.day\}/);
});

test('/today source renders compact day preview with calories, meals, workout, and shopping placeholder', () => {
  assert.match(todaySource, /1650 ккал · Б 120 · Ж 55 · У 160/);
  assert.match(todaySource, /Завтрак/);
  assert.match(todaySource, /Обед/);
  assert.match(todaySource, /Ужин/);
  assert.match(todaySource, /Перекус/);
  assert.match(todaySource, /Тренировка/);
  assert.match(todaySource, /Список покупок/);
  assert.match(todaySource, /disabled align="center"/);
});

test('/today does not render planned-vs-actual guardrail block anymore', () => {
  const html = renderToday('/today?demoGoal=1');
  const defaultHtml = renderToday();

  assert.doesNotMatch(html, /План ≠ запись в дневнике/);
  assert.doesNotMatch(html, /План не записывается/);
  assert.doesNotMatch(defaultHtml, /План ≠ запись в дневнике/);
  assert.doesNotMatch(defaultHtml, /План не записывается/);
  assert.doesNotMatch(todaySource, /План ≠ запись в дневнике/);
  assert.doesNotMatch(todaySource, /План не записывается/);
});

test('/today source keeps old demo providers available but outside primary My Potok flow', () => {
  assert.match(demoProviderSource, /Похудение дома · 7 дней/);
  assert.match(smartDayProviderSource, /buildDemoSmartDayPlan/);
  assert.doesNotMatch(todaySource, /getDemoTodayPrograms/);
  assert.doesNotMatch(todaySource, /buildDemoSmartDayPlan/);
});

test('/today source does not call diary, workout, payment, AI, Coach, or voice runtime paths', () => {
  assert.doesNotMatch(todaySource, /mealService/);
  assert.doesNotMatch(todaySource, /workoutService/);
  assert.doesNotMatch(todaySource, /uiRuntimeAdapter/);
  assert.doesNotMatch(todaySource, /addMeal|saveMeal|updateWater|addExercisesToWorkout|completeToday|skipToday/);
  assert.doesNotMatch(todaySource, /stripe|checkout|payment|subscribe/i);
  assert.doesNotMatch(todaySource, /generateDailyPlan|openai|aiGeneration/i);
  assert.doesNotMatch(todaySource, /trainerMarketplace|CoachNetwork|CoachRequestModal/i);
  assert.doesNotMatch(todaySource, /voice|голос/i);
});

test('premium Home entry still opens /today for My Potok', () => {
  const cards = getHomeFeatureCards({ hasPremium: true });
  const myPotok = cards.find((card) => card.title === 'Мой Поток');

  assert.ok(myPotok);
  assert.equal(myPotok.route, '/today');
});
