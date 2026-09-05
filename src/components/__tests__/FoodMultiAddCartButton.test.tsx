import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import FoodMultiAddCartButton from '../FoodMultiAddCartButton';

const totals = {
  weight: 150,
  calories: 240,
  protein: 20,
  fat: 8,
  carbs: 24,
};

test('basket empty hides bottom cart button', () => {
  const html = renderToStaticMarkup(
    <FoodMultiAddCartButton count={0} totals={totals} onClick={() => {}} />
  );

  assert.equal(html, '');
});

test('basket not empty shows compact bottom bar button with selected count and calories', () => {
  const html = renderToStaticMarkup(
    <FoodMultiAddCartButton count={2} totals={totals} onClick={() => {}} />
  );

  assert.match(html, /Выбрано 2/);
  assert.match(html, /240 ккал/);
  assert.match(html, /inline-flex/);
  assert.doesNotMatch(html, /bottom-20/);
  assert.doesNotMatch(html, /w-full/);
});
