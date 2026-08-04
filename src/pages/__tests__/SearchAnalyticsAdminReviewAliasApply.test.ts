import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, '../SearchAnalyticsAdminReview.tsx'), 'utf8');

const resultCodes = [
  'applied',
  'duplicate_alias',
  'existing_alias_conflict',
  'orphan_canonical',
  'invalid_canonical_source',
  'not_approved',
  'ambiguous_alias',
  'missing_source_evidence',
  'already_applied',
  'permission_denied',
  'invalid_alias',
  'review_not_found',
  'insert_failed',
];

test('Search Review Alias Apply uses the service instead of direct RPC/table writes', () => {
  assert.match(source, /aliasApplyService\.applyApprovedAlias\(row\.id, alias, comment\)/);
  assert.doesNotMatch(source, /\.rpc\('apply_admin_approved_food_alias'/);
  assert.doesNotMatch(source, /\.from\('food_aliases'\)/);
});

test('Search Review shows Apply alias only for approved queue rows', () => {
  assert.match(source, /classification === 'alias_candidate' && row\.status === 'approved' && !row\.applied_alias_id/);
  assert.match(source, /row\.status === 'approved' && classification === 'alias_candidate' && \(/);
  assert.match(source, /disabled=\{disabled \|\| isSubmitting \|\| !canApply\}/);
});

test('Search Review displays every Alias Apply RPC result code', () => {
  for (const code of resultCodes) {
    assert.match(source, new RegExp(`${code}:`));
  }
});

test('Search Review keeps approve flow separate from alias apply', () => {
  assert.match(source, /row\.status === 'pending' && \(/);
  assert.match(source, /updateStatus\('approved'\)/);
  assert.match(source, /Apply alias/);
});

test('Search Review displays classification guidance labels', () => {
  assert.match(source, /alias_candidate: 'Alias candidate'/);
  assert.match(source, /missing_canonical_food: 'Нужен missing food review'/);
  assert.match(source, /ambiguous_broad_query: 'Нужна дисамбигуация'/);
  assert.match(source, /typo_or_prefix: 'Шум\/префикс'/);
});
