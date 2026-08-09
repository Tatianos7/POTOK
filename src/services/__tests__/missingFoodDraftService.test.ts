import test from 'node:test';
import assert from 'node:assert/strict';

const completeDraftInput = {
  sourceReviewId: 'review-1',
  query: 'Сырники ки',
  normalizedQuery: 'сырники ки',
  reviewerId: 'admin-1',
  status: 'ready_for_owner_apply' as const,
  name: 'Сырники',
  category: 'Готовые блюда',
  calories: 183,
  protein: 14,
  fat: 7,
  carbs: 16,
  fiber: null,
  dataSource: 'manual owner research',
  sourceUrl: 'https://example.com/source',
  sourceNotes: 'per 100 g',
  reviewerNotes: 'checked',
};

test('validateMissingFoodDraft blocks ready state when draft is incomplete', async () => {
  const { validateMissingFoodDraft } = await import('../missingFoodDraftService.ts');

  const validation = validateMissingFoodDraft({
    ...completeDraftInput,
    name: '',
    calories: null,
    status: 'ready_for_owner_apply',
  });

  assert.equal(validation.isComplete, false);
  assert.match(validation.errors.join(' '), /Name is required/);
  assert.match(validation.errors.join(' '), /Calories must be 0\.\.1000/);
});

test('saveDraft inserts draft row only into food_missing_food_drafts', async () => {
  const { MissingFoodDraftService } = await import('../missingFoodDraftService.ts');
  const calls: Array<{ table: string; action: string; payload?: any }> = [];

  const client = {
    from(table: string) {
      assert.notEqual(table, 'foods');
      assert.notEqual(table, 'food_aliases');
      calls.push({ table, action: 'from' });
      return {
        select() {
          calls.push({ table, action: 'select' });
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return Promise.resolve({ data: [], error: null });
        },
        insert(payload: any) {
          calls.push({ table, action: 'insert', payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const service = new MissingFoodDraftService(client as any);
  await service.saveDraft({
    ...completeDraftInput,
    status: 'draft',
  });

  assert.deepEqual(
    calls.map((call) => ({ table: call.table, action: call.action })),
    [
      { table: 'food_missing_food_drafts', action: 'from' },
      { table: 'food_missing_food_drafts', action: 'select' },
      { table: 'food_missing_food_drafts', action: 'from' },
      { table: 'food_missing_food_drafts', action: 'insert' },
    ]
  );

  const insert = calls.find((call) => call.action === 'insert')?.payload;
  assert.equal(insert.source_review_id, 'review-1');
  assert.equal(insert.query, 'Сырники ки');
  assert.equal(insert.normalized_query, 'сырники ки');
  assert.equal(insert.name, 'Сырники');
  assert.equal(insert.normalized_name, 'сырники');
  assert.equal(insert.source, 'core');
  assert.equal(insert.unit, 'g');
  assert.equal(insert.brand, null);
  assert.equal(insert.barcode, null);
  assert.equal(insert.status, 'draft');
  assert.equal(insert.prepared_by, 'admin-1');
  assert.ok(insert.prepared_at);
  assert.equal(insert.reviewed_by, null);
  assert.equal(insert.reviewed_at, null);
});

test('saveDraft updates existing draft and sets reviewed fields for ready_for_owner_apply', async () => {
  const { MissingFoodDraftService } = await import('../missingFoodDraftService.ts');
  const updates: any[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'food_missing_food_drafts');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return Promise.resolve({ data: [{ id: 'draft-1' }], error: null });
        },
        update(payload: any) {
          updates.push(payload);
          return {
            eq(field: string, value: string) {
              assert.equal(field, 'id');
              assert.equal(value, 'draft-1');
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const service = new MissingFoodDraftService(client as any);
  await service.saveDraft(completeDraftInput);

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, 'ready_for_owner_apply');
  assert.equal(updates[0].reviewed_by, 'admin-1');
  assert.ok(updates[0].reviewed_at);
  assert.equal(updates[0].normalized_name, 'сырники');
});

test('saveDraft rejects incomplete ready state before DB access', async () => {
  const { MissingFoodDraftService } = await import('../missingFoodDraftService.ts');
  const client = {
    from() {
      throw new Error('DB should not be accessed for incomplete ready draft');
    },
  };

  const service = new MissingFoodDraftService(client as any);
  await assert.rejects(
    () =>
      service.saveDraft({
        ...completeDraftInput,
        name: '',
      }),
    /Draft is incomplete/
  );
});

test('findDuplicateFoods reads only shared foods by normalized name', async () => {
  const { MissingFoodDraftService } = await import('../missingFoodDraftService.ts');
  const calls: Array<{ action: string; field?: string; value?: any }> = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'foods');
      return {
        select(columns: string) {
          calls.push({ action: 'select', value: columns });
          return this;
        },
        eq(field: string, value: string) {
          calls.push({ action: 'eq', field, value });
          return this;
        },
        in(field: string, value: string[]) {
          calls.push({ action: 'in', field, value });
          return this;
        },
        order(field: string) {
          calls.push({ action: 'order', field });
          return this;
        },
        limit(value: number) {
          calls.push({ action: 'limit', value });
          return Promise.resolve({
            data: [{ id: 'food-1', name: 'Сырники', normalized_name: 'сырники', source: 'core' }],
            error: null,
          });
        },
      };
    },
  };

  const service = new MissingFoodDraftService(client as any);
  const duplicates = await service.findDuplicateFoods(' Сырники ');

  assert.equal(duplicates.length, 1);
  assert.deepEqual(
    calls.filter((call) => call.action === 'eq').map((call) => [call.field, call.value]),
    [['normalized_name', 'сырники']]
  );
  assert.deepEqual(
    calls.filter((call) => call.action === 'in').map((call) => [call.field, call.value]),
    [['source', ['core', 'brand']]]
  );
});
