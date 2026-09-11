import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  },
  configurable: true,
});

const { buildCustomProductCreateData } = await import('../CreateCustomProductPage');

const baseInput = {
  name: ' Кефир ',
  calories: 52,
  protein: 3,
  fat: 2.5,
  carbs: 4,
};

test('custom product save payload stores empty optional brand as null', () => {
  const payload = buildCustomProductCreateData({
    ...baseInput,
    brandName: '',
  });

  assert.equal(payload.name, 'Кефир');
  assert.equal(payload.brand, null);
  assert.equal(payload.calories, 52);
  assert.equal(payload.protein, 3);
  assert.equal(payload.fat, 2.5);
  assert.equal(payload.carbs, 4);
  assert.equal(payload.barcode, null);
  assert.equal(payload.photo, null);
  assert.equal(payload.category, undefined);
});

test('custom product save payload trims and stores filled optional brand', () => {
  const payload = buildCustomProductCreateData({
    ...baseInput,
    brandName: ' Простоквашино ',
  });

  assert.equal(payload.brand, 'Простоквашино');
});

test('custom product save payload stores whitespace-only optional brand as null', () => {
  const payload = buildCustomProductCreateData({
    ...baseInput,
    brandName: '   ',
  });

  assert.equal(payload.brand, null);
});
