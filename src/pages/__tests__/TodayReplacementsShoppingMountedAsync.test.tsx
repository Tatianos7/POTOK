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
  mapDerivedShoppingListToShoppingGroups,
  mapMealRecipeOptionsToReplacementOptions,
} from '../../services/premiumTodayAdapter';
import {
  catalogEmptyArray,
  catalogReadFailed,
  catalogUnavailable,
  premiumFixtureRecipe,
  premiumFixtureReplacementOptions,
  premiumFixtureReplacementRecipe,
  premiumFixtureShoppingItems,
} from '../../test/premiumReadOnlyFixtures';
import { renderMountedWithRouter } from '../../test/mountedAsyncTestUtils';

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

test('/today replacements shopping mounted async harness records current DOM limitation without runtime changes', async () => {
  if (typeof document === 'undefined') {
    await assert.rejects(
      () => renderMountedWithRouter(<Today />, '/today?demoGoal=1&replaceMeal=Завтрак'),
      /mounted async test harness requires a DOM environment/
    );
    return;
  }

  const mounted = await renderMountedWithRouter(<Today />, '/today?demoGoal=1&replaceMeal=Завтрак');
  try {
    assert.match(mounted.text(), /Заменить завтрак/);
  } finally {
    await mounted.cleanup();
  }
});

test('/today default replacement and shopping views render mock data without executing catalog reads', () => {
  const originalService = {
    getMealRecipeOptions: premiumCatalogService.getMealRecipeOptions,
    getPremiumRecipeDetail: premiumCatalogService.getPremiumRecipeDetail,
    buildDerivedShoppingList: premiumCatalogService.buildDerivedShoppingList,
  };
  const calls: string[] = [];

  premiumCatalogService.getMealRecipeOptions = async (slotId: string) => {
    calls.push(`getMealRecipeOptions:${slotId}`);
    return catalogReadFailed([]);
  };
  premiumCatalogService.getPremiumRecipeDetail = async (recipeId: string) => {
    calls.push(`getPremiumRecipeDetail:${recipeId}`);
    return catalogReadFailed(null);
  };
  premiumCatalogService.buildDerivedShoppingList = async (planId: string) => {
    calls.push(`buildDerivedShoppingList:${planId}`);
    return catalogReadFailed([]);
  };

  try {
    const replacementHtml = renderToday('/today?demoGoal=1&replaceMeal=Завтрак');
    const shoppingHtml = renderToday('/today?demoGoal=1&shoppingList=1');

    assert.match(replacementHtml, /Омлет с овощами/);
    assert.match(replacementHtml, /Творог с ягодами/);
    assert.match(replacementHtml, /Сэндвич с индейкой/);
    assert.match(replacementHtml, /Выбор применится только на этом экране/);
    assert.match(shoppingHtml, /Список покупок/);
    assert.match(shoppingHtml, /Отметки покупок остаются только здесь/);
    assert.match(shoppingHtml, /Белок/);
    assert.match(shoppingHtml, /Курица/);
    assert.match(shoppingHtml, /1 день/);
    assert.match(shoppingHtml, /2 дня/);
    assert.match(shoppingHtml, /3 дня/);
    assert.match(shoppingHtml, /7 дней/);
    assert.deepEqual(calls, []);
  } finally {
    premiumCatalogService.getMealRecipeOptions = originalService.getMealRecipeOptions;
    premiumCatalogService.getPremiumRecipeDetail = originalService.getPremiumRecipeDetail;
    premiumCatalogService.buildDerivedShoppingList = originalService.buildDerivedShoppingList;
  }
});

