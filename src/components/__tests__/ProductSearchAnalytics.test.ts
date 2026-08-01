import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, '../ProductSearch.tsx'), 'utf8');

test('ProductSearch waits for selection analytics before invoking selection callback', () => {
  assert.match(source, /const handleSelect = async \(food: Food\) => \{/);
  assert.match(source, /await searchAnalyticsService\.logSelection\(\{/);
  assert.doesNotMatch(source, /void searchAnalyticsService\.logSelection\(\{/);
  assert.match(source, /onSelect\(food\);/);
});

test('ProductSearch passes analytics context through search and selection paths', () => {
  assert.match(source, /foodService\.search\(t, \{ userId, searchContext \}\)/);
  assert.match(source, /context: searchContext/);
  assert.match(source, /source_surface: `\$\{searchContext\}_search`/);
  assert.match(source, /\[query, userId, forceTrigger, searchContext\]/);
});
