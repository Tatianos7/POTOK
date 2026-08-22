import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearDemoPremiumAccess,
  DEMO_PREMIUM_ACCESS_KEY,
  enableDemoPremiumAccess,
  hasDemoPremiumAccess,
} from '../demoPremiumAccess';

const storage = new Map<string, string>();
const originalWindow = globalThis.window;

function installLocalStorageMock() {
  storage.clear();
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    },
    configurable: true,
  });
}

function restoreWindow() {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
  });
}

test('demo premium access is false when localStorage key is missing', () => {
  installLocalStorageMock();

  assert.equal(hasDemoPremiumAccess(), false);

  restoreWindow();
});

test('demo premium access is true when localStorage key is true', () => {
  installLocalStorageMock();

  storage.set(DEMO_PREMIUM_ACCESS_KEY, 'true');

  assert.equal(hasDemoPremiumAccess(), true);

  restoreWindow();
});

test('demo premium access clears back to false', () => {
  installLocalStorageMock();

  enableDemoPremiumAccess();
  assert.equal(hasDemoPremiumAccess(), true);

  clearDemoPremiumAccess();
  assert.equal(hasDemoPremiumAccess(), false);

  restoreWindow();
});
