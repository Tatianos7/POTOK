import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import Today from '../Today';
import { premiumCatalogService } from '../../services/premiumCatalogService';
import {
  buildTodayPlanFromPremiumCatalog,
  mapPremiumMealSlotsToTodayMeals,
  mapPremiumPlanDaysToTodayDays,
  mapPremiumRecipeDetailToTodayMealDetail,
} from '../../services/premiumTodayAdapter';
import {
  catalogEmptyArray,
  catalogReadFailed,
  catalogUnavailable,
  premiumFixtureDays,
  premiumFixtureMealSlots,
  premiumFixturePlan,
  premiumFixtureRecipe,
} from '../../test/premiumReadOnlyFixtures';
import { createMockPremiumCatalogService, renderMountedWithRouter } from '../../test/mountedAsyncTestUtils';

const currentDir = dirname(fileURLToPath(import.meta.url));
const todaySource = readFileSync(resolve(currentDir, '../Today.tsx'), 'utf8');
const adapterSource = readFileSync(resolve(currentDir, '../../services/premiumTodayAdapter.ts'), 'utf8');
const catalogServiceSource = readFileSync(resolve(currentDir, '../../services/premiumCatalogService.ts'), 'utf8');

function renderToday(route = '/today') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <Today />
    </MemoryRouter>
  );
}

test('/today mounted async harness records current DOM limitation without runtime changes', async () => {
  if (typeof document === 'undefined') {
    await assert.rejects(
      () => renderMountedWithRouter(<Today />, '/today?demoGoal=1'),
      /mounted async test harness requires a DOM environment/
    );
    return;
  }

  const mounted = await renderMountedWithRouter(<Today />, '/today?demoGoal=1');
  try {
    assert.match(mounted.text(), /Мой Поток/);
  } finally {
    await mounted.cleanup();
  }
});

test('/today default mode renders demo plan day meal flow and does not execute catalog reads in static render', () => {
  const originalService = {
    getActivePremiumPlans: premiumCatalogService.getActivePremiumPlans,
    getPremiumPlanDetail: premiumCatalogService.getPremiumPlanDetail,
    getPremiumMealSlots: premiumCatalogService.getPremiumMealSlots,
    getMealRecipeOptions: premiumCatalogService.getMealRecipeOptions,
    getPremiumRecipeDetail: premiumCatalogService.getPremiumRecipeDetail,
  };
  const mockService = createMockPremiumCatalogService({
    async getActivePremiumPlans() {
      mockService.calls.push('getActivePremiumPlans');
      return catalogReadFailed([]);
    },
    async getPremiumPlanDetail(planId: string) {
      mockService.calls.push(`getPremiumPlanDetail:${planId}`);
      return catalogReadFailed(null);
    },
    async getPremiumMealSlots(dayId: string) {
      mockService.calls.push(`getPremiumMealSlots:${dayId}`);
      return catalogReadFailed([]);
    },
    async getMealRecipeOptions(slotId: string) {
      mockService.calls.push(`getMealRecipeOptions:${slotId}`);
      return catalogReadFailed([]);
    },
    async getPremiumRecipeDetail(recipeId: string) {
      mockService.calls.push(`getPremiumRecipeDetail:${recipeId}`);
      return catalogReadFailed(null);
    },
  });

  premiumCatalogService.getActivePremiumPlans = mockService.getActivePremiumPlans;
  premiumCatalogService.getPremiumPlanDetail = mockService.getPremiumPlanDetail;
  premiumCatalogService.getPremiumMealSlots = mockService.getPremiumMealSlots;
  premiumCatalogService.getMealRecipeOptions = mockService.getMealRecipeOptions;
  premiumCatalogService.getPremiumRecipeDetail = mockService.getPremiumRecipeDetail;

  try {
    const planHtml = renderToday('/today?demoGoal=1');
    const dayHtml = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1');
    const mealHtml = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1&mealDetail=Завтрак');

    assert.match(planHtml, /Питание \+ тренировки/);
    assert.match(planHtml, /Питание без сложной готовки/);
    assert.match(dayHtml, /День 1/);
    assert.match(dayHtml, /Овсянка, банан, йогурт/);
    assert.match(mealHtml, /Ингредиенты/);
    assert.match(mealHtml, /Способ приготовления/);
    assert.deepEqual(mockService.calls, []);
  } finally {
    premiumCatalogService.getActivePremiumPlans = originalService.getActivePremiumPlans;
    premiumCatalogService.getPremiumPlanDetail = originalService.getPremiumPlanDetail;
    premiumCatalogService.getPremiumMealSlots = originalService.getPremiumMealSlots;
    premiumCatalogService.getMealRecipeOptions = originalService.getMealRecipeOptions;
    premiumCatalogService.getPremiumRecipeDetail = originalService.getPremiumRecipeDetail;
  }
});

