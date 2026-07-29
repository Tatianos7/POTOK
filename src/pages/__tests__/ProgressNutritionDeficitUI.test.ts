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

test('nutrition progress recommendation colors use green for good and amber for warnings/actions', () => {
  assert.match(source, /accent: 'border-l-emerald-200'/);
  assert.match(source, /icon: 'bg-emerald-500\/10 text-emerald-700'/);
  assert.match(source, /accent: 'border-l-amber-200'/);
  assert.match(source, /icon: 'bg-amber-500\/10 text-amber-700'/);
  assert.doesNotMatch(source, /accent: 'border-l-stone-300'/);
});

test('nutrition progress empty state is compact and shares recommendation styling', () => {
  assert.match(source, /border-l-4 border-l-amber-200 p-4/);
  assert.match(source, /Добавьте записи в дневник, чтобы увидеть калории, БЖУ и рекомендации\./);
  assert.doesNotMatch(source, /UtensilsCrossed/);
  assert.doesNotMatch(source, /h-14 w-14/);
  assert.doesNotMatch(source, /bg-stone-900 text-white/);
  assert.doesNotMatch(source, /radial-gradient/);
});

test('nutrition progress summary does not duplicate low coverage warning copy', () => {
  assert.doesNotMatch(source, /Данных пока мало: часть дней в периоде не заполнена/);
});
