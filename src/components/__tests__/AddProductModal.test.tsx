import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import AddProductModal, { MyProductsView, buildAddProductModalActions } from '../AddProductModal';
import type { Food } from '../../types';
import { filterVisibleUserFoods } from '../../utils/myProductsVisibility';

function buildFood(overrides: Partial<Food>): Food {
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    name: overrides.name ?? 'Домашний творог',
    calories: overrides.calories ?? 120,
    protein: overrides.protein ?? 16,
    fat: overrides.fat ?? 5,
    carbs: overrides.carbs ?? 3,
    brand: overrides.brand ?? null,
    source: overrides.source ?? 'user',
    created_by_user_id: overrides.created_by_user_id ?? 'user-1',
    canonical_food_id: overrides.canonical_food_id ?? overrides.id ?? '11111111-1111-4111-8111-111111111111',
    createdAt: overrides.createdAt ?? '2026-09-08T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

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

test('my products view renders empty state and custom product CTA', () => {
  const html = renderToStaticMarkup(
    <MyProductsView
      foods={[]}
      status="ready"
      mealType=""
      mealTypeError={null}
      onMealTypeChange={() => {}}
      onSelectFood={() => {}}
      onAddCustomFood={() => {}}
      onBack={() => {}}
    />
  );

  assert.match(html, /Мои продукты/);
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /role="group"/);
  assert.match(html, /Завтрак/);
  assert.match(html, /Обед/);
  assert.match(html, /Ужин/);
  assert.match(html, /Перекус/);
  assert.match(html, /Выберите приём пищи/);
  assert.match(html, /Вы ещё не добавляли свои продукты/);
  assert.match(html, /Создайте продукт один раз/);
  assert.match(html, /Добавить свой продукт/);
});

test('my products meal selector shows selected meal as pressed pill', () => {
  const html = renderToStaticMarkup(
    <MyProductsView
      foods={[]}
      status="ready"
      mealType="lunch"
      mealTypeError={null}
      onMealTypeChange={() => {}}
      onSelectFood={() => {}}
      onAddCustomFood={() => {}}
      onBack={() => {}}
    />
  );

  assert.match(html, /aria-pressed="true"[^>]*>Обед/);
  assert.match(html, /border-gray-900 bg-gray-900 text-white/);
  assert.match(html, /Выбрано/);
});

test('my products meal selector renders soft error when meal is required', () => {
  const html = renderToStaticMarkup(
    <MyProductsView
      foods={[]}
      status="ready"
      mealType=""
      mealTypeError="Выберите приём пищи"
      onMealTypeChange={() => {}}
      onSelectFood={() => {}}
      onAddCustomFood={() => {}}
      onBack={() => {}}
    />
  );

  assert.match(html, /text-red-600/);
  assert.match(html, /Выберите приём пищи/);
});

test('my products filtering keeps only current user private foods', () => {
  const visible = buildFood({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Домашний творог',
    brand: 'Кухня',
  });
  const foods = [
    visible,
    buildFood({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Гречка',
      source: 'core',
      created_by_user_id: null,
    }),
    buildFood({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Батончик',
      source: 'brand',
      created_by_user_id: null,
    }),
    buildFood({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Чужой продукт',
      created_by_user_id: 'user-2',
    }),
  ];

  const filtered = filterVisibleUserFoods(foods, 'user-1');
  const html = renderToStaticMarkup(
    <MyProductsView
      foods={filtered}
      status="ready"
      mealType="breakfast"
      mealTypeError={null}
      onMealTypeChange={() => {}}
      onSelectFood={() => {}}
      onAddCustomFood={() => {}}
      onBack={() => {}}
    />
  );

  assert.deepEqual(filtered.map((food) => food.id), [visible.id]);
  assert.match(html, /Домашний творог/);
  assert.match(html, /Кухня/);
  assert.match(html, /120 ккал · Б 16 · Ж 5 · У 3 \/ 100 г/);
  assert.doesNotMatch(html, /Гречка/);
  assert.doesNotMatch(html, /Батончик/);
  assert.doesNotMatch(html, /Чужой продукт/);
});
