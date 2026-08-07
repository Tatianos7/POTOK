import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(currentDir, '../MissingFoodReviewQueue.tsx'), 'utf8');
const appSource = readFileSync(resolve(currentDir, '../../App.tsx'), 'utf8');
const adminPanelSource = readFileSync(resolve(currentDir, '../AdminPanel.tsx'), 'utf8');

test('Missing Food Review Queue page is admin-only and routed from the unified Admin Panel', () => {
  assert.match(appSource, /path="\/admin\/missing-food-review"/);
  assert.match(appSource, /<MissingFoodReviewQueue \/>/);
  assert.match(adminPanelSource, /navigate\('\/admin\/missing-food-review'\)/);
  assert.match(pageSource, /useAdminAccess\(\{ authStatus, user, profile \}\)/);
  assert.match(pageSource, /<Navigate to="\/" replace \/>/);
});

test('Missing Food Review Queue page exposes required filters and sort-backed service', () => {
  assert.match(pageSource, /statusOptions/);
  assert.match(pageSource, /classificationOptions/);
  assert.match(pageSource, /contextOptions/);
  assert.match(pageSource, /missingFoodReviewQueueService\.getRows\(filters\)/);
  assert.match(pageSource, /frequency/);
  assert.match(pageSource, /created/);
});

test('Missing Food Review Queue page supports allowed status actions only', () => {
  assert.match(pageSource, /pending' \|\| row\.status === 'needs_research'/);
  assert.match(pageSource, /save\('needs_research'\)/);
  assert.match(pageSource, /save\('approved_for_food_draft'\)/);
  assert.match(pageSource, /save\('rejected'\)/);
  assert.match(pageSource, /save\('snoozed'\)/);
  assert.match(pageSource, /!suggestedName\.trim\(\) \|\| row\.classification !== 'missing_canonical_food'/);
});

test('Missing Food Review Queue page does not call Alias Apply RPC or write Food Core directly', () => {
  assert.doesNotMatch(pageSource, /\.rpc\(/);
  assert.doesNotMatch(pageSource, /apply_admin_approved_food_alias/);
  assert.doesNotMatch(pageSource, /\.from\('foods'\)/);
  assert.doesNotMatch(pageSource, /\.from\('food_aliases'\)/);
});
