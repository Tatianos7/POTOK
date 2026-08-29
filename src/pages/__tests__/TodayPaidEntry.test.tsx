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

test('/today default mode keeps demoPlans and gates staging reads behind feature flag', () => {
  const html = renderToday('/today?demoGoal=1');

  assert.match(html, /Питание \+ тренировки/);
  assert.match(html, /Питание без сложной готовки/);
  assert.match(todaySource, /const activePlans = usesCatalogPlanSource \? catalogPlans \?\? demoPlans : demoPlans/);
  assert.match(todaySource, /if \(!isPremiumCatalogStagingReadMode\(\)\)/);
  assert.match(todaySource, /setCatalogPlans\(null\)/);
});

test('/today staging readonly mode loads plan list and detail through premium catalog service', () => {
  assert.match(todaySource, /isPremiumCatalogStagingReadMode/);
  assert.match(todaySource, /premiumCatalogService\.getActivePremiumPlans\(\)/);
  assert.match(todaySource, /premiumCatalogService\.getPremiumPlanDetail\(plan\.id\)/);
  assert.match(todaySource, /buildTodayPlanFromPremiumCatalog/);
  assert.match(todaySource, /detailResult\.data\.days\.length === 0/);
  assert.match(todaySource, /mappedPlans\.length === 0/);
  assert.match(todaySource, /setCatalogPlans\(mappedPlans\)/);
});

test('/today staging catalog source is limited to plan list and plan detail views', () => {
  assert.match(todaySource, /const usesCatalogPlanSource = todayView === 'home' \|\| todayView === 'plan_detail'/);
  assert.match(todaySource, /const activePlans = usesCatalogPlanSource \? catalogPlans \?\? demoPlans : demoPlans/);
  assert.doesNotMatch(todaySource, /getPremiumMealSlots|getMealRecipeOptions|getPremiumRecipeDetail|buildDerivedShoppingList/);
});

