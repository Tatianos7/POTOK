import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import RecipeAnalyzerResult from '../RecipeAnalyzerResult';

test('analyzer result shows meaningful unresolved warning when recipe is not ready to save', () => {
  const html = renderToStaticMarkup(
    <RecipeAnalyzerResult
      items={[]}
      totals={{
        total: { proteins: 0, fats: 0, carbs: 0, calories: 0, weight: 0 },
        per100: { proteins: 0, fats: 0, carbs: 0, calories: 0 },
      }}
      onSaveMenu={() => {}}
      onSaveRecipes={() => {}}
      onSaveBoth={() => {}}
      unresolvedIngredientNames={['Молоко', 'Сливки']}
    />
  );

  assert.match(html, /нужно подтвердить ингредиенты из каталога/i);
  assert.match(html, /Молоко/);
  assert.match(html, /Сливки/);
});

test('analyzer result renders original units while calculations can use gram equivalents', () => {
  const html = renderToStaticMarkup(
    <RecipeAnalyzerResult
      items={[
        {
          original: 'вода 500 мл.',
          name: 'вода',
          amount: 500,
          unit: 'ml',
          amountText: '500 мл',
          amountGrams: 500,
          gramsEquivalent: 500,
          originalAmount: 500,
          originalUnit: 'мл',
          quantity: 500,
          quantity_g: 500,
          displayAmount: '500',
          displayUnit: 'мл',
          proteins: 0,
          fats: 0,
          carbs: 0,
          calories: 0,
          canonical_food_id: '22222222-2222-4222-8222-222222222222',
          resolution_status: 'resolved',
          resolution_reason: 'catalog_match',
          resolved_food_name: 'Вода',
        },
        {
          original: 'лук репчатый 1 шт.',
          name: 'лук репчатый',
          amount: 1,
          unit: 'pcs',
          amountText: '1 шт',
          amountGrams: 110,
          gramsEquivalent: 110,
          originalAmount: 1,
          originalUnit: 'шт',
          quantity: 1,
          quantity_g: 110,
          displayAmount: '1',
          displayUnit: 'шт',
          proteins: 1.54,
          fats: 0,
          carbs: 11.44,
          calories: 51.7,
          canonical_food_id: '33333333-3333-4333-8333-333333333333',
          resolution_status: 'resolved',
          resolution_reason: 'catalog_match',
          resolved_food_name: 'Лук репчатый',
        },
      ]}
      totals={{
        total: { proteins: 1.54, fats: 0, carbs: 11.44, calories: 51.7, weight: 610 },
        per100: { proteins: 0.25, fats: 0, carbs: 1.88, calories: 8.48 },
      }}
      onSaveMenu={() => {}}
      onSaveRecipes={() => {}}
      onSaveBoth={() => {}}
    />
  );

  assert.match(html, /500 мл/);
  assert.match(html, /1 шт/);
  assert.doesNotMatch(html, /500 г/);
  assert.doesNotMatch(html, /1 г/);
  assert.match(html, /data-original-unit="мл"/);
  assert.match(html, /data-original-unit="шт"/);
  assert.match(html, /data-grams-equivalent="110"/);
});
