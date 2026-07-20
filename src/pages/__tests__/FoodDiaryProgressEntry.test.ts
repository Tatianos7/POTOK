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
});
