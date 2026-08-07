import test from 'node:test';
import assert from 'node:assert/strict';

const baseItem = {
  key: 'diary:not_found:стейк',
  query: 'стейк',
  normalizedQuery: 'стейк',
  context: 'diary' as const,
  eventType: 'not_found' as const,
  frequency: 3,
  lastSeen: '2026-08-06T10:00:00.000Z',
  resultCount: 0,
  sourceEventIds: ['event-1', 'event-2'],
  candidateIds: [],
  candidates: [],
  pendingRows: [],
  classification: 'missing_canonical_food' as const,
  classificationReason: 'Похоже на реальный продукт, но точного canonical food нет.',
};

test('createOrUpdatePending inserts pending missing-food row only into food_missing_review_queue', async () => {
  const { MissingFoodReviewQueueService } = await import('../missingFoodReviewQueueService.ts');
  const calls: Array<{ table: string; action: string; payload?: any }> = [];

  const client = {
    from(table: string) {
      assert.notEqual(table, 'foods');
      assert.notEqual(table, 'food_aliases');
      assert.notEqual(table, 'food_search_review_queue');
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

  const service = new MissingFoodReviewQueueService(client as any);
  await service.createOrUpdatePending({
    item: baseItem as any,
    suggestedName: 'Стейк',
    comment: 'needs food draft',
  });

  assert.deepEqual(
    calls.map((call) => ({ table: call.table, action: call.action })),
    [
      { table: 'food_missing_review_queue', action: 'from' },
      { table: 'food_missing_review_queue', action: 'select' },
      { table: 'food_missing_review_queue', action: 'from' },
      { table: 'food_missing_review_queue', action: 'insert' },
    ]
  );

  const insert = calls.find((call) => call.action === 'insert')?.payload;
  assert.equal(insert.query, 'стейк');
  assert.equal(insert.normalized_query, 'стейк');
  assert.equal(insert.context, 'diary');
  assert.equal(insert.frequency, 3);
  assert.equal(insert.classification, 'missing_canonical_food');
  assert.equal(insert.status, 'pending');
  assert.deepEqual(insert.source_event_ids, ['event-1', 'event-2']);
  assert.equal(insert.suggested_name, 'Стейк');
  assert.equal(insert.comment, 'needs food draft');
});

test('createOrUpdatePending updates existing pending missing-food row without duplicating source events', async () => {
  const { MissingFoodReviewQueueService } = await import('../missingFoodReviewQueueService.ts');
  const updates: any[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'food_missing_review_queue');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: [{ id: 'missing-queue-1', frequency: 1, source_event_ids: ['event-1'] }],
            error: null,
          });
        },
        update(payload: any) {
          updates.push(payload);
          return {
            eq(field: string, value: string) {
              assert.equal(field, 'id');
              assert.equal(value, 'missing-queue-1');
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const service = new MissingFoodReviewQueueService(client as any);
  await service.createOrUpdatePending({
    item: baseItem as any,
    suggestedName: 'Стейк',
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].frequency, 3);
  assert.deepEqual(updates[0].source_event_ids, ['event-1', 'event-2']);
  assert.equal(updates[0].suggested_name, 'Стейк');
});

test('createOrUpdatePending rejects non-missing classifications before DB access', async () => {
  const { MissingFoodReviewQueueService } = await import('../missingFoodReviewQueueService.ts');
  const client = {
    from() {
      throw new Error('DB should not be accessed for non-missing classifications');
    },
  };

  const service = new MissingFoodReviewQueueService(client as any);
  await assert.rejects(
    () =>
      service.createOrUpdatePending({
        item: { ...baseItem, classification: 'alias_candidate' } as any,
      }),
    /missing_canonical_food/
  );
});

test('getRows applies filters and sort order for missing-food queue', async () => {
  const { MissingFoodReviewQueueService } = await import('../missingFoodReviewQueueService.ts');
  const calls: Array<{ action: string; field?: string; value?: string; options?: any }> = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'food_missing_review_queue');
      return {
        select(columns: string) {
          calls.push({ action: 'select', value: columns });
          return this;
        },
        eq(field: string, value: string) {
          calls.push({ action: 'eq', field, value });
          return this;
        },
        order(field: string, options: any) {
          calls.push({ action: 'order', field, options });
          return this;
        },
        limit(value: number) {
          calls.push({ action: 'limit', value: String(value) });
          return Promise.resolve({ data: [{ id: 'missing-1' }], error: null });
        },
      };
    },
  };

  const service = new MissingFoodReviewQueueService(client as any);
  const rows = await service.getRows({
    status: 'pending',
    classification: 'missing_canonical_food',
    context: 'diary',
  });

  assert.deepEqual(rows, [{ id: 'missing-1' }]);
  assert.deepEqual(
    calls.filter((call) => call.action === 'eq').map((call) => [call.field, call.value]),
    [
      ['status', 'pending'],
      ['classification', 'missing_canonical_food'],
      ['context', 'diary'],
    ]
  );
  assert.deepEqual(
    calls.filter((call) => call.action === 'order').map((call) => [call.field, call.options]),
    [
      ['frequency', { ascending: false }],
      ['created_at', { ascending: false }],
    ]
  );
});

test('updateRow stores edits and reviewer fields only when status changes', async () => {
  const { MissingFoodReviewQueueService } = await import('../missingFoodReviewQueueService.ts');
  const updates: any[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'food_missing_review_queue');
      return {
        update(payload: any) {
          updates.push(payload);
          return {
            eq(field: string, value: string) {
              assert.equal(field, 'id');
              assert.equal(value, 'missing-1');
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const service = new MissingFoodReviewQueueService(client as any);
  await service.updateRow({
    rowId: 'missing-1',
    reviewerId: 'admin-1',
    status: 'approved_for_food_draft',
    suggestedName: ' Стейк ',
    suggestedCategory: ' meat ',
    suggestedSource: 'core',
    comment: ' ready ',
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, 'approved_for_food_draft');
  assert.equal(updates[0].reviewer_id, 'admin-1');
  assert.ok(updates[0].reviewed_at);
  assert.equal(updates[0].suggested_name, 'Стейк');
  assert.equal(updates[0].suggested_category, 'meat');
  assert.equal(updates[0].suggested_source, 'core');
  assert.equal(updates[0].comment, 'ready');
});
