import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import PremiumRecipes, { mapCatalogRecipeToPremiumRecipe, mockPremiumRecipes } from '../PremiumRecipes';
import { premiumCatalogService } from '../../services/premiumCatalogService';
import {
  catalogEmptyArray,
  catalogReadFailed,
  catalogUnavailable,
  premiumFixtureRecipe,
  premiumFixtureRecipeLibrary,
} from '../../test/premiumReadOnlyFixtures';
import { renderMountedWithRouter } from '../../test/mountedAsyncTestUtils';

const currentDir = dirname(fileURLToPath(import.meta.url));
const premiumRecipesSource = readFileSync(resolve(currentDir, '../PremiumRecipes.tsx'), 'utf8');
const catalogServiceSource = readFileSync(resolve(currentDir, '../../services/premiumCatalogService.ts'), 'utf8');

function renderPremiumRecipes(route = '/premium-recipes') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <PremiumRecipes />
    </MemoryRouter>
  );
}

test('/premium-recipes mounted async harness records current DOM limitation without runtime changes', async () => {
  if (typeof document === 'undefined') {
    await assert.rejects(
      () => renderMountedWithRouter(<PremiumRecipes />, '/premium-recipes'),
      /mounted async test harness requires a DOM environment/
    );
    return;
  }

  const mounted = await renderMountedWithRouter(<PremiumRecipes />, '/premium-recipes');
  try {
    assert.match(mounted.text(), /Сборник рецептов/);
  } finally {
    await mounted.cleanup();
  }
});

test('/premium-recipes default mode renders mock library and does not execute catalog reads in static render', () => {
  const originalGetLibrary = premiumCatalogService.getPremiumRecipeLibrary;
  const originalGetDetail = premiumCatalogService.getPremiumRecipeDetail;
  const calls: string[] = [];

  premiumCatalogService.getPremiumRecipeLibrary = async () => {
    calls.push('getPremiumRecipeLibrary');
    return catalogReadFailed([]);
  };
  premiumCatalogService.getPremiumRecipeDetail = async (recipeId: string) => {
    calls.push(`getPremiumRecipeDetail:${recipeId}`);
    return catalogReadFailed(null);
  };

  try {
    const html = renderPremiumRecipes();

    assert.match(html, /Сборник рецептов/);
    assert.match(html, /Овсянка с бананом и йогуртом/);
    assert.match(html, /Курица с рисом и овощами/);
    assert.equal(calls.length, 0);
  } finally {
    premiumCatalogService.getPremiumRecipeLibrary = originalGetLibrary;
    premiumCatalogService.getPremiumRecipeDetail = originalGetDetail;
  }
});

test('/premium-recipes default detail keeps disabled no-write actions', () => {
  const html = renderPremiumRecipes(`/premium-recipes?recipe=${mockPremiumRecipes[0].id}`);

  assert.match(html, /Ингредиенты/);
  assert.match(html, /Подсказки без весов/);
  assert.match(html, /Способ приготовления/);
  assert.match(html, /Добавить в план/);
  assert.match(html, /Добавить в дневник/);
  assert.match(html, /Пока это просмотр: запись в план и дневник появится после подключения плана/);
  assert.match(premiumRecipesSource, /variant="outline" size="sm" disabled fullWidth align="center"[\s\S]*Добавить в план/);
  assert.match(premiumRecipesSource, /variant="primary" size="sm" disabled fullWidth align="center"[\s\S]*Добавить в дневник/);
});

