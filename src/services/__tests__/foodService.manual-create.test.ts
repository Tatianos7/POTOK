import test from 'node:test';
import assert from 'node:assert/strict';

function installLocalStorageMock() {
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
}

test('manual branded food still persists as source user with brand filled', async () => {
  installLocalStorageMock();
  const { foodService } = await import('../foodService');

  const svc = foodService as any;
  const originalCreateUserFood = svc.createUserFood;
  let capturedFood: any = null;
  let capturedUserId: string | null = null;

  svc.createUserFood = async (food: any, userId: string) => {
    capturedFood = food;
    capturedUserId = userId;
    return {
      ...food,
      id: 'food-1',
      userId,
      source: 'user',
      created_by_user_id: userId,
      canonical_food_id: 'food-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  try {
    await foodService.createManualBrandedFood('user-1', {
      name: 'Йогурт',
      brand: 'Моя марка',
      calories: 60,
      protein: 3.5,
      fat: 3,
      carbs: 5,
      barcode: null,
      photo: null,
      category: undefined,
    });

    assert.equal(capturedUserId, 'user-1');
    assert.equal(capturedFood.source, 'user');
    assert.equal(capturedFood.brand, 'Моя марка');
    assert.equal(capturedFood.created_by_user_id, 'user-1');
  } finally {
    svc.createUserFood = originalCreateUserFood;
  }
});