test('/today staging readonly plan detail can render only returned day 1 and day 2 from adapter shape', () => {
  assert.match(todaySource, /selectedPlan\.days\.map\(\(day\) =>/);
  assert.match(todaySource, /openDay\(day\.day\)/);
  assert.match(todaySource, /nextPlan\.days\.some\(\(day\) => day\.day === currentDay\)/);
  assert.doesNotMatch(todaySource, /Array\.from\(\{ length: selectedPlan\.durationDays \}/);
});

test('/today staging read failures and empty catalog fall back to demoPlans without technical UI errors', () => {
  assert.match(todaySource, /catch \{/);
  assert.match(todaySource, /setCatalogPlans\(null\)/);
  assert.match(todaySource, /!plansResult\.ok \|\| plansResult\.data\.length === 0/);
  assert.doesNotMatch(todaySource, /read_failed|supabase_unavailable|ошибка загрузки|technical/i);
});

test('/today source supports selected plan detail and 14 compact day rows', () => {
  assert.match(
    todaySource,
    /type TodayView = 'home' \| 'plan_detail' \| 'day_detail' \| 'meal_detail' \| 'replace_meal' \| 'shopping_list'/
  );
  assert.match(todaySource, /setTodayView\('plan_detail'\)/);
  assert.match(todaySource, /Array\.from\(\{ length: 14 \}/);
  assert.match(todaySource, /Выбрать план/);
  assert.match(todaySource, /День \{day\.day\}/);
  assert.match(todaySource, /openDay\(day\.day\)/);
  assert.match(todaySource, /setTodayView\('day_detail'\)/);
  assert.doesNotMatch(todaySource, /setTodayView\('day_preview'\)/);
  assert.doesNotMatch(todaySource, /Посмотреть дни/);
});

test('/today plan row click opens the clean 14-day plan detail view', () => {
  assert.match(todaySource, /onClick=\{\(\) => openPlan\(plan\.id\)\}/);
  assert.match(todaySource, /setSelectedPlanId\(planId\)/);
  assert.match(todaySource, /setTodayView\('plan_detail'\)/);
});

test('/today plan detail shows selected plan, CTA, and days 1-14 without expanded meals', () => {
  const html = renderToday('/today?demoGoal=1&planDetail=nutrition-training-home-start');

  assert.match(html, /Питание \+ тренировки/);
  assert.match(html, /14 дней/);
  assert.match(html, /Дом · простой старт/);
  assert.match(html, /Питание и тренировки на 14 дней/);
  assert.match(html, /Выбрать план/);
  assert.match(html, /День 1/);
  assert.match(html, /День 14/);
  assert.match(html, /1650 ккал · Б 120 · Ж 55 · У 160/);
  assert.match(html, /Питание \+ тренировка/);
  assert.doesNotMatch(html, /Завтрак/);
  assert.doesNotMatch(html, /Обед/);
  assert.doesNotMatch(html, /Ужин/);
  assert.doesNotMatch(html, /Перекус/);
  assert.doesNotMatch(html, /Список покупок/);
  assert.doesNotMatch(html, /без записи в дневник/);
});

test('/today plan detail keeps clean navigation back to My Potok plan list', () => {
  const html = renderToday('/today?demoGoal=1&planDetail=simple-food-no-hard-cooking');

  assert.match(html, /aria-label="Назад"/);
  assert.match(html, /aria-label="Закрыть"/);
  assert.match(todaySource, /onClick=\{\(\) => setTodayView\('home'\)\}/);
  assert.doesNotMatch(html, /Ваши планы на 14 дней/);
  assert.doesNotMatch(html, /План ≠ запись в дневнике/);
  assert.doesNotMatch(html, /План не записывается/);
});

test('/today clicking day row opens day detail view by local state contract', () => {
  assert.match(todaySource, /const openDay = \(day: number\) =>/);
  assert.match(todaySource, /setSelectedDay\(day\)/);
  assert.match(todaySource, /setTodayView\('day_detail'\)/);
  assert.match(todaySource, /onClick=\{\(\) => openDay\(day\.day\)\}/);
});

test('/today day detail shows day title, macros, meals, workout, and day state options', () => {
  const html = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1');

  assert.match(html, /День 1/);
  assert.match(html, /1650 ккал/);
  assert.match(html, /Б 120 · Ж 55 · У 160/);
  assert.match(html, /Завтрак/);
  assert.match(html, /Овсянка, банан, йогурт/);
  assert.match(html, /410 ккал/);
  assert.match(html, /Обед/);
  assert.match(html, /Курица, рис, овощи/);
  assert.match(html, /520 ккал/);
  assert.match(html, /Ужин/);
  assert.match(html, /Рыба, салат/);
  assert.match(html, /430 ккал/);
  assert.match(html, /Перекус/);
  assert.match(html, /Творог, ягоды/);
  assert.match(html, /290 ккал/);
  assert.match(html, /Тренировка дома/);
  assert.match(html, /25 минут/);
  assert.match(html, /Ноги и ягодицы/);
  assert.match(html, /Состояние дня/);
  assert.match(html, /Обычный день/);
  assert.match(html, /Нет сил/);
  assert.match(html, /Нет времени/);
  assert.match(html, /Готова работать/);
  assert.match(html, /Список покупок/);
  assert.match(html, /Подтвердить день/);
});

test('/today clicking meal row opens meal detail view by local state contract', () => {
  assert.match(todaySource, /const openMeal = \(mealTitle: string\) =>/);
  assert.match(todaySource, /setSelectedMealTitle\(mealTitle\)/);
  assert.match(todaySource, /setTodayView\('meal_detail'\)/);
  assert.match(todaySource, /onClick=\{\(\) => openMeal\(meal\.title\)\}/);
});

test('/today shopping list opens from day detail by local state contract', () => {
  assert.match(todaySource, /const openShoppingList = \(\) =>/);
  assert.match(todaySource, /setTodayView\('shopping_list'\)/);
  assert.match(todaySource, /onClick=\{openShoppingList\}[\s\S]*Список покупок/);
  assert.doesNotMatch(todaySource, /variant="outline" size="sm" disabled fullWidth align="center"[\s\S]*Список покупок/);
});

test('/today shopping list shows periods, helper, groups, and one-day products', () => {
  const html = renderToday('/today?demoGoal=1&shoppingList=1');

  assert.match(html, /Список покупок/);
  assert.match(html, /1 день/);
  assert.match(html, /2 дня/);
  assert.match(html, /3 дня/);
  assert.match(html, /7 дней/);
  assert.match(html, /Выберите дни, для которых собрать продукты/);
  assert.match(html, /Белок/);
  assert.match(html, /Овощи/);
  assert.match(html, /Крупы/);
  assert.match(html, /Молочные/);
  assert.match(html, /Фрукты/);
  assert.match(html, /Другое/);
  assert.match(html, /Курица/);
  assert.match(html, /200 г/);
  assert.match(html, /Рыба/);
  assert.match(html, /150 г/);
  assert.match(html, /Творог/);
  assert.match(html, /Овощи/);
  assert.match(html, /Салат/);
  assert.match(html, /Рис/);
  assert.match(html, /80 г/);
  assert.match(html, /Овсянка/);
  assert.match(html, /50 г/);
  assert.match(html, /Банан/);
  assert.match(html, /1 шт/);
  assert.match(html, /Йогурт/);
  assert.match(html, /150 г/);
});

test('/today shopping list aggregates mock products by selected period without duplicates', () => {
  const twoDayHtml = renderToday('/today?demoGoal=1&shoppingList=1&shoppingPeriod=2');
  const sevenDayHtml = renderToday('/today?demoGoal=1&shoppingList=1&shoppingPeriod=7');

  assert.match(twoDayHtml, /Курица/);
  assert.match(twoDayHtml, /400 г/);
  assert.match(twoDayHtml, /Банан/);
  assert.match(twoDayHtml, /2 шт/);
  assert.equal((twoDayHtml.match(/Банан/g) ?? []).length, 1);
  assert.match(sevenDayHtml, /1400 г/);
  assert.match(sevenDayHtml, /7 шт/);
});

test('/today shopping list checkboxes toggle local bought state and back returns to day detail', () => {
  const html = renderToday('/today?demoGoal=1&shoppingList=1');

  assert.match(html, /type="checkbox"/);
  assert.match(todaySource, /checked=\{isBought\}/);
  assert.match(todaySource, /onChange=\{\(\) => toggleBoughtProduct\(productKey\)\}/);
  assert.match(todaySource, /setBoughtProducts\(\(current\) =>/);
  assert.match(html, /aria-label="Назад ко дню"/);
  assert.match(todaySource, /onClick=\{\(\) => setTodayView\('day_detail'\)\}/);
});

test('/today meal detail shows meal title, macros, ingredients, portion hints, and prep steps', () => {
  const html = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1&mealDetail=Завтрак');

  assert.match(html, /Завтрак/);
  assert.match(html, /Овсянка, банан, йогурт/);
  assert.match(html, /410 ккал/);
  assert.match(html, /Б 24 · Ж 10 · У 58/);
  assert.match(html, /Ингредиенты/);
  assert.match(html, /Овсянка — 50 г/);
  assert.match(html, /Банан — 100 г/);
  assert.match(html, /Йогурт — 150 г/);
  assert.match(html, /Подсказки без весов/);
  assert.match(html, /Без весов: используйте примерный ориентир/);
  assert.match(html, /Банан 100 г ≈ 1 средний банан/);
  assert.match(html, /Овсянка 50 г ≈ несколько столовых ложек/);
  assert.match(html, /Йогурт 150 г ≈ небольшой стакан/);
  assert.match(html, /Способ приготовления/);
  assert.match(html, /Смешайте овсянку и йогурт/);
  assert.match(html, /Добавьте банан/);
  assert.match(html, /Оставьте на несколько минут или ешьте сразу/);
  assert.match(html, /Заменить блюдо/);
  assert.match(html, /Добавить в дневник/);
  assert.match(html, /Добавление в дневник будет доступно после подтверждения/);
});

test('/today meal detail back returns to day screen and keeps diary action disabled mock', () => {
  const html = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1&mealDetail=Завтрак');

  assert.match(html, /aria-label="Назад ко дню"/);
  assert.match(todaySource, /onClick=\{\(\) => setTodayView\('day_detail'\)\}/);
  assert.match(todaySource, /variant="primary" size="sm" disabled fullWidth align="center"[\s\S]*Добавить в дневник/);
  assert.doesNotMatch(html, /План ≠ запись в дневнике/);
  assert.doesNotMatch(html, /План не записывается/);
});

test('/today replace meal opens from meal detail by local state contract', () => {
  assert.match(todaySource, /const openReplaceMeal = \(\) =>/);
  assert.match(todaySource, /setSelectedReplacementId\(null\)/);
  assert.match(todaySource, /setTodayView\('replace_meal'\)/);
  assert.match(todaySource, /onClick=\{openReplaceMeal\}[\s\S]*Заменить блюдо/);
});

test('/today replace meal view shows filters, replacement options, and disabled confirm until selected', () => {
  const html = renderToday('/today?demoGoal=1&replaceMeal=Завтрак');

  assert.match(html, /Заменить завтрак/);
  assert.match(html, /Выберите похожий вариант по КБЖУ/);
  assert.match(html, /Проще/);
  assert.match(html, /Меньше калорий/);
  assert.match(html, /Больше белка/);
  assert.match(html, /Без готовки/);
  assert.match(html, /Похожее КБЖУ/);
  assert.match(html, /Омлет с овощами/);
  assert.match(html, /420 ккал · Б 28 · Ж 18 · У 32/);
  assert.match(html, /Творог с ягодами/);
  assert.match(html, /390 ккал · Б 32 · Ж 9 · У 42/);
  assert.match(html, /Сэндвич с индейкой/);
  assert.match(html, /430 ккал · Б 30 · Ж 12 · У 48/);
  assert.match(html, /Выбрать замену/);
  assert.match(todaySource, /disabled=\{!selectedReplacement\}/);
});

test('/today selecting replacement enables confirm and can show selected meal detail mock data', () => {
  const selectedHtml = renderToday('/today?demoGoal=1&replaceMeal=Завтрак&selectedReplacement=omelet-vegetables');
  const appliedHtml = renderToday('/today?demoGoal=1&mealDetail=Завтрак&replacementApplied=omelet-vegetables');

  assert.match(selectedHtml, /Выбрать замену/);
  assert.match(todaySource, /onClick=\{applyReplacement\}/);
  assert.match(todaySource, /setMealOverrides\(\(current\) => \(\{/);
  assert.match(todaySource, /setTodayView\('meal_detail'\)/);
  assert.match(appliedHtml, /Омлет с овощами/);
  assert.match(appliedHtml, /420 ккал/);
  assert.match(appliedHtml, /Б 28 · Ж 18 · У 32/);
  assert.match(appliedHtml, /Яйца — 2 шт/);
});

test('/today replace meal back returns to meal detail without write/payment/AI actions', () => {
  const html = renderToday('/today?demoGoal=1&replaceMeal=Завтрак');

  assert.match(html, /aria-label="Назад к блюду"/);
  assert.match(todaySource, /onClick=\{\(\) => setTodayView\('meal_detail'\)\}/);
  assert.doesNotMatch(html, /Добавить в дневник/);
  assert.doesNotMatch(html, /Оплатить|Оформить подписку|AI|Coach/);
});

test('/today day detail back returns to selected plan detail', () => {
  const html = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=2');

  assert.match(html, /aria-label="Назад к плану"/);
  assert.match(todaySource, /onClick=\{\(\) => setTodayView\('plan_detail'\)\}/);
  assert.doesNotMatch(html, /Ваши планы на 14 дней/);
  assert.doesNotMatch(html, /План ≠ запись в дневнике/);
  assert.doesNotMatch(html, /План не записывается/);
});

test('/today plan detail keeps header safe and list padded above bottom CTA', () => {
  assert.match(todaySource, /mx-12 max-w-\[184px\] truncate whitespace-nowrap text-center text-base/);
  assert.match(todaySource, /min-\[430px\]:max-w-\[340px\]/);
  assert.match(todaySource, /pb-40 pt-5/);
  assert.match(todaySource, /space-y-1\.5 pb-8/);
  assert.match(todaySource, /whitespace-normal text-xs leading-4 text-stone-500">\{day\.macros\}/);
  assert.doesNotMatch(todaySource, /truncate text-xs leading-4 text-stone-500">\{day\.macros\}/);
});

test('/today day detail keeps compact safe layout and mock-only disabled actions', () => {
  assert.match(todaySource, /pb-56 pt-5/);
  assert.match(todaySource, /flex flex-1 flex-col gap-4 py-5/);
  assert.match(todaySource, /rounded-lg border border-stone-200 bg-white px-3 py-1\.5/);
  assert.match(todaySource, /\{selectedPlanDay\.workout\.duration\} · \{selectedPlanDay\.workout\.focus\}/);
  assert.match(todaySource, /space-y-2 pb-12/);
  assert.match(todaySource, /grid grid-cols-2 gap-1\.5/);
  assert.match(todaySource, /variant="outline" size="sm" onClick=\{openShoppingList\} fullWidth align="center"/);
  assert.match(todaySource, /variant="primary" size="sm" disabled fullWidth align="center"/);
});

test('/today meal detail keeps compact safe layout and bottom actions padded', () => {
  assert.match(todaySource, /pb-60 pt-\[max\(32px,env\(safe-area-inset-top\)\)\]/);
  assert.match(todaySource, /flex flex-1 flex-col gap-4 pb-8 pt-5/);
  assert.match(todaySource, /space-y-1\.5 pb-16/);
  assert.match(todaySource, /Заменить блюдо/);
  assert.match(todaySource, /Добавить в дневник/);
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
  assert.doesNotMatch(todaySource, /\.insert\(|\.update\(|\.upsert\(|\.rpc\(/);
  assert.equal((todaySource.match(/\.delete\(/g) ?? []).length, 1);
  assert.match(todaySource, /next\.delete\(productKey\)/);
  assert.doesNotMatch(todaySource, /user_premium_plan_selections|user_premium_meal_selections/);
  assert.doesNotMatch(todaySource, /food_diary_entries|workout_entries|public\.recipes|recipe_ingredients/);
  assert.doesNotMatch(todaySource, /premium_shopping_items|user_premium_shopping_checks/);
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
