import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {decodeAuthoringWeekReport} from '../authoringWeekReport';
import {AuthoringWeekContent} from '../AuthoringWeekViewer';
import {decodeAuthoringRecipeCatalog, matchAuthoringRecipe} from '../authoringRecipeCatalog';
import AuthoringRecipeDetails from '../AuthoringRecipeDetails';

function fixture() {
  return {
    contract: 'potok-recipe-authoring-week-preview-v1', runtimePublishable: false, mayActivate: false,
    usage: 'OFFLINE_UNVERIFIED_REFERENCE_EXPERIMENT', portionBasis: 'ONE_SOURCE_DECLARED_SERVING_NO_SCALING',
    physicalReview: 'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING', status: 'REFERENCE_WEEK_PREVIEW', scope: 'BEST_EVALUATED_PREFIX',
    scenario: {dailyCalorieTarget: 1600, maxRecipeUses: 2, weekStart: '2026-11-02', slots: [{label: 'Обед'}]},
    source: {fileName: 'synthetic.xlsx', sha256: 'a'.repeat(64)},
    assumptions: [{slot: 'Обед', sourceCategories: ['LUNCH'], applicabilityVerified: false}], notAssessed: ['ALLERGENS'],
    days: Array.from({length: 7}, (_, i) => ({date: `2026-11-0${i + 2}`,
      referenceNutrition: {calories: '100.000', protein: '2.000', fat: '3.000', carbs: '4.000', fiber: '5.000'},
      meals: [{slot: 'Обед', recipeId: `synthetic-${i}`, name: `Тестовое блюдо ${i}`, sourcePrimaryCategory: 'LUNCH',
        sourceDeclaredServings: 2, assignedSourceServings: 1, measuredGrams: null, verified: false,
        referenceNutrition: {calories: 100, protein: 2, fat: 3, carbs: 4, fiber: 5}}],
    })),
  };
}
test('source portions are not divided again and unknown grams stay unknown', () => {
  const r = decodeAuthoringWeekReport(fixture());
  assert.equal(r.days[0].meals[0].referenceNutrition.calories, 100);
  assert.equal(r.days[0].meals[0].measuredGrams, null);
  assert.equal(r.days[0].meals[0].sourceDeclaredServings, 2);
});
test('trusted or activatable input is rejected', () => {
  for (const change of [{runtimePublishable: true}, {mayActivate: true}, {contract: 'graph-v2'}, {usage: 'VALID'}]) {
    assert.throws(() => decodeAuthoringWeekReport({...fixture(), ...change}));
  }
});
test('broken totals, dates, slots, repeated IDs and false measurement claims are rejected', () => {
  const mutations = [
    (r: ReturnType<typeof fixture>) => {r.days[0].referenceNutrition.calories = '0.000';},
    (r: ReturnType<typeof fixture>) => {r.days[1].date = r.days[0].date;},
    (r: ReturnType<typeof fixture>) => {r.days[0].meals[0].slot = 'Другой слот';},
    (r: ReturnType<typeof fixture>) => {r.days.forEach(d => {d.meals[0].recipeId = 'same';});},
    (r: ReturnType<typeof fixture>) => {r.days[0].meals[0].assignedSourceServings = 2;},
    (r: ReturnType<typeof fixture>) => {r.days[0].meals[0].verified = true;},
    (r: ReturnType<typeof fixture>) => {r.days[0].meals[0].referenceNutrition.fiber = NaN;},
  ];
  for (const mutate of mutations) {const r = fixture(); mutate(r); assert.throws(() => decodeAuthoringWeekReport(r));}
});
test('all no-week diagnostics remain distinct and cannot carry a menu', () => {
  for (const status of ['INCOMPLETE_CATEGORY_POOL', 'NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS', 'WEEK_SEARCH_LIMIT_REACHED', 'NO_REFERENCE_WEEK_IN_RETAINED_POOL']) {
    const r = {...fixture(), status, days: []};
    const decoded = decodeAuthoringWeekReport(r);
    assert.equal(decoded.status, status);
    const html = renderToStaticMarkup(<AuthoringWeekContent report={decoded} selectedDay={0} onSelectDay={() => {}} />);
    assert.match(html, /role="status"/); assert.doesNotMatch(html, /<article/);
    assert.throws(() => decodeAuthoringWeekReport({...r, days: fixture().days}));
  }
});
test('selected day rendering retains reference labels and escapes file-provided text', () => {
  const r = fixture(); r.days[2].meals[0].name = '<img src=x onerror=alert(1)>';
  const html = renderToStaticMarkup(<AuthoringWeekContent report={decodeAuthoringWeekReport(r)} selectedDay={2} onSelectDay={() => {}} />);
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img/);
  assert.match(html, /граммы не подтверждены/); assert.match(html, /У исходника/);
  assert.doesNotMatch(html, /Тестовое блюдо 0|Записать|Активировать|Сохранить/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
});

