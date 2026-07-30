import test from 'node:test';
import assert from 'node:assert/strict';

import { getAuthCallbackRedirectUrl } from '../authRedirect';

test('auth callback redirect includes GitHub Pages base path', () => {
  assert.equal(
    getAuthCallbackRedirectUrl({
      origin: 'https://tatianos7.github.io',
      baseUrl: '/POTOK/',
    }),
    'https://tatianos7.github.io/POTOK/auth/callback',
  );
});

test('auth callback redirect normalizes base path without trailing slash', () => {
  assert.equal(
    getAuthCallbackRedirectUrl({
      origin: 'https://tatianos7.github.io',
      baseUrl: '/POTOK',
    }),
    'https://tatianos7.github.io/POTOK/auth/callback',
  );
});

test('auth callback redirect falls back to root base for local dev', () => {
  assert.equal(
    getAuthCallbackRedirectUrl({
      origin: 'http://localhost:5173',
      baseUrl: '/',
    }),
    'http://localhost:5173/auth/callback',
  );
});