test('/today replacements source wiring stays on approved read-only catalog path', () => {
  assert.match(todaySource, /todayView === 'replace_meal'/);
  assert.match(todaySource, /if \(!hasGoal \|\| !isPremiumCatalogStagingReadMode\(\)\)/);
  assert.match(todaySource, /premiumCatalogService\.getMealRecipeOptions\(selectedMeal\.catalogSlotId\)/);
  assert.match(todaySource, /for \(const option of optionsResult\.data\)/);
  assert.match(todaySource, /premiumCatalogService\.getPremiumRecipeDetail\(option\.recipeId\)/);
  assert.match(todaySource, /mapMealRecipeOptionsToReplacementOptions\(optionsResult\.data, recipeDetailsById\)/);
  assert.match(todaySource, /setCatalogReplacementOptions\(\(current\) => \(\{/);
  assert.match(todaySource, /selectedReplacementOptions\.map\(\(option\) =>/);
});

test('/today replacement fixtures map primary and replacement cards without persistence', () => {
  const replacements = mapMealRecipeOptionsToReplacementOptions(premiumFixtureReplacementOptions, {
    [premiumFixtureRecipe.id]: premiumFixtureRecipe,
    [premiumFixtureReplacementRecipe.id]: premiumFixtureReplacementRecipe,
  });

  assert.deepEqual(
    replacements.map((option) => option.optionType),
    ['primary', 'replacement']
  );
  assert.equal(replacements[0]?.id, 'premium-fixture-option-primary');
  assert.equal(replacements[0]?.summary, 'fixture_protein_oats');
  assert.equal(replacements[0]?.recipeId, premiumFixtureRecipe.id);
  assert.equal(replacements[1]?.id, 'premium-fixture-option-replacement');
  assert.equal(replacements[1]?.summary, 'fixture_egg_plate');
  assert.equal(replacements[1]?.note, 'fixture_replacement');
  assert.deepEqual(replacements[1]?.ingredients, ['fixture_eggs — two eggs']);
});

test('/today replacement fallback and apply remain local-only no-write contracts', () => {
  assert.deepEqual(mapMealRecipeOptionsToReplacementOptions([], {}), []);
  assert.deepEqual(mapMealRecipeOptionsToReplacementOptions(null, {}), []);
  assert.equal(mapMealRecipeOptionsToReplacementOptions(premiumFixtureReplacementOptions, {}).length, 2);
  assert.deepEqual(catalogUnavailable([]), {
    ok: false,
    source: 'fallback',
    error: 'supabase_unavailable',
    data: [],
  });
  assert.deepEqual(catalogReadFailed([]), {
    ok: false,
    source: 'fallback',
    error: 'read_failed',
    data: [],
  });

  assert.match(todaySource, /!optionsResult\.ok \|\| optionsResult\.data\.length === 0/);
  assert.match(todaySource, /if \(replacements\.length === 0\)/);
  assert.match(todaySource, /catch \{/);
  assert.match(todaySource, /setSelectedReplacementId\(null\)/);
  assert.match(todaySource, /Подходящие замены пока не найдены/);
  assert.match(todaySource, /const applyReplacement = \(\) =>/);
  assert.match(todaySource, /setMealOverrides\(\(current\) => \(\{/);
  assert.match(todaySource, /setTodayView\('meal_detail'\)/);
  assert.doesNotMatch(todaySource, /user_premium_meal_selections/);
});

test('/today shopping source wiring and derived fixture stay grouped in-memory', () => {
  const groups = mapDerivedShoppingListToShoppingGroups(premiumFixtureShoppingItems);

  assert.match(todaySource, /todayView === 'shopping_list'/);
  assert.match(todaySource, /premiumCatalogService\.buildDerivedShoppingList\(selectedPlan\.id/);
  assert.match(todaySource, /startDay: selectedDay/);
  assert.match(todaySource, /endDay: selectedDay \+ shoppingPeriod - 1/);
  assert.match(todaySource, /mapDerivedShoppingListToShoppingGroups\(shoppingResult\.data\)/);
  assert.match(todaySource, /setCatalogShoppingGroups\(\(current\) => \(\{/);
  assert.match(todaySource, /const shoppingPeriods: ShoppingPeriod\[] = \[1, 2, 3, 7\]/);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.title, 'Список');
  assert.deepEqual(
    groups[0]?.products.map((product) => product.name),
    ['fixture_eggs', 'fixture_oats', 'fixture_yogurt']
  );
  assert.equal(groups[0]?.products.every((product) => product.unit === 'г'), true);
  assert.equal(groups[0]?.products.every((product) => product.isDerivedCatalogAmount), true);
});

test('/today shopping fallback and checkbox remain local-only contracts', () => {
  const emptyGroups = mapDerivedShoppingListToShoppingGroups([]);
  const shoppingHtml = renderToday('/today?demoGoal=1&shoppingList=1&shoppingPeriod=2');

  assert.deepEqual(emptyGroups, []);
  assert.deepEqual(catalogEmptyArray(), {
    ok: true,
    source: 'supabase',
    data: [],
  });
  assert.deepEqual(catalogUnavailable([]), {
    ok: false,
    source: 'fallback',
    error: 'supabase_unavailable',
    data: [],
  });
  assert.deepEqual(catalogReadFailed([]), {
    ok: false,
    source: 'fallback',
    error: 'read_failed',
    data: [],
  });

  assert.match(todaySource, /!shoppingResult\.ok \|\| shoppingResult\.data\.length === 0/);
  assert.match(todaySource, /if \(groups\.length === 0\)/);
  assert.match(todaySource, /Keep the existing mock shopping list as a quiet fallback/);
  assert.match(todaySource, /Список продуктов пока пуст/);
  assert.match(todaySource, /const \[boughtProducts, setBoughtProducts\] = useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(todaySource, /onChange=\{\(\) => toggleBoughtProduct\(productKey\)\}/);
  assert.match(todaySource, /next\.delete\(productKey\)/);
  assert.match(shoppingHtml, /400 г/);
  assert.match(shoppingHtml, /type="checkbox"/);
  assert.doesNotMatch(todaySource, /premium_shopping_items|user_premium_shopping_checks/);
});

test('/today replacements shopping fallback output hides technical strings', () => {
  const replacementHtml = renderToday('/today?demoGoal=1&replaceMeal=Завтрак');
  const shoppingHtml = renderToday('/today?demoGoal=1&shoppingList=1');

  for (const technicalText of ['read_failed', 'supabase_unavailable', 'stack', 'Supabase error']) {
    assert.doesNotMatch(replacementHtml, new RegExp(technicalText));
    assert.doesNotMatch(shoppingHtml, new RegExp(technicalText));
  }
});

test('/today replacements shopping mounted async package keeps no-write source guardrails', () => {
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
  assert.doesNotMatch(todaySource, /generateDailyPlan|openai|aiGeneration/i);
  assert.doesNotMatch(todaySource, /voice|голос/i);
  assert.doesNotMatch(adapterSource, /supabase|import\.meta|process\.env|localStorage|window/i);
  assert.doesNotMatch(adapterSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(catalogServiceSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
});
