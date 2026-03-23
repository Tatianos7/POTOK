import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DiaryCreateService,
  DiaryCreateServiceError,
  type CreateDiaryEntryRequest,
  type DiaryEntryRecord,
  type DiaryFoodRecord,
  type DiaryInsertPayload,
} from '../diaryCreateService';

class InMemoryDiaryRepo {
  rows = new Map<string, DiaryEntryRecord>();
  inserts: DiaryInsertPayload[] = [];
  nextId = 1;
  failInsertWith: Error | null = null;

  async findByUserAndIdempotencyKey(userId: string, idempotencyKey: string): Promise<DiaryEntryRecord | null> {
    return this.rows.get(`${userId}:${idempotencyKey}`) ?? null;
  }

  async insert(payload: DiaryInsertPayload): Promise<DiaryEntryRecord> {
    if (this.failInsertWith) {
      throw this.failInsertWith;
    }

    const record: DiaryEntryRecord = {
      id: `entry-${this.nextId++}`,
      user_id: payload.user_id,
      date: payload.date,
      meal_type: payload.meal_type,
      canonical_food_id: payload.canonical_food_id,
      product_name: payload.product_name,
      weight: payload.weight,
      calories: payload.calories,
      protein: payload.protein,
      fat: payload.fat,
      carbs: payload.carbs,
      fiber: payload.fiber,
      idempotency_key: payload.idempotency_key,
      created_at: new Date('2026-03-17T12:00:00.000Z').toISOString(),
    };

    this.inserts.push(payload);
    if (payload.idempotency_key) {
      this.rows.set(`${payload.user_id}:${payload.idempotency_key}`, record);
    }
    return record;
  }
}

class InMemoryFoodsRepo {
  constructor(private readonly rows: Record<string, DiaryFoodRecord>) {}

  async findById(foodId: string): Promise<DiaryFoodRecord | null> {
    return this.rows[foodId] ?? null;
  }
}

function buildRequest(overrides: Partial<CreateDiaryEntryRequest> = {}): CreateDiaryEntryRequest {
  return {
    user_id: 'user-1',
    date: '2026-03-17',
    meal_type: 'breakfast',
    weight_g: 150,
    product_name: 'Яйцо куриное',
    resolver: {
      status: 'resolved',
      canonical_food_id: 'food-1',
      matched_by: 'manual_choice',
      confidence: 1,
    },
    idempotency_key: 'key-1',
    base_unit: 'г',
    display_unit: 'г',
    display_amount: 150,
    calories: 999,
    protein: 999,
    fat: 999,
    carbs: 999,
    fiber: 999,
    ...overrides,
  };
}

function buildFood(overrides: Partial<DiaryFoodRecord> = {}): DiaryFoodRecord {
  return {
    id: 'food-1',
    canonical_food_id: 'food-1',
    source: 'core',
    created_by_user_id: null,
    calories: 155,
    protein: 13,
    fat: 11,
    carbs: 1.1,
    fiber: 0,
    ...overrides,
  };
}

test('resolved happy path computes snapshot server-side', async () => {
  const diaryRepo = new InMemoryDiaryRepo();
  const service = new DiaryCreateService({
    diaryRepo,
    foodsRepo: new InMemoryFoodsRepo({ 'food-1': buildFood() }),
  });

  const result = await service.create('user-1', buildRequest());

  assert.equal(result.idempotent_replay, false);
  assert.equal(result.entry.calories, 232.5);
  assert.equal(result.entry.protein, 19.5);
  assert.equal(result.entry.fat, 16.5);
  assert.equal(result.entry.carbs, 1.65);
  assert.equal(result.entry.fiber, 0);
  assert.equal(diaryRepo.inserts.length, 1);
  assert.equal(diaryRepo.inserts[0].calories, 232.5);
});

test('ambiguous resolver is rejected', async () => {
  const service = new DiaryCreateService({
    diaryRepo: new InMemoryDiaryRepo(),
    foodsRepo: new InMemoryFoodsRepo({ 'food-1': buildFood() }),
  });

  await assert.rejects(
    () =>
      service.create(
        'user-1',
        buildRequest({
          resolver: { status: 'ambiguous', matched_by: 'candidate_list', confidence: null },
        })
      ),
    (error: unknown) =>
      error instanceof DiaryCreateServiceError && error.code === 'resolver_ambiguous'
  );
});

