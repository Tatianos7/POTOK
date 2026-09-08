import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import AddProductModal, { buildAddProductModalActions } from '../AddProductModal';

test('add product modal shows new entries above existing unchanged buttons', () => {
  const html = renderToStaticMarkup(<AddProductModal onClose={() => {}} />);
  const labels = [
    'Найти продукт',
    'Мои продукты',
    'Ввод марки продукта',
    'Ввод своего продукта',
    'Анализатор рецепта',
  ];

  for (const label of labels) {
    assert.match(html, new RegExp(label));
  }

  const positions = labels.map((label) => html.indexOf(label));
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b)
  );
});

test('add product modal actions keep existing labels and wire new handlers', () => {
  const calls: string[] = [];
  const actions = buildAddProductModalActions({
    onClose: () => calls.push('close'),
    onFindProduct: () => calls.push('find'),
    onMyProducts: () => calls.push('my-products'),
    onBrandInput: () => calls.push('brand'),
    onCustomInput: () => calls.push('custom'),
    onRecipeAnalyzer: () => calls.push('recipe'),
  });

  assert.deepEqual(
    actions.map((action) => action.label),
    [
      'Найти продукт',
      'Мои продукты',
      'Ввод марки продукта',
      'Ввод своего продукта',
      'Анализатор рецепта',
    ]
  );

  actions[0].onClick();
  actions[1].onClick();
  actions[2].onClick();
  actions[3].onClick();
  actions[4].onClick();

  assert.deepEqual(calls, ['find', 'my-products', 'brand', 'custom', 'recipe']);
});
