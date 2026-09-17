import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGithubPagesFallbackRoute } from '../githubPagesRouteRestore';

test('plain root query cannot restore a stale paywall route', () => {
  assert.equal(resolveGithubPagesFallbackRoute('?p=paywall', '/POTOK/'), null);
  assert.equal(resolveGithubPagesFallbackRoute('?p=today', '/POTOK/'), null);
});

test('marked GitHub Pages fallback restores direct app routes', () => {
  assert.equal(resolveGithubPagesFallbackRoute('?spa=1&p=paywall', '/POTOK/'), '/POTOK/paywall');
  assert.equal(resolveGithubPagesFallbackRoute('?spa=1&p=today', '/POTOK/'), '/POTOK/today');
  assert.equal(
    resolveGithubPagesFallbackRoute('?spa=1&p=premium-recipes', '/POTOK/'),
    '/POTOK/premium-recipes',
  );
});

test('marked fallback preserves encoded route query and hash', () => {
  assert.equal(
    resolveGithubPagesFallbackRoute('?spa=1&p=today%3Fday%3D2%23plan', '/POTOK/'),
    '/POTOK/today?day=2#plan',
  );
});

test('fallback marker without a route does not navigate', () => {
  assert.equal(resolveGithubPagesFallbackRoute('?spa=1', '/POTOK/'), null);
});
