import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

test('food diary exposes nutrition progress entry point', () => {
  const source = readFileSync(resolve(currentDir, '../FoodDiary.tsx'), 'utf8');

  assert.match(source, /TrendingUp/);
  assert.match(source, /navigate\('\/progress\/nutrition'\)/);
  assert.match(source, /Открыть прогресс питания/);
  assert.match(source, /Прогресс питания/);
  assert.doesNotMatch(source, /Анализ продукта по фото/);
  assert.doesNotMatch(source, /PhotoFoodAnalyzerModal/);
});

test('nutrition progress closes back to food diary', () => {
  const source = readFileSync(resolve(currentDir, '../ProgressNutrition.tsx'), 'utf8');

  assert.match(source, /aria-label="Закрыть"/);
  assert.match(source, /navigate\('\/nutrition'\)/);
});
