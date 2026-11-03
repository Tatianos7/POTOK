import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {decodeAuthoringWeekReport} from '../authoringWeekReport';
import {AuthoringWeekContent} from '../AuthoringWeekViewer';

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