test('/premium-recipes flag-enabled library success is wired to read-only catalog data', () => {
  assert.match(premiumRecipesSource, /const useStagingCatalog = isPremiumCatalogStagingReadMode\(\)/);
  assert.match(premiumRecipesSource, /if \(!useStagingCatalog\) \{[\s\S]*setLibraryReadStatus\('idle'\)[\s\S]*return;/);
  assert.match(premiumRecipesSource, /premiumCatalogService\.getPremiumRecipeLibrary\(\)/);
  assert.match(premiumRecipesSource, /setLibraryReadStatus\('loading'\)/);
  assert.match(premiumRecipesSource, /result\.ok && result\.data\.length > 0/);
  assert.match(premiumRecipesSource, /setRecipes\(result\.data\.map\(\(recipe\) => mapCatalogRecipeToPremiumRecipe\(recipe\)\)\)/);
  assert.match(premiumRecipesSource, /setLibraryReadStatus\('catalog'\)/);

  const mappedRecipe = mapCatalogRecipeToPremiumRecipe(premiumFixtureRecipeLibrary[0]);

  assert.equal(mappedRecipe.id, premiumFixtureRecipe.id);
  assert.equal(mappedRecipe.title, 'fixture_protein_oats');
  assert.equal(mappedRecipe.category, 'Завтрак');
  assert.equal(mappedRecipe.summary, 'Завтрак · 410 ккал · Б 31 · Ж 10 · У 52');
  assert.equal(mappedRecipe.ingredients.length, 0);
  assert.equal(mappedRecipe.steps.length, 0);
  assert.equal(mappedRecipe.portionHints.length, 0);
});

test('/premium-recipes flag-enabled detail success maps catalog ingredients steps and hints', () => {
  assert.match(premiumRecipesSource, /premiumCatalogService\.getPremiumRecipeDetail\(selectedRecipeId\)/);
  assert.match(premiumRecipesSource, /setDetailReadStatus\('loading'\)/);
  assert.match(premiumRecipesSource, /result\.ok && result\.data/);
  assert.match(premiumRecipesSource, /\[selectedRecipeId\]: mapCatalogRecipeToPremiumRecipe\(detail, detail\)/);
  assert.match(premiumRecipesSource, /setDetailReadStatus\('catalog'\)/);

  const mappedDetail = mapCatalogRecipeToPremiumRecipe(premiumFixtureRecipe, premiumFixtureRecipe);

  assert.deepEqual(mappedDetail.ingredients, ['fixture_oats — half cup oats', 'fixture_yogurt — small cup yogurt']);
  assert.deepEqual(mappedDetail.steps, ['Mix oats with yogurt.', 'Rest for five minutes.']);
  assert.deepEqual(mappedDetail.portionHints, ['No scale: use one small bowl.']);
  assert.equal(mappedDetail.calories, '410 ккал');
  assert.equal(mappedDetail.macros, 'Б 31 · Ж 10 · У 52');
});

test('/premium-recipes fallback result shapes preserve mock state and hide technical errors', () => {
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

  assert.match(premiumRecipesSource, /mockPremiumRecipes/);
  assert.match(premiumRecipesSource, /result\.ok && result\.data\.length > 0/);
  assert.match(premiumRecipesSource, /result\.ok && result\.data/);
  assert.match(premiumRecipesSource, /setLibraryReadStatus\('fallback'\)/);
  assert.match(premiumRecipesSource, /setDetailReadStatus\('fallback'\)/);
  assert.match(premiumRecipesSource, /Готовим рецепты для просмотра/);
  assert.match(premiumRecipesSource, /Показываем демо-рецепты/);
  assert.match(premiumRecipesSource, /Рецепты пока не найдены/);
  assert.match(premiumRecipesSource, /Ингредиенты пока не заполнены/);
  assert.match(premiumRecipesSource, /Подсказки появятся, когда рецепт будет заполнен подробнее/);
  assert.match(premiumRecipesSource, /Шаги приготовления пока не заполнены/);

  const html = renderPremiumRecipes();

  for (const technicalText of ['read_failed', 'supabase_unavailable', 'stack', 'Supabase error']) {
    assert.doesNotMatch(html, new RegExp(technicalText));
  }
});

test('/premium-recipes mounted async package keeps no-write source guardrails', () => {
  for (const forbiddenPattern of [
    /\.insert\(/,
    /\.update\(/,
    /\.upsert\(/,
    /\.delete\(/,
    /\.rpc\(/,
    /user_premium_plan_selections/,
    /user_premium_meal_selections/,
    /food_diary_entries/,
    /public\.recipes/,
    /recipe import/i,
    /shopping persistence/i,
    /premium_shopping_items/,
    /user_premium_shopping_checks/,
    /openai|aiGeneration|generateRecipe|generateDailyPlan/i,
    /voice/i,
    /production/i,
  ]) {
    assert.doesNotMatch(premiumRecipesSource, forbiddenPattern);
  }

  assert.doesNotMatch(catalogServiceSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
});
