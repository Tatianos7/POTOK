import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, '../ProgressNutrition.tsx'), 'utf8');

test('nutrition progress UI derives daily target from period target and period days', () => {
  assert.match(source, /Math\.round\(data\.deficit\.target_calories \/ periodDays\)/);
});

test('nutrition progress UI exposes deficit, surplus, low coverage, and missing goal states', () => {
  assert.match(source, /`Дефицит \$\{formatNumber\(value\)\} ккал`/);
  assert.match(source, /`Профицит \$\{formatNumber\(Math\.abs\(value\)\)\} ккал`/);
  assert.match(source, /'Недостаточно записей'/);
  assert.match(source, /'Цель не задана'/);
});

test('nutrition progress UI uses one recommendation block instead of split helps and fixes blocks', () => {
  assert.match(source, /Что сделать дальше/);
  assert.doesNotMatch(source, /Что помогает/);
  assert.doesNotMatch(source, /Что стоит поправить/);
});

test('nutrition progress recommendation copy covers good, sparse, surplus, and macro states', () => {
  assert.match(source, /Вы верно двигаетесь к цели\. Продолжайте в том же темпе\./);
  assert.match(source, /Заполнено \$\{daysWithData\} из \$\{periodDays\} дней\. Добавляйте записи чаще/);
  assert.match(source, /Попробуйте сократить порции или самые калорийные продукты/);
  assert.match(source, /Белка ниже цели/);
});

test('nutrition progress recommendation block is visually lightweight', () => {
  assert.match(source, /border-l-4 p-4 \$\{recommendationStyle\.accent\}/);
  assert.match(source, /h-7 w-7/);
  assert.doesNotMatch(source, /recommendationStyle\.panel/);
});
