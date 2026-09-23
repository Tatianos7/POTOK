import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const currentDir = dirname(fileURLToPath(import.meta.url));
const today = readFileSync(resolve(currentDir, '../Today.tsx'), 'utf8');
const app = readFileSync(resolve(currentDir, '../../App.tsx'), 'utf8');
const dashboard = readFileSync(resolve(currentDir, '../Dashboard.tsx'), 'utf8');
const paywall = readFileSync(resolve(currentDir, '../Paywall.tsx'), 'utf8');
const entry = readFileSync(resolve(currentDir, '../../services/adaptiveNutritionReadOnlyEntry.ts'), 'utf8');

test('production entry binds adaptive read to server-verified Premium only', () => {
  assert.match(entry, /verifiedPremium === true && readGateEnabled/);
  assert.match(today, /shouldUseAdaptiveNutritionReadOnlyEntry\(true\)/);
  assert.match(app, /verifiedPremium=\{user\?\.hasPremium === true && user\?\.premiumAccessVerified === true\}/);
  assert.match(dashboard, /const verifiedPremium = user\?\.hasPremium === true && user\?\.premiumAccessVerified === true/);
  assert.match(dashboard, /verifiedPremium=\{verifiedPremium\}/);
  assert.doesNotMatch(today, /hasDemoPremiumAccess/);
  assert.match(today, /if \(props\.verifiedPremium === true\)/);
  assert.match(today, /if \(!shouldUseAdaptiveNutritionReadOnlyEntry\(true\)\)/);
  assert.doesNotMatch(today, /email\s*===|@bk\.ru|potok-staging_test_diary/i);
});

test('demo access is an explicit seven-day preview and cannot become verified Premium', () => {
  assert.match(paywall, /enableDemoPremiumAccess\(\)/);
  assert.match(paywall, /navigate\('\/today\?weeklyPreview=demo'\)/);
  assert.doesNotMatch(paywall, /verifiedPremium|premiumAccessVerified|VITE_ADAPTIVE_NUTRITION_READ_V1/);
  assert.match(today, /demoPreviewRequested[\s\S]*source="demo" readOnly/);
});

test('explicit demo is isolated while verified Premium precedes every legacy fallback', () => {
  const development = today.indexOf('demoPreviewRequested &&');
  const smoke = today.indexOf("if (smokePreview.kind === 'ready')");
  const adaptive = today.indexOf('if (props.verifiedPremium === true)');
  const demoRedirect = today.indexOf('if (props.demoPremiumAccess === true)');
  const paywall = today.indexOf('<Navigate to="/paywall" replace />');
  assert.ok(development >= 0 && smoke > development && adaptive > smoke
    && demoRedirect > adaptive && paywall > demoRedirect);
});

test('legacy fixed fourteen-day implementation is not a normal Premium fallback', () => {
  assert.match(today, /@deprecated Fixed 14-day implementation retained only for isolated legacy tests/);
  assert.equal((today.match(/LegacyFixed14DayToday/g) ?? []).length, 1);
  assert.match(today, /return <Navigate to="\/paywall" replace \/>;/);
});