test('/today default day and meal actions remain disabled no-write actions', () => {
  const dayHtml = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1');
  const mealHtml = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1&mealDetail=Завтрак');

  assert.match(dayHtml, /Подтвердить день/);
  assert.match(mealHtml, /Добавить в дневник/);
  assert.match(todaySource, /variant="primary" size="sm" disabled fullWidth align="center"[\s\S]*Подтвердить день/);
  assert.match(todaySource, /variant="primary" size="sm" disabled fullWidth align="center"[\s\S]*Добавить в дневник/);
  assert.doesNotMatch(dayHtml, /read_failed|supabase_unavailable|stack|Supabase error/);
  assert.doesNotMatch(mealHtml, /read_failed|supabase_unavailable|stack|Supabase error/);
});

test('/today flag-enabled plan day meal source wiring stays on approved read-only catalog path', () => {
  assert.match(todaySource, /if \(!isPremiumCatalogStagingReadMode\(\)\)/);
  assert.match(todaySource, /premiumCatalogService\.getActivePremiumPlans\(\)/);
  assert.match(todaySource, /premiumCatalogService\.getPremiumPlanDetail\(plan\.id\)/);
  assert.match(todaySource, /premiumCatalogService\.getPremiumMealSlots\(selectedPlanDay\.catalogDayId\)/);
  assert.match(todaySource, /premiumCatalogService\.getMealRecipeOptions\(slot\.id\)/);
  assert.match(todaySource, /option\.optionType === 'primary'/);
  assert.match(todaySource, /premiumCatalogService\.getPremiumRecipeDetail\(primaryOption\.recipeId\)/);
  assert.match(todaySource, /buildTodayPlanFromPremiumCatalog/);
  assert.match(todaySource, /mapPremiumMealSlotsToTodayMeals\(slotsResult\.data, primaryRecipeBySlotId\)/);
});

