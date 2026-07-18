import test from 'node:test';
import assert from 'node:assert/strict';

import { foodService } from '../foodService';
import { analyzeRecipeTextReal } from '../recipeAnalyzerReal';
import { calcTotals } from '../../utils/nutritionCalculator';
import { parseRecipeText } from '../../utils/recipeParser';

const FOOD_CORE = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    canonical_food_id: '55555555-5555-4555-8555-555555555555',
    stable_food_id: 'lentil_sprouts',
    name: 'Чечевица (ростки)',
    normalized_name: 'чечевица ростки',
    aliases: ['чечевица'],
    source: 'core',
    calories: 106,
    protein: 9,
    fat: 0.6,
    carbs: 22.1,
  },
  {
    id: '11111111-1111-4111-8111-111111111111',
    canonical_food_id: '11111111-1111-4111-8111-111111111111',
    stable_food_id: 'lentils_raw',
    name: 'Чечевица',
    normalized_name: 'чечевица',
    aliases: ['чечевица'],
    source: 'core',
    calories: 352,
    protein: 24.6,
    fat: 1.1,
    carbs: 52.7,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    canonical_food_id: '22222222-2222-4222-8222-222222222222',
    stable_food_id: 'water',
    name: 'Вода',
    normalized_name: 'вода',
    aliases: ['вода'],
    source: 'core',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    canonical_food_id: '33333333-3333-4333-8333-333333333333',
    stable_food_id: 'onion',
    name: 'Лук репчатый',
    normalized_name: 'лук репчатый',
    aliases: ['лук'],
    source: 'core',
    calories: 47,
    protein: 1.4,
    fat: 0,
    carbs: 10.4,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    canonical_food_id: '44444444-4444-4444-8444-444444444444',
    stable_food_id: 'beef',
    name: 'Говядина',
    normalized_name: 'говядина',
    aliases: ['говядина'],
    source: 'core',
    calories: 187,
    protein: 18.9,
    fat: 12.4,
    carbs: 0,
  },
];

test('recipe analyzer resolves Food Core rollout soup example and preserves display units', async () => {
  const originalSearch = foodService.search;

  (foodService as any).search = async (query: string) => {
    const q = query.toLowerCase().trim();
    return FOOD_CORE.filter((food) => (
      food.name.toLowerCase() === q ||
      food.normalized_name === q ||
      food.name.toLowerCase().startsWith(`${q} `) ||
      food.normalized_name.startsWith(`${q} `) ||
      food.aliases.some((alias) => alias === q)
    ));
  };

  try {
    const input = '250 грамм чечевицы, вода 500 мл., лук репчатый 1 шт., говядина 300 грамм';
    const parsed = parseRecipeText(input);

    assert.deepEqual(
      parsed.map((item) => ({
        name: item.name,
        amountText: item.amountText,
        amountGrams: item.amountGrams,
        gramsEquivalent: item.gramsEquivalent,
        display: `${item.displayAmount} ${item.displayUnit}`,
      })),
      [
        { name: 'чечевица', amountText: '250 г', amountGrams: 250, gramsEquivalent: 250, display: '250 г' },
        { name: 'вода', amountText: '500 мл', amountGrams: 500, gramsEquivalent: 500, display: '500 мл' },
        { name: 'лук репчатый', amountText: '1 шт', amountGrams: 110, gramsEquivalent: 110, display: '1 шт' },
        { name: 'говядина', amountText: '300 г', amountGrams: 300, gramsEquivalent: 300, display: '300 г' },
      ]
    );

    const analyzed = await analyzeRecipeTextReal(input);

    assert.equal(analyzed.length, 4);
    assert.equal(analyzed.every((item) => item.resolution_status === 'resolved'), true);
    assert.equal(analyzed.every((item) => item.canonical_food_id), true);

    const lentils = analyzed.find((item) => item.name === 'чечевица');
    assert.ok(lentils);
    assert.equal(lentils.resolved_food_name, 'Чечевица');
    assert.equal(lentils.proteins > 0, true);
    assert.equal(lentils.carbs > 0, true);

    const water = analyzed.find((item) => item.name === 'вода');
    assert.equal(water?.amountText, '500 мл');
    assert.equal(water?.gramsEquivalent, 500);

    const onion = analyzed.find((item) => item.name === 'лук репчатый');
    assert.equal(onion?.amountText, '1 шт');
    assert.equal(onion?.gramsEquivalent, 110);

    const totals = calcTotals(analyzed);
    assert.equal(totals.total.calories > 0, true);
    assert.equal(totals.total.proteins > 0, true);
    assert.equal(totals.total.carbs > 0, true);
  } finally {
    (foodService as any).search = originalSearch;
  }
});

test('recipe analyzer does not silently resolve base lentils to sprouts', async () => {
  const originalSearch = foodService.search;

  (foodService as any).search = async (query: string) => {
    const q = query.toLowerCase().trim();
    if (q === 'чечевица') {
      return [FOOD_CORE[0]];
    }
    return [];
  };

  try {
    const analyzed = await analyzeRecipeTextReal('250 грамм чечевицы');
    assert.equal(analyzed.length, 1);
    assert.equal(analyzed[0].resolution_status, 'unresolved');
    assert.equal(analyzed[0].resolution_reason, 'catalog_unmatched');
    assert.equal(analyzed[0].amountText, '250 г');
    assert.deepEqual(analyzed[0].candidate_food_names, ['Чечевица (ростки)']);
  } finally {
    (foodService as any).search = originalSearch;
  }
});

test('recipe analyzer flags unresolved pieces instead of silently using one gram or zero macros', async () => {
  const originalSearch = foodService.search;
  (foodService as any).search = async () => [];

  try {
    const analyzed = await analyzeRecipeTextReal('ягода 1 шт.');
    assert.equal(analyzed.length, 1);
    assert.equal(analyzed[0].resolution_status, 'unresolved');
    assert.equal(analyzed[0].resolution_reason, 'unit_conversion_missing');
    assert.equal(analyzed[0].amountText, '1 шт');
    assert.equal(analyzed[0].amountGrams, 0);
    assert.match(analyzed[0].warning ?? '', /нет правила/i);
  } finally {
    (foodService as any).search = originalSearch;
  }
});