test('unresolved resolver is rejected', async () => {
  const service = new DiaryCreateService({
    diaryRepo: new InMemoryDiaryRepo(),
    foodsRepo: new InMemoryFoodsRepo({ 'food-1': buildFood() }),
  });

  await assert.rejects(
    () =>
      service.create(
        'user-1',
        buildRequest({
          resolver: { status: 'unresolved', matched_by: 'none', confidence: null },
        })
      ),
    (error: unknown) =>
      error instanceof DiaryCreateServiceError && error.code === 'resolver_unresolved'
  );
});

test('invalid weight is rejected', async () => {
  const service = new DiaryCreateService({
    diaryRepo: new InMemoryDiaryRepo(),
    foodsRepo: new InMemoryFoodsRepo({ 'food-1': buildFood() }),
  });

  await assert.rejects(
    () => service.create('user-1', buildRequest({ weight_g: 0 })),
    (error: unknown) => error instanceof DiaryCreateServiceError && error.code === 'invalid_weight_g'
  );
});

test('invisible private food is rejected', async () => {
  const service = new DiaryCreateService({
    diaryRepo: new InMemoryDiaryRepo(),
    foodsRepo: new InMemoryFoodsRepo({
      'food-1': buildFood({
        source: 'user',
        created_by_user_id: 'other-user',
      }),
    }),
  });

  await assert.rejects(
    () => service.create('user-1', buildRequest()),
    (error: unknown) =>
      error instanceof DiaryCreateServiceError && error.code === 'canonical_food_not_visible'
  );
});

test('client nutrition is ignored in favor of server snapshot', async () => {
  const diaryRepo = new InMemoryDiaryRepo();
  const service = new DiaryCreateService({
    diaryRepo,
    foodsRepo: new InMemoryFoodsRepo({
      'food-1': buildFood({
        calories: 80,
        protein: 5,
        fat: 2,
        carbs: 10,
        fiber: 3,
      }),
    }),
  });

  const result = await service.create(
    'user-1',
    buildRequest({
      calories: 9999,
      protein: 9999,
      fat: 9999,
      carbs: 9999,
      fiber: 9999,
    })
  );

  assert.equal(result.entry.calories, 120);
  assert.equal(result.entry.protein, 7.5);
  assert.equal(result.entry.fat, 3);
  assert.equal(result.entry.carbs, 15);
  assert.equal(result.entry.fiber, 4.5);
});

test('same idempotency key with same payload returns replay', async () => {
  const diaryRepo = new InMemoryDiaryRepo();
  const service = new DiaryCreateService({
    diaryRepo,
    foodsRepo: new InMemoryFoodsRepo({ 'food-1': buildFood() }),
  });

  const first = await service.create('user-1', buildRequest());
  const second = await service.create('user-1', buildRequest());

  assert.equal(first.entry.id, second.entry.id);
  assert.equal(second.idempotent_replay, true);
  assert.equal(diaryRepo.inserts.length, 1);
});

test('same idempotency key with changed payload is rejected', async () => {
  const diaryRepo = new InMemoryDiaryRepo();
  const service = new DiaryCreateService({
    diaryRepo,
    foodsRepo: new InMemoryFoodsRepo({ 'food-1': buildFood() }),
  });

  await service.create('user-1', buildRequest());

  await assert.rejects(
    () => service.create('user-1', buildRequest({ weight_g: 200 })),
    (error: unknown) =>
      error instanceof DiaryCreateServiceError && error.code === 'idempotency_conflict_payload_mismatch'
  );
});

test('non-root food is rejected', async () => {
  const service = new DiaryCreateService({
    diaryRepo: new InMemoryDiaryRepo(),
    foodsRepo: new InMemoryFoodsRepo({
      'food-1': buildFood({
        canonical_food_id: 'food-root',
      }),
    }),
  });

  await assert.rejects(
    () => service.create('user-1', buildRequest()),
    (error: unknown) =>
      error instanceof DiaryCreateServiceError && error.code === 'canonical_food_not_root'
  );
});

test('unique violation on insert falls back to replay lookup', async () => {
  const diaryRepo = new InMemoryDiaryRepo();
  const service = new DiaryCreateService({
    diaryRepo,
    foodsRepo: new InMemoryFoodsRepo({ 'food-1': buildFood() }),
  });

  await service.create('user-1', buildRequest());
  diaryRepo.failInsertWith = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  });

  const result = await service.create('user-1', buildRequest());

  assert.equal(result.idempotent_replay, true);
  assert.equal(diaryRepo.inserts.length, 1);
});
