import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID,
  ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF,
  ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID,
  resolveAdaptiveNutritionSmokePreview,
} from '../adaptiveNutritionSmokePreview';

const account = ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID;
const readyEnv = {
  VITE_ADAPTIVE_NUTRITION_STAGING_SMOKE_V1: 'true',
  VITE_ADAPTIVE_NUTRITION_RUNTIME_V1: 'true',
  VITE_ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF: ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF,
  VITE_ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID: account,
  VITE_ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID: ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID,
  VITE_SUPABASE_URL: `https://${ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF}.supabase.co`,
  VITE_SUPABASE_ANON_KEY: 'staging-public-key-present-only-in-local-smoke-env',
};

test('smoke preview defaults OFF and cannot be enabled by runtime gate alone', () => {
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview({}, account, '2026-09-22'), { kind: 'disabled' });
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview({ VITE_ADAPTIVE_NUTRITION_RUNTIME_V1: 'true' },
    account, '2026-09-22'), { kind: 'disabled' });
});

test('smoke preview requires both gates and the exact STAGING URL/ref binding', () => {
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview({ ...readyEnv,
    VITE_ADAPTIVE_NUTRITION_RUNTIME_V1: 'false' }, account, '2026-09-22'),
  { kind: 'blocked', reason: 'runtime-off' });
  for (const env of [
    { ...readyEnv, VITE_ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF: 'foreign-project' },
    { ...readyEnv, VITE_SUPABASE_URL: 'https://foreign-project.supabase.co' },
  ]) assert.deepEqual(resolveAdaptiveNutritionSmokePreview(env, account, '2026-09-22'),
    { kind: 'blocked', reason: 'invalid-project' });
});

test('missing key or exact fixture selection fails closed', () => {
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview({ ...readyEnv, VITE_SUPABASE_ANON_KEY: '' },
    account, '2026-09-22'), { kind: 'blocked', reason: 'missing-config' });
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview({ ...readyEnv,
    VITE_ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID: '7e710000-0000-4000-8000-000000000099' },
  account, '2026-09-22'), { kind: 'blocked', reason: 'missing-config' });
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview({ ...readyEnv,
    VITE_ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID: '88000000-0000-4000-8000-000000000001' },
  account, '2026-09-22'), { kind: 'blocked', reason: 'missing-config' });
});

test('authenticated account must exactly match build-time smoke account', () => {
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview(readyEnv, undefined, '2026-09-22'),
    { kind: 'blocked', reason: 'account-mismatch' });
  assert.deepEqual(resolveAdaptiveNutritionSmokePreview(readyEnv,
    '88000000-0000-4000-8000-000000000001', '2026-09-22'),
  { kind: 'blocked', reason: 'account-mismatch' });
});

test('ready config creates only an empty identity shell for authoritative server read', () => {
  const result = resolveAdaptiveNutritionSmokePreview(readyEnv, account, '2026-09-22');
  assert.equal(result.kind, 'ready');
  if (result.kind !== 'ready') return;
  assert.equal(result.weeks.active.scope.userId, account);
  assert.equal(result.weeks.active.scope.planId, ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID);
  assert.deepEqual(result.weeks.active.days.map((day) => day.date),
    ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  assert.ok(result.weeks.active.days.every((day) => day.sourceDay === null));
});