function catalogFixture() {
  return {contract: 'potok-recipe-authoring-test-catalog-v1', usage: 'OFFLINE_AUTHORING_TEST_INPUT_ONLY',
    runtimePublishable: false, mayActivate: false, physicalCookingBlocksDevelopment: false,
    referenceNutritionMustNotBePresentedAsVerified: true, source: {sha256: 'a'.repeat(64)},
    recipes: [{recipeId: 'synthetic-0', name: 'Тестовое блюдо 0', sourceStatus: 'DRAFT',
      sourceRecipe: {recipe_id: 'synthetic-0', owner_notes: null}, declaredServings: 2, declaredYieldG: null,
      measuredYieldG: null, confirmedServings: null, physicalReview: 'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',
      runtimePublishable: false, sourceTagsAreVerifiedRestrictions: false,
      referenceNutrition: {basis: 'SOURCE_DECLARED_PER_SERVING', verified: false,
        carbohydrateSemantics: 'UNVERIFIED_SOURCE_REFERENCE', values: {calories: 100, protein: 2, fat: 3, carbs: 4, fiber: 5}},
      ingredients: [{ingredient_row_id: 'i1', recipe_id: 'synthetic-0', sort_order: 1, ingredient_name_ru: 'Вода',
        amount: 200, unit: 'ML', weight_g: null, optional: false, preparation_note: null, notes: null}],
      steps: [{step_id: 's1', recipe_id: 'synthetic-0', step_number: 1, instruction_ru: 'Смешать.', duration_min: null, temperature_c: null, notes: null}],
    }],
  };
}
test('catalog linkage requires same source hash and exact ID, portions, name and reference values', () => {
  const report = decodeAuthoringWeekReport(fixture()), meal = report.days[0].meals[0];
  assert.ok(matchAuthoringRecipe(decodeAuthoringRecipeCatalog(catalogFixture()), report, meal).recipe);
  assert.ok(matchAuthoringRecipe(null, report, meal).error);
  for (const change of [
    (c: ReturnType<typeof catalogFixture>) => {c.source.sha256 = 'b'.repeat(64);},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].recipeId = 'missing'; c.recipes[0].sourceRecipe.recipe_id = 'missing'; c.recipes[0].ingredients = []; c.recipes[0].steps = [];},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].declaredServings = 3;},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].name = 'Другое название';},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].referenceNutrition.values.calories = 101;},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].sourceStatus = 'BLOCKED';},
  ]) {
    const c = catalogFixture(); change(c);
    const linked = matchAuthoringRecipe(decodeAuthoringRecipeCatalog(c), report, meal);
    assert.ok(linked.error); assert.equal(linked.recipe, undefined);
  }
});
test('catalog rejects approval claims, duplicate IDs, orphan children and invalid ingredient amounts', () => {
  for (const change of [
    (c: ReturnType<typeof catalogFixture>) => {c.runtimePublishable = true;},
    (c: ReturnType<typeof catalogFixture>) => {c.mayActivate = true;},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].referenceNutrition.verified = true;},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes.push(c.recipes[0]);},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].ingredients[0].recipe_id = 'other';},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].ingredients.push(c.recipes[0].ingredients[0]);},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].steps[0].recipe_id = 'other';},
    (c: ReturnType<typeof catalogFixture>) => {c.recipes[0].ingredients[0].amount = -1;},
  ]) {const c = catalogFixture(); change(c); assert.throws(() => decodeAuthoringRecipeCatalog(c));}
});
test('recipe details retain full batch quantities and do not convert milliliters into grams', () => {
  const recipe = decodeAuthoringRecipeCatalog(catalogFixture()).recipes.get('synthetic-0')!;
  const html = renderToStaticMarkup(<AuthoringRecipeDetails recipe={recipe} />);
  assert.match(html, /Ингредиенты на весь рецепт/);
  assert.match(html, /200 мл/); assert.doesNotMatch(html, /100 мл|200 г/);
  assert.match(html, /Масса по источнику: не указана/);
  assert.match(html, /Фактический выход и вес порции не подтверждены/);
  assert.match(html, /Подготовка по источнику: не уточнена/);
});
test('source order and raw text are retained, escaped and not replaced by invented content', () => {
  const c = catalogFixture(), s = c.recipes[0].steps[0];
  c.recipes[0].steps = [{...s, step_id: 's2', step_number: 2, instruction_ru: '<script>bad()</script>'}, s];
  const recipe = decodeAuthoringRecipeCatalog(c).recipes.get('synthetic-0')!;
  assert.deepEqual(recipe.steps.map(x => x.order), [1, 2]);
  const html = renderToStaticMarkup(<AuthoringRecipeDetails recipe={recipe} />);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  recipe.ingredients = []; recipe.steps = []; recipe.servings = null;
  const empty = renderToStaticMarkup(<AuthoringRecipeDetails recipe={recipe} />);
  assert.match(empty, /Ингредиенты в исходнике отсутствуют/);
  assert.match(empty, /Шаги приготовления в исходнике отсутствуют/);
  assert.match(empty, /Заявлено порций: не указано/);
});
test('week cards expose recipe details only for matched catalog records', () => {
  const report = decodeAuthoringWeekReport(fixture());
  const catalog = decodeAuthoringRecipeCatalog(catalogFixture());
  const html = renderToStaticMarkup(<AuthoringWeekContent report={report} selectedDay={0} onSelectDay={() => {}} catalog={catalog} />);
  assert.match(html, /Открыть рецепт/); assert.match(html, /Смешать\./);
  catalog.sourceHash = 'b'.repeat(64);
  const mismatch = renderToStaticMarkup(<AuthoringWeekContent report={report} selectedDay={0} onSelectDay={() => {}} catalog={catalog} />);
  assert.match(mismatch, /разным версиям сборника/); assert.doesNotMatch(mismatch, /Открыть рецепт|Смешать\./);
});
