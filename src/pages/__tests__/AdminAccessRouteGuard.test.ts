import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const adminPanelSource = readFileSync(resolve(currentDir, '../AdminPanel.tsx'), 'utf8');
const searchReviewSource = readFileSync(resolve(currentDir, '../SearchAnalyticsAdminReview.tsx'), 'utf8');
const missingFoodReviewSource = readFileSync(resolve(currentDir, '../MissingFoodReviewQueue.tsx'), 'utf8');
const hookSource = readFileSync(resolve(currentDir, '../../hooks/useAdminAccess.ts'), 'utf8');

test('admin pages use shared admin access guard', () => {
  assert.match(adminPanelSource, /useAdminAccess\(\{ authStatus, user, profile \}\)/);
  assert.match(searchReviewSource, /useAdminAccess\(\{ authStatus, user, profile \}\)/);
  assert.match(missingFoodReviewSource, /useAdminAccess\(\{ authStatus, user, profile \}\)/);
});

test('admin pages wait during admin access verification instead of redirecting', () => {
  assert.match(adminPanelSource, /adminAccessStatus === 'checking'/);
  assert.match(searchReviewSource, /adminAccessStatus === 'checking'/);
  assert.match(missingFoodReviewSource, /adminAccessStatus === 'checking'/);
  assert.match(adminPanelSource, /adminAccessStatus === 'denied'/);
  assert.match(searchReviewSource, /adminAccessStatus === 'denied'/);
  assert.match(missingFoodReviewSource, /adminAccessStatus === 'denied'/);
});

test('admin access hook verifies admin remotely before denying fallback non-admin context', () => {
  assert.match(hookSource, /adminAccessService\.verifyCurrentUserIsAdmin\(user\.id\)/);
  assert.match(hookSource, /setStatus\(isAdmin \? 'allowed' : 'denied'\)/);
  assert.match(hookSource, /user\?\.isAdmin \|\| profile\?\.is_admin/);
});
