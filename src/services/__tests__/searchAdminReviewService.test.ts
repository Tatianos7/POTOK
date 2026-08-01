import test from 'node:test';
import assert from 'node:assert/strict';

test('aggregates review events by context, event type, and normalized query', async () => {
  const { aggregateSearchReviewEvents } = await import('../searchAdminReviewService.ts');

  const items = aggregateSearchReviewEvents([
    {
      id: 'event-1',
      query: 'чай',
      normalized_query: 'чай',
      context: 'diary',
      event_type: 'ambiguous',
      result_count: 3,
      candidate_canonical_food_ids: ['food-1'],
      created_at: '2026-08-01T10:00:00.000Z',
    },
    {
      id: 'event-2',
      query: 'Чай',
      normalized_query: 'чай',
      context: 'diary',
      event_type: 'ambiguous',
      result_count: 4,
      candidate_canonical_food_ids: ['food-1', 'food-2'],
      created_at: '2026-08-01T11:00:00.000Z',
    },
    {
      id: 'event-3',
      query: 'редкая еда',
      normalized_query: 'редкая еда',
      context: 'recipe',
      event_type: 'not_found',
      result_count: 0,
      candidate_canonical_food_ids: [],
      created_at: '2026-08-01T09:00:00.000Z',
    },
  ]);

  assert.equal(items.length, 2);
  assert.equal(items[0].normalizedQuery, 'чай');
  assert.equal(items[0].frequency, 2);
  assert.equal(items[0].query, 'Чай');
  assert.equal(items[0].lastSeen, '2026-08-01T11:00:00.000Z');
  assert.equal(items[0].resultCount, 4);
  assert.deepEqual(items[0].candidateIds, ['food-1', 'food-2']);
  assert.deepEqual(items[0].sourceEventIds, ['event-1', 'event-2']);
});

test('createOrUpdatePending inserts only into review queue when no pending row exists', async () => {
  const { SearchAdminReviewService } = await import('../searchAdminReviewService.ts');
  const calls: Array<{ table: string; action: string; payload?: any }> = [];

  const client = {
    from(table: string) {
      assert.notEqual(table, 'foods');
      assert.notEqual(table, 'food_aliases');
      return {
        select() {
          calls.push({ table, action: 'select' });
          return this;
        },
        eq() {
          return this;
        },
        is() {
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

  const service = new SearchAdminReviewService(client as any);
  await service.createOrUpdatePending(
    {
      key: 'diary:not_found:редкая еда',
      query: 'редкая еда',
      normalizedQuery: 'редкая еда',
      context: 'diary',
      eventType: 'not_found',
      frequency: 3,
      lastSeen: '2026-08-01T11:00:00.000Z',
      resultCount: 0,
      sourceEventIds: ['event-1', 'event-2'],
      candidateIds: [],
      candidates: [],
      pendingRows: [],
    },
    null
  );

  assert.deepEqual(
    calls.map((call) => ({ table: call.table, action: call.action })),
    [
      { table: 'food_search_review_queue', action: 'select' },
      { table: 'food_search_review_queue', action: 'insert' },
    ]
  );
  assert.equal(calls[1].payload.status, 'pending');
  assert.equal(calls[1].payload.suggested_canonical_food_id, null);
});

test('createOrUpdatePending updates existing pending queue row', async () => {
  const { SearchAdminReviewService } = await import('../searchAdminReviewService.ts');
  const updates: any[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'food_search_review_queue');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: [{ id: 'queue-1', frequency: 1, source_event_ids: ['event-old'] }],
            error: null,
          });
        },
        update(payload: any) {
          updates.push(payload);
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const service = new SearchAdminReviewService(client as any);
  await service.createOrUpdatePending(
    {
      key: 'diary:ambiguous:чай',
      query: 'чай',
      normalizedQuery: 'чай',
      context: 'diary',
      eventType: 'ambiguous',
      frequency: 4,
      lastSeen: '2026-08-01T11:00:00.000Z',
      resultCount: 4,
      sourceEventIds: ['event-new'],
      candidateIds: ['food-1'],
      candidates: [],
      pendingRows: [],
    },
    'food-1'
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0].frequency, 4);
  assert.deepEqual(updates[0].source_event_ids, ['event-old', 'event-new']);
});

test('updateQueueStatus writes only review queue status and reviewer fields', async () => {
  const { SearchAdminReviewService } = await import('../searchAdminReviewService.ts');
  const updates: any[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'food_search_review_queue');
      return {
        update(payload: any) {
          updates.push(payload);
          return {
            eq(field: string, value: string) {
              assert.equal(field, 'id');
              assert.equal(value, 'queue-1');
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const service = new SearchAdminReviewService(client as any);
  await service.updateQueueStatus('queue-1', 'rejected', 'admin-1', 'Не подходит');

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, 'rejected');
  assert.equal(updates[0].reviewer_id, 'admin-1');
  assert.equal(updates[0].comment, 'Не подходит');
  assert.ok(updates[0].reviewed_at);
});