test('/today fixtures and adapter map returned plan days without synthesizing days 3-14', () => {
  const mappedDays = mapPremiumPlanDaysToTodayDays(premiumFixtureDays);
  const mappedPlan = buildTodayPlanFromPremiumCatalog({
    plan: premiumFixturePlan,
    days: premiumFixtureDays,
    slotsByDayId: {
      [premiumFixtureDays[0].id]: premiumFixtureMealSlots,
    },
    primaryRecipeBySlotId: {
      [premiumFixtureMealSlots[0].id]: premiumFixtureRecipe,
    },
  });

  assert.deepEqual(
    premiumFixtureDays.map((day) => day.dayNumber),
    [1, 2]
  );
  assert.deepEqual(
    mappedDays.map((day) => day.day),
    [1, 2]
  );
  assert.equal(mappedPlan.days.length, 2);
  assert.equal(mappedPlan.days.some((day) => day.day >= 3), false);
  assert.equal(mappedPlan.days[0]?.meals.length, 4);
  assert.equal(mappedPlan.days[1]?.meals.length, 0);
  assert.doesNotMatch(todaySource, /Array\.from\(\{ length: selectedPlan\.durationDays \}/);
});

test('/today fixtures and adapter map day meal slots plus recipe ingredients steps hints', () => {
  const meals = mapPremiumMealSlotsToTodayMeals(premiumFixtureMealSlots, {
    [premiumFixtureMealSlots[0].id]: premiumFixtureRecipe,
  });
  const mealDetail = mapPremiumRecipeDetailToTodayMealDetail(premiumFixtureRecipe, premiumFixtureMealSlots[0]);
  const failedRecipeDetail = mapPremiumRecipeDetailToTodayMealDetail(null, premiumFixtureMealSlots[0]);

  assert.deepEqual(
    meals.map((meal) => meal.title),
    ['Завтрак', 'Обед', 'Ужин', 'Перекус']
  );
  assert.equal(meals[0]?.summary, 'fixture_protein_oats');
  assert.equal(meals[0]?.catalogSlotId, premiumFixtureMealSlots[0].id);
  assert.equal(meals[0]?.catalogPrimaryRecipeId, premiumFixtureRecipe.id);
  assert.deepEqual(mealDetail.ingredients, ['fixture_oats — half cup oats', 'fixture_yogurt — small cup yogurt']);
  assert.deepEqual(mealDetail.steps, ['Mix oats with yogurt.', 'Rest for five minutes.']);
  assert.deepEqual(mealDetail.portionHints, ['No scale: use one small bowl.']);
  assert.deepEqual(failedRecipeDetail.ingredients, []);
  assert.deepEqual(failedRecipeDetail.steps, []);
  assert.deepEqual(failedRecipeDetail.portionHints, []);
});

test('/today fallback contracts preserve mock demo state and hide technical strings', () => {
  assert.deepEqual(catalogUnavailable([]), {
    ok: false,
    source: 'fallback',
    error: 'supabase_unavailable',
    data: [],
  });
  assert.deepEqual(catalogReadFailed(null), {
    ok: false,
    source: 'fallback',
    error: 'read_failed',
    data: null,
  });
  assert.deepEqual(catalogEmptyArray(), {
    ok: true,
    source: 'supabase',
    data: [],
  });

  assert.match(todaySource, /!plansResult\.ok \|\| plansResult\.data\.length === 0/);
  assert.match(todaySource, /detailResult\.data\.days\.length === 0/);
  assert.match(todaySource, /!slotsResult\.ok \|\| slotsResult\.data\.length === 0/);
  assert.match(todaySource, /throw new Error\('catalog recipe detail read failed'\)/);
  assert.match(todaySource, /setCatalogPlans\(null\)/);
  assert.match(todaySource, /setCatalogDayMeals\(\{\}\)/);

  const html = renderToday('/today?demoGoal=1&dayDetail=nutrition-training-home-start&day=1&mealDetail=Завтрак');

  for (const technicalText of ['read_failed', 'supabase_unavailable', 'stack', 'Supabase error']) {
    assert.doesNotMatch(html, new RegExp(technicalText));
  }
});

test('/today mounted async package keeps no-write source guardrails', () => {
  assert.doesNotMatch(todaySource, /mealService|workoutService|uiRuntimeAdapter/);
  assert.doesNotMatch(todaySource, /addMeal|saveMeal|updateWater|addExercisesToWorkout|completeToday|skipToday/);
  assert.doesNotMatch(todaySource, /\.insert\(|\.update\(|\.upsert\(|\.rpc\(/);
  assert.equal((todaySource.match(/\.delete\(/g) ?? []).length, 1);
  assert.match(todaySource, /next\.delete\(productKey\)/);

  for (const forbiddenSurface of [
    'user_premium_plan_selections',
    'user_premium_meal_selections',
    'food_diary_entries',
    'workout_entries',
    'public.recipes',
    'recipe_ingredients',
    'premium_shopping_items',
    'user_premium_shopping_checks',
  ]) {
    assert.equal(todaySource.includes(forbiddenSurface), false, forbiddenSurface);
  }

  assert.doesNotMatch(todaySource, /recipe import|shopping persistence/i);
  assert.doesNotMatch(todaySource, /stripe|checkout|payment|subscribe/i);
  assert.doesNotMatch(todaySource, /generateDailyPlan|openai|aiGeneration/i);
  assert.doesNotMatch(todaySource, /voice|голос/i);
  assert.doesNotMatch(adapterSource, /supabase|import\.meta|process\.env|localStorage|window/i);
  assert.doesNotMatch(adapterSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(catalogServiceSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
});
