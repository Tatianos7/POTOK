import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  createMockPremiumCatalogService,
  createReadModeController,
  flushPromises,
  premiumCatalogMockResults,
  renderMountedWithRouter,
} from '../mountedAsyncTestUtils';
import {
  catalogEmptyArray,
  catalogReadFailed,
  catalogUnavailable,
  premiumFixtureDays,
  premiumFixtureMealSlots,
  premiumFixturePlan,
  premiumFixturePlanDetail,
  premiumFixtureRecipe,
  premiumFixtureReplacementOptions,
  premiumFixtureShoppingItems,
} from '../premiumReadOnlyFixtures';

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturesSource = readFileSync(resolve(testDir, '../premiumReadOnlyFixtures.ts'), 'utf8');
const harnessSource = readFileSync(resolve(testDir, '../mountedAsyncTestUtils.ts'), 'utf8');

test('premium read-only fixtures expose a seeded two-day catalog shape', () => {
  assert.equal(premiumFixturePlan.id, 'premium-fixture-plan-1');
  assert.equal(premiumFixturePlan.durationDays, 14);
  assert.deepEqual(
    premiumFixtureDays.map((day) => day.dayNumber),
    [1, 2]
  );
  assert.equal(premiumFixturePlanDetail.days.length, 2);
  assert.equal(premiumFixturePlanDetail.days.some((day) => day.dayNumber >= 3), false);
});

test('premium read-only fixtures cover breakfast lunch dinner snack meal slots', () => {
  assert.deepEqual(
    premiumFixtureMealSlots.map((slot) => slot.mealType),
    ['breakfast', 'lunch', 'dinner', 'snack']
  );
  assert.deepEqual(
    premiumFixtureMealSlots.map((slot) => slot.sortOrder),
    [1, 2, 3, 4]
  );
});

test('premium read-only fixtures include recipe ingredients steps hints and replacement options', () => {
  assert.equal(premiumFixtureRecipe.ingredients.length > 0, true);
  assert.equal(premiumFixtureRecipe.steps.length > 0, true);
  assert.equal(premiumFixtureRecipe.hints.length > 0, true);
  assert.deepEqual(
    premiumFixtureReplacementOptions.map((option) => option.optionType),
    ['primary', 'replacement']
  );
});

test('premium read-only fixtures include derived in-memory shopping ingredients', () => {
  assert.equal(premiumFixtureShoppingItems.length, 3);
  assert.deepEqual(
    premiumFixtureShoppingItems.map((item) => item.name),
    ['fixture_oats', 'fixture_yogurt', 'fixture_eggs']
  );
  assert.equal(premiumFixtureShoppingItems.every((item) => item.recipeIds.length > 0), true);
});

test('premium read-only fallback result fixtures match catalog service contract', () => {
  assert.deepEqual(catalogUnavailable([]), {
    ok: false,
    source: 'fallback',
    error: 'supabase_unavailable',
    data: [],
  });
  assert.deepEqual(catalogReadFailed(null), {
    ok: false,
    source: 'fallback',
    error: 'read_failed',
    data: null,
  });
  assert.deepEqual(catalogEmptyArray(), {
    ok: true,
    source: 'supabase',
    data: [],
  });
  assert.equal(premiumCatalogMockResults.emptyArray().data.length, 0);
});

test('mounted async harness exports deterministic read mode and mock catalog helpers', async () => {
  const readMode = createReadModeController();
  assert.equal(readMode.isEnabled(), false);
  readMode.enable();
  assert.equal(readMode.isEnabled(), true);
  readMode.disable();
  assert.equal(readMode.isEnabled(), false);

  const service = createMockPremiumCatalogService();
  const plans = await service.getActivePremiumPlans();
  const detail = await service.getPremiumPlanDetail(premiumFixturePlan.id);

  assert.equal(plans.ok, true);
  assert.equal(detail.data?.days.length, 2);
  assert.deepEqual(service.calls, ['getActivePremiumPlans', `getPremiumPlanDetail:${premiumFixturePlan.id}`]);
  assert.equal(typeof flushPromises, 'function');
  assert.equal(typeof renderMountedWithRouter, 'function');
});

test('mounted async harness stays test-only and avoids real Supabase network secrets and writes', () => {
  const combinedSource = `${fixturesSource}\n${harnessSource}`;

  for (const forbiddenPattern of [
    /from ['"].*supabaseClient['"]/,
    /createClient\(/,
    /fetch\(/,
    /XMLHttpRequest/,
    /localStorage/,
    /sessionStorage/,
    /process\.env/,
    /import\.meta\.env/,
    /service_role/i,
    /jwt/i,
    /password/i,
    /\.insert\(/,
    /\.update\(/,
    /\.upsert\(/,
    /\.delete\(/,
    /\.rpc\(/,
    /user_premium_plan_selections/,
    /user_premium_meal_selections/,
    /food_diary_entries/,
    /public\.recipes/,
    /premium_shopping_items/,
    /user_premium_shopping_checks/,
    /openai/i,
    /voice/i,
  ]) {
    assert.doesNotMatch(combinedSource, forbiddenPattern);
  }
});
