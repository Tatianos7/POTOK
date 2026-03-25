import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import AddFoodToMealModal from '../AddFoodToMealModal';
import type { Food } from '../../types';

function buildFood(overrides: Partial<Food> = {}): Food {
  const now = new Date('2026-03-23T12:00:00.000Z').toISOString();
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Кефир',
    calories: 52,
    protein: 2.8,
    fat: 2.5,
    carbs: 4,
    fiber: 0,
    source: 'core',
    canonical_food_id: '11111111-1111-1111-1111-111111111111',
    createdAt: now,
    updatedAt: now,
    unit: 'мл',
    category: 'dairy',
    ...overrides,
  };
}

test('add modal hides quick 100 g button but keeps grams in dropdown', () => {
  const html = renderToStaticMarkup(
    <AddFoodToMealModal
      food={buildFood()}
      isOpen={true}
      onClose={() => {}}
      onAdd={() => {}}
    />
  );

  assert.doesNotMatch(html, />100 г</);
  assert.match(html, /<option value="г"(?: selected="")?>г<\/option>/);
});
