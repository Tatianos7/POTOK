import assert from 'node:assert/strict';
import test from 'node:test';
import {
  broadManualSelectionQueries,
  foodSearchQualityCases,
  knownWarningQueries,
} from './food-search-quality-cases.js';
import { classifyQuery, normalizeSearchText } from './food-search-quality-audit.js';

const fakeFood = (overrides: Record<string, unknown> = {}) => ({
  id: 'food-1',
  stable_food_id: 'generic_food',
  canonical_food_id: 'food-1',
  name: 'Молоко',
  normalized_name: 'молоко',
  source: 'core',
  category: 'dairy',
  cooking_state: null,
  brand: null,
  calories: 60,
  protein: 3,
  fat: 3,
  carbs: 5,
  fiber: null,
  verified: true,
  popularity: 100,
  ...overrides,
});

const ranked = (food: Record<string, unknown>, rank = 1, matchSource = 'canonical_exact') => ({
  rank,
  food: fakeFood(food),
  matchSource,
  score: 100,
  reason: 'fixture',
});

test('quality matrix covers common queries and known warnings', () => {
  assert.equal(foodSearchQualityCases.length, 50);

  const queries = foodSearchQualityCases.map((item) => item.query);
  assert.equal(new Set(queries).size, queries.length);

  for (const query of knownWarningQueries) {
    assert.ok(queries.includes(query));
  }
});

test('manual-selection matrix keeps broad unsafe nutrition queries explicit', () => {
  for (const query of ['овсянка', 'сыр', 'хлеб', 'чай', 'рыба', 'кофе']) {
    assert.ok(broadManualSelectionQueries.includes(query));
  }
});

test('normalization handles punctuation and whitespace', () => {
  assert.equal(normalizeSearchText(' Чай-зелёный!!  '), 'чай зелёный');
  assert.equal(normalizeSearchText('овсянка/хлопья'), 'овсянка хлопья');
});

test('required generic query reports missing canonical product', () => {
  const issues = classifyQuery(
    { query: 'йогурт', group: 'dairy', genericPolicy: 'required', notes: 'plain yogurt expected' },
    null,
    [],
    []
  );

  assert.equal(issues[0]?.code, 'MISSING_GENERIC_CANONICAL');
});

test('required generic query reports low-rank generic product', () => {
  const generic = fakeFood({ id: 'generic-yogurt', stable_food_id: 'yogurt', name: 'Йогурт', normalized_name: 'йогурт' });
  const issues = classifyQuery(
    { query: 'йогурт', group: 'dairy', genericPolicy: 'required', notes: 'plain yogurt expected' },
    generic as never,
    [],
    [
      ranked({ id: 'specific-1', stable_food_id: 'yogurt_strawberry', name: 'Йогурт клубничный' }, 1, 'canonical_prefix'),
      ranked({ id: 'specific-2', stable_food_id: 'yogurt_greek', name: 'Йогурт греческий' }, 2, 'canonical_prefix'),
      ranked({ id: 'specific-3', stable_food_id: 'yogurt_drink', name: 'Йогурт питьевой' }, 3, 'canonical_prefix'),
      ranked(generic, 4, 'canonical_exact'),
    ] as never
  );

  assert.ok(issues.some((issue) => issue.code === 'GENERIC_EXISTS_LOW_RANK'));
});

test('manual-selection query is classified as broad choice list', () => {
  const issues = classifyQuery(
    { query: 'сыр', group: 'dairy', genericPolicy: 'manual_selection', notes: 'cheese varies materially' },
    null,
    [],
    [ranked({ id: 'cheese-1', stable_food_id: 'cheese_gouda', name: 'Сыр гауда' })] as never
  );

  assert.equal(issues[0]?.code, 'BROAD_QUERY_SHOULD_SHOW_CHOICES');
});

test('duplicate canonical ids in top10 are reported', () => {
  const issues = classifyQuery(
    { query: 'молоко', group: 'dairy', genericPolicy: 'required', notes: 'plain milk expected' },
    fakeFood({ id: 'milk-1', stable_food_id: 'milk' }) as never,
    [],
    [
      ranked({ id: 'milk-1', stable_food_id: 'milk', name: 'Молоко' }, 1),
      ranked({ id: 'milk-2', stable_food_id: 'milk', name: 'Молоко пастеризованное' }, 2, 'canonical_prefix'),
    ] as never
  );

  assert.ok(issues.some((issue) => issue.code === 'DUPLICATE_CANONICAL_RESULT'));
});

test('exact alias mapping to multiple foods is reported', () => {
  const issues = classifyQuery(
    { query: 'овсянка', group: 'grains', genericPolicy: 'manual_selection', notes: 'ambiguous raw/cooked query' },
    null,
    [
      fakeFood({ id: 'oats-flakes', stable_food_id: 'oat_flakes', name: 'Овсяные хлопья' }),
      fakeFood({ id: 'oatmeal-cooked', stable_food_id: 'oatmeal_cooked', name: 'Каша овсяная' }),
    ] as never,
    []
  );

  assert.ok(issues.some((issue) => issue.code === 'ALIAS_TARGET_WRONG'));
});

test('acceptable exact generic query stays acceptable', () => {
  const generic = fakeFood({ id: 'banana', stable_food_id: 'banana', name: 'Банан', normalized_name: 'банан' });
  const issues = classifyQuery(
    { query: 'банан', group: 'fruits', genericPolicy: 'required', notes: 'plain banana expected' },
    generic as never,
    [],
    [ranked(generic, 1)] as never
  );

  assert.deepEqual(issues.map((issue) => issue.code), ['ACCEPTABLE']);
});
