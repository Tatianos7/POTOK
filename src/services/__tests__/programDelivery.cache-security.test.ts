import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../programDeliveryService.ts', import.meta.url), 'utf8');

test('program day cache keys include authenticated user ID', () => {
  assert.match(source, /const userId = await this\.getSessionUserId\(\);/);
  assert.match(source, /this\.cacheKey\('day', `\$\{userId\}_\$\{programId\}_\$\{date\}`\)/);
});

test('program day cache fallback requires network failure and stable session', () => {
  assert.match(source, /if \(!isNetworkFailure\) throw err;/);
  assert.match(source, /await this\.getSessionUserId\(userId\);/);
  assert.doesNotMatch(source, /this\.cacheKey\('day', `\$\{programId\}_\$\{date\}`\)/);
});
