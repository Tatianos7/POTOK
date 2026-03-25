import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import FoodSourceBadge from '../FoodSourceBadge';

test('renders "Мой" badge for user food', () => {
  const html = renderToStaticMarkup(
    <FoodSourceBadge food={{ source: 'user' }} />
  );

  assert.match(html, /Мой/);
});

test('renders "Бренд" badge for brand food', () => {
  const html = renderToStaticMarkup(
    <FoodSourceBadge food={{ source: 'brand' }} />
  );

  assert.match(html, /Бренд/);
});

test('renders nothing for core food', () => {
  const html = renderToStaticMarkup(
    <FoodSourceBadge food={{ source: 'core' }} />
  );

  assert.equal(html, '');
});
