import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PremiumRecipes from '../PremiumRecipes';
import { getHomeFeatureCards } from '../../utils/constants';

const currentDir = dirname(fileURLToPath(import.meta.url));
const premiumRecipesSource = readFileSync(resolve(currentDir, '../PremiumRecipes.tsx'), 'utf8');
const appSource = readFileSync(resolve(currentDir, '../../App.tsx'), 'utf8');

function renderPremiumRecipes(route = '/premium-recipes') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <PremiumRecipes />
    </MemoryRouter>
  );
}

test('premium Home card opens dedicated premium recipes route', () => {
  const cards = getHomeFeatureCards({ hasPremium: true });
  const premiumRecipesEntry = cards.find((card) => card.title === 'Сборник рецептов');

  assert.ok(premiumRecipesEntry);
  assert.equal(premiumRecipesEntry.route, '/premium-recipes');
  assert.match(appSource, /path="\/premium-recipes"/);
  assert.doesNotMatch(premiumRecipesSource, /\/nutrition\/recipes/);
});

test('/premium-recipes renders clean POTOK recipe library mock', () => {
  const html = renderPremiumRecipes();

  assert.match(html, /Сборник рецептов/);
  assert.match(html, /Готовые рецепты POTOK с КБЖУ, граммовками и подсказками без весов/);
  assert.match(html, /Завтраки/);
  assert.match(html, /Обеды/);
  assert.match(html, /Ужины/);
  assert.match(html, /Перекусы/);
  assert.match(html, /Быстро/);
  assert.match(html, /Без сложной готовки/);
  assert.match(html, /Овсянка с бананом и йогуртом/);
  assert.match(html, /Завтрак · 410 ккал · Б 24 · Ж 10 · У 58/);
  assert.match(html, /10 минут · без сложной готовки/);
  assert.match(html, /Курица с рисом и овощами/);
  assert.match(html, /Обед · 520 ккал · Б 42 · Ж 14 · У 55/);
  assert.match(html, /25 минут · базовый рацион/);
  assert.match(html, /Рыба с салатом/);
  assert.match(html, /Ужин · 430 ккал · Б 36 · Ж 18 · У 24/);
  assert.match(html, /Творог с ягодами/);
  assert.match(html, /Перекус · 290 ккал · Б 30 · Ж 8 · У 28/);
});

test('/premium-recipes recipe click opens local detail view contract', () => {
  assert.match(premiumRecipesSource, /onClick=\{\(\) => setSelectedRecipeId\(recipe\.id\)\}/);
  assert.match(premiumRecipesSource, /const \[selectedRecipeId, setSelectedRecipeId\]/);
  assert.match(premiumRecipesSource, /premiumRecipes\.find\(\(recipe\) => recipe\.id === selectedRecipeId\)/);
});

test('/premium-recipes detail shows recipe nutrition, ingredients, hints, steps, and disabled mock actions', () => {
  const html = renderPremiumRecipes('/premium-recipes?recipe=oatmeal-banana-yogurt');

  assert.match(html, /Завтрак/);
  assert.match(html, /Овсянка с бананом и йогуртом/);
  assert.match(html, /410 ккал/);
  assert.match(html, /Б 24 · Ж 10 · У 58/);
  assert.match(html, /Ингредиенты/);
  assert.match(html, /Овсянка — 50 г/);
  assert.match(html, /Банан — 100 г/);
  assert.match(html, /Йогурт — 150 г/);
  assert.match(html, /Подсказки без весов/);
  assert.match(html, /Без весов: используйте примерный ориентир/);
  assert.match(html, /Банан 100 г ≈ 1 средний банан/);
  assert.match(html, /Йогурт 150 г ≈ небольшой стакан/);
  assert.match(html, /Способ приготовления/);
  assert.match(html, /Смешайте овсянку с йогуртом/);
  assert.match(html, /Добавьте нарезанный банан/);
  assert.match(html, /Оставьте на 5 минут или ешьте сразу/);
  assert.match(html, /Добавить в план/);
  assert.match(html, /Добавить в дневник/);
  assert.match(premiumRecipesSource, /variant="outline" size="sm" disabled fullWidth align="center"[\s\S]*Добавить в план/);
  assert.match(premiumRecipesSource, /variant="primary" size="sm" disabled fullWidth align="center"[\s\S]*Добавить в дневник/);
});

test('/premium-recipes detail back returns to library and keeps clean mobile layout', () => {
  const html = renderPremiumRecipes('/premium-recipes?recipe=oatmeal-banana-yogurt');

  assert.match(html, /aria-label="Назад к сборнику"/);
  assert.match(html, /aria-label="Закрыть"/);
  assert.match(premiumRecipesSource, /onBack \? \(/);
  assert.match(premiumRecipesSource, /setSelectedRecipeId\(null\)/);
  assert.match(premiumRecipesSource, /min-w-\[320px\]/);
  assert.match(premiumRecipesSource, /pb-36/);
  assert.match(premiumRecipesSource, /pb-16/);
});

test('/premium-recipes source does not call diary, payment, AI, DB, or real recipe runtime paths', () => {
  assert.doesNotMatch(premiumRecipesSource, /mealService|recipeService|recipesService|recipeDiaryService/);
  assert.doesNotMatch(premiumRecipesSource, /uiRuntimeAdapter|supabase|insert\(|update\(|saveRecipe|addMeal/);
  assert.doesNotMatch(premiumRecipesSource, /stripe|checkout|payment|subscribe/i);
  assert.doesNotMatch(premiumRecipesSource, /generateRecipe|generateDailyPlan|openai|aiGeneration/i);
  assert.doesNotMatch(premiumRecipesSource, /shoppingService|shoppingListService|recalculate/i);
});
