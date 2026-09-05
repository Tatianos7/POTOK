import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import ProductCard from '../ProductCard';
import type { Food } from '../../types';

function buildFood(): Food {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Овсянка',
    calories: 370,
    protein: 12,
    fat: 6,
    carbs: 65,
    source: 'core',
    canonical_food_id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  };
}

test('product result card exposes plus add action for multi-add basket', () => {
  const html = renderToStaticMarkup(
    <ProductCard food={buildFood()} onClick={() => {}} onAddClick={() => {}} />
  );

  assert.match(html, /aria-label="Добавить продукт"/);
  assert.match(html, /title="Добавить"/);
});

test('product result card shows selected state when product is already in basket', () => {
  const html = renderToStaticMarkup(
    <ProductCard food={buildFood()} onClick={() => {}} onAddClick={() => {}} isAdded />
  );

  assert.match(html, /aria-label="Продукт добавлен"/);
  assert.match(html, /title="Добавлено"/);
  assert.match(html, /disabled=""/);
});
