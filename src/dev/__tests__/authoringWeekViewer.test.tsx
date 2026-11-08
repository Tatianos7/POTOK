import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {decodeAuthoringWeekReport} from '../authoringWeekReport';
import {AuthoringWeekContent} from '../AuthoringWeekViewer';
import {authoringSearchInput, decodeAuthoringRecipeCatalog, matchAuthoringRecipe} from '../authoringRecipeCatalog';
import AuthoringRecipeDetails from '../AuthoringRecipeDetails';
import {selectAuthoringWeek} from '../authoringSelectionView';
import {previewRecipeAuthoringWeekV1} from '../authoringWeekSearchV1';
import {referenceCalorieCorridorV1} from '../referenceCalorieCorridorV1';
import scenario from '../../../docs/premium/authoring-week-scenario-20261103.json';

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

test('calorie card distinguishes target from actual menu and states the precise shortfall', () => {
  const raw=fixture();raw.scenario.dailyCalorieTarget=1800;
  raw.days[0].meals[0].referenceNutrition.calories=1671;raw.days[0].referenceNutrition.calories='1671.000';
  const report=decodeAuthoringWeekReport(raw);
  const html=renderToStaticMarkup(<AuthoringWeekContent report={report} selectedDay={0} onSelectDay={()=>{}} />);
  assert.ok(html.includes('Цель:'));assert.ok(html.includes('Меню:'));
  assert.ok(html.includes('Ниже цели на 129 ккал (7,17%).'));assert.ok(!html.includes('Совпадает с целью'));
});

test('report decoder independently refuses either corridor boundary violation', () => {
  for(const kcal of [1550,1600,1650,1549.999,1650.001]){
    const raw=fixture();raw.scenario.dailyCalorieTarget=1600;
    for(const d of raw.days){d.meals[0].referenceNutrition.calories=kcal;d.referenceNutrition.calories=kcal.toFixed(3);}
    const packet={...raw,calorieCorridor:referenceCalorieCorridorV1(1600)};
    if(kcal>=1550&&kcal<=1650){const view=decodeAuthoringWeekReport(packet);assert.equal(view.days.length,7);assert.equal(view.calorieCorridor?.minimumKcal,1550);}
    else assert.throws(()=>decodeAuthoringWeekReport(packet));
  }
  const raw=fixture();
  assert.throws(()=>decodeAuthoringWeekReport({...raw,status:'NO_REFERENCE_WEEK_IN_CALORIE_CORRIDOR',days:[]}));
  assert.throws(()=>decodeAuthoringWeekReport({...raw,calorieCorridor:{contract:'potok-reference-calorie-corridor-v1',minimumKcal:1600,maximumKcal:1700}}));
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
    referenceNutritionMustNotBePresentedAsVerified: true, source: {sha256: 'a'.repeat(64), fileName: 'synthetic.xlsx', bytes: 1},
    recipes: [{recipeId: 'synthetic-0', name: 'Тестовое блюдо 0', sourceStatus: 'DRAFT',
      sourceRecipe: {recipe_id: 'synthetic-0', owner_notes: null, meal_type_primary: 'LUNCH'}, declaredServings: 2, declaredYieldG: null,
      numericReferenceTestInputAvailable: true,
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

function selectionFixture() {
  const c = catalogFixture(), template = c.recipes[0];
  c.recipes = [];
  for (const [category, calories] of [['BREAKFAST', 400], ['LUNCH', 500], ['SNACK', 200]] as const) {
    for (let i = 0; i < 12; i++) {
      const r = structuredClone(template), id = `${category}-${i}`;
      r.recipeId = id; r.name = id; r.sourceRecipe.recipe_id = id; r.sourceRecipe.meal_type_primary = category;
      r.referenceNutrition.values.calories = calories;
      r.ingredients[0].recipe_id = id; r.steps[0].recipe_id = id;
      c.recipes.push(r);
    }
  }
  return decodeAuthoringRecipeCatalog(c);
}
test('selection connects the same bounded producer to the viewer and recipe cards without a report file', () => {
  const catalog = selectionFixture(), before = JSON.stringify([...catalog.recipes]);
  const r = selectAuthoringWeek(catalog, 1600, '2026-11-09');
  assert.equal(r.status, 'REFERENCE_WEEK_PREVIEW'); assert.equal(r.days.length, 7);
  assert.equal(r.days[0].date, '2026-11-09'); assert.equal(r.days[6].date, '2026-11-15');
  const expected = decodeAuthoringWeekReport(previewRecipeAuthoringWeekV1(authoringSearchInput(catalog),
    {...scenario, contract: 'potok-authoring-week-scenario-v1', dailyCalorieTarget: 1600, weekStart: '2026-11-09'}));
  assert.deepEqual(r, expected);
  for (const day of r.days) {
    assert.equal(day.meals.length, 4); assert.equal(day.referenceNutrition.calories, 1600);
    for (const meal of day.meals) {assert.equal(meal.assignedSourceServings, 1); assert.equal(meal.measuredGrams, null); assert.ok(matchAuthoringRecipe(catalog, r, meal).recipe);}
  }
  assert.equal(JSON.stringify([...catalog.recipes]), before);
});
test('no-week result remains empty and scenario bounds never relax silently', () => {
  const c = selectionFixture(), r = selectAuthoringWeek(c, 2000, '2026-11-02');
  assert.equal(r.status, 'NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS'); assert.deepEqual(r.days, []);
  assert.throws(() => selectAuthoringWeek(c, 1700, '2026-11-02'));
  assert.throws(() => selectAuthoringWeek(c, 1600, '2026-02-30'));
  for (const recipe of c.recipes.values()) recipe.numericReferenceTestInputAvailable = false;
  assert.equal(selectAuthoringWeek(c, 1600, '2026-11-02').status, 'INCOMPLETE_CATEGORY_POOL');
});
