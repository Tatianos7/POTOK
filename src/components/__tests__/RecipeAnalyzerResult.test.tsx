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
