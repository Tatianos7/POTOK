import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function readSource(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

test('exercise catalog bootstrap stays read-only on the client', () => {
  const source = readSource('src/utils/initializeExerciseData.ts');

  assert.doesNotMatch(source, /\.insert\s*\(/);
  assert.doesNotMatch(source, /\.upsert\s*\(/);
  assert.doesNotMatch(source, /basicCategories/);
  assert.match(source, /shared read-only catalog/);
});

test('app startup does not query exercise categories before auth is ready', () => {
  const source = readSource('src/main.tsx');

  assert.doesNotMatch(source, /initializeExerciseData/);
});

test('workout page does not try to create shared exercise categories', () => {
  const source = readSource('src/pages/Workouts.tsx');

  assert.doesNotMatch(source, /initializeExerciseData/);
  assert.doesNotMatch(source, /Категории не найдены, запускаем инициализацию/);
  assert.match(source, /shared read-only catalog/);
});
