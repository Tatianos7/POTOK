import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import FoodMultiAddCartSheet from '../FoodMultiAddCartSheet';
import { createFoodDiaryMultiAddDraft, getFoodDiaryMultiAddTotals } from '../../utils/foodDiaryMultiAdd';
import type { Food } from '../../types';

const foodId = '11111111-1111-4111-8111-111111111111';

const food: Food = {
  id: foodId,
  name: 'Овсянка',
  calories: 370,
  protein: 12,
  fat: 6,
  carbs: 65,
  source: 'core',
  canonical_food_id: foodId,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
};

test('closed cart sheet renders nothing', () => {
  const draft = createFoodDiaryMultiAddDraft(food, 40);
  const html = renderToStaticMarkup(
    <FoodMultiAddCartSheet
      isOpen={false}
      drafts={[draft]}
      totals={getFoodDiaryMultiAddTotals([draft])}
      highlightedKey={null}
      error={null}
      isSaving={false}
      canSave={true}
      onClose={() => {}}
      onAddMore={() => {}}
      onClear={() => {}}
      onSave={() => {}}
      onRemove={() => {}}
      onChange={() => {}}
    />
  );

  assert.equal(html, '');
});

test('cart sheet shows selected products, grams controls, totals and save actions', () => {
  const draft = createFoodDiaryMultiAddDraft(food, 40);
  const html = renderToStaticMarkup(
    <FoodMultiAddCartSheet
      isOpen={true}
      drafts={[draft]}
      totals={getFoodDiaryMultiAddTotals([draft])}
      highlightedKey={null}
      error={null}
      isSaving={false}
      canSave={true}
      onClose={() => {}}
      onAddMore={() => {}}
      onClear={() => {}}
      onSave={() => {}}
      onRemove={() => {}}
      onChange={() => {}}
    />
  );

  assert.match(html, /Корзина приёма пищи/);
  assert.match(html, /Овсянка/);
  assert.match(html, /value="40"/);
  assert.match(html, /Итого:/);
  assert.match(html, /Добавить ещё/);
  assert.match(html, /Очистить/);
  assert.match(html, /Сохранить/);
});

test('invalid grams block save inside cart sheet', () => {
  const draft = { ...createFoodDiaryMultiAddDraft(food, 40), quantity: '0' };
  const html = renderToStaticMarkup(
    <FoodMultiAddCartSheet
      isOpen={true}
      drafts={[draft]}
      totals={getFoodDiaryMultiAddTotals([draft])}
      highlightedKey={null}
      error={null}
      isSaving={false}
      canSave={false}
      onClose={() => {}}
      onAddMore={() => {}}
      onClear={() => {}}
      onSave={() => {}}
      onRemove={() => {}}
      onChange={() => {}}
    />
  );

  assert.match(html, /Количество должно быть больше нуля/);
  assert.match(html, /disabled=""/);
});
