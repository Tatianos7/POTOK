import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePremiumRouteAccess } from '../PremiumRoute';
import { hasEffectivePremiumAccess } from '../../utils/premiumAccess';

const currentDir = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(currentDir, '../../App.tsx'), 'utf8');
const premiumRouteSource = readFileSync(resolve(currentDir, '../PremiumRoute.tsx'), 'utf8');

function getRouteBlock(path: string): string {
  const routeStart = appSource.indexOf(`path="${path}"`);
  assert.notEqual(routeStart, -1, `${path} route exists`);
  const nextRoute = appSource.indexOf('<Route', routeStart);
  return appSource.slice(routeStart, nextRoute === -1 ? appSource.length : nextRoute);
}

test('effective premium access allows real Premium or approved demo access', () => {
  assert.equal(hasEffectivePremiumAccess({ hasPremium: true }, false), true);
  assert.equal(hasEffectivePremiumAccess({ hasPremium: false }, true), true);
  assert.equal(hasEffectivePremiumAccess({ hasPremium: false }, false), false);
  assert.equal(hasEffectivePremiumAccess(null, false), false);
});

test('premium route waits for auth and profile resolution', () => {
  assert.equal(resolvePremiumRouteAccess('booting', null, false), 'loading');
  assert.equal(resolvePremiumRouteAccess('authenticated', null, false), 'loading');
});

test('unauthenticated premium route resolves to auth', () => {
  assert.equal(resolvePremiumRouteAccess('unauthenticated', null, false), 'auth');
});

test('authenticated Free premium routes resolve to paywall', () => {
  assert.equal(resolvePremiumRouteAccess('authenticated', { hasPremium: false }, false), 'paywall');
});

test('authenticated Free direct URLs for Today and Premium Recipes resolve to paywall', () => {
  for (const path of ['/today', '/premium-recipes']) {
    assert.match(getRouteBlock(path), /<PremiumRoute>/, `${path} uses PremiumRoute`);
    assert.equal(
      resolvePremiumRouteAccess('authenticated', { hasPremium: false }, false),
      'paywall',
      `${path} redirects authenticated Free users to paywall`,
    );
  }
});

test('real Premium and demo Premium routes are allowed', () => {
  assert.equal(
    resolvePremiumRouteAccess(
      'authenticated',
      { hasPremium: true },
      hasEffectivePremiumAccess({ hasPremium: true }, false),
    ),
    'allow',
  );
  assert.equal(
    resolvePremiumRouteAccess(
      'authenticated',
      { hasPremium: false },
      hasEffectivePremiumAccess({ hasPremium: false }, true),
    ),
    'allow',
  );
});

test('premium route renders auth and paywall redirects from its resolver', () => {
  assert.match(premiumRouteSource, /<Navigate to="\/auth" replace \/>/);
  assert.match(premiumRouteSource, /<Navigate to="\/paywall" replace \/>/);
});

test('only Today and Premium Recipes use the premium route gate', () => {
  assert.match(getRouteBlock('/today'), /<PremiumRoute>[\s\S]*?<Today \/>[\s\S]*?<\/PremiumRoute>/);
  assert.match(
    getRouteBlock('/premium-recipes'),
    /<PremiumRoute>[\s\S]*?<PremiumRecipes \/>[\s\S]*?<\/PremiumRoute>/,
  );
  assert.match(getRouteBlock('/paywall'), /<ProtectedRoute>[\s\S]*?<Paywall \/>/);
  assert.match(getRouteBlock('/my-program'), /<ProtectedRoute>[\s\S]*?<MyProgram \/>/);
  assert.match(getRouteBlock('/pose'), /<ProtectedRoute>[\s\S]*?<PoseCoach \/>/);
  assert.match(getRouteBlock('/coach-history'), /<ProtectedRoute>[\s\S]*?<CoachHistory \/>/);
});

test('authenticated Free root stays on Dashboard without mounting the premium gate', () => {
  const rootRoute = getRouteBlock('/');

  assert.match(rootRoute, /<ProtectedRoute>[\s\S]*?<Dashboard \/>[\s\S]*?<\/ProtectedRoute>/);
  assert.doesNotMatch(rootRoute, /PremiumRoute|paywall/);
});

test('app shell and premium routes share the effective premium helper', () => {
  assert.match(appSource, /hasPremiumAccess = hasEffectivePremiumAccess\(user\)/);
  assert.match(premiumRouteSource, /hasEffectivePremiumAccess/);
});
