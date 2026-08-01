import test from 'node:test';
import assert from 'node:assert/strict';

class LocalStorageMock {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

const localStorageMock = new LocalStorageMock();
(globalThis as any).localStorage = localStorageMock;

const buildClient = (records: any[], options: { error?: any; throwOnInsert?: boolean } = {}) => ({
  from(table: string) {
    assert.equal(table, 'food_search_events');
    return {
      async insert(payload: any) {
        if (options.throwOnInsert) {
          throw new Error('network down');
        }
        records.push(payload);
        return { error: options.error ?? null };
      },
    };
  },
});

test('logs query and not_found as mutually exclusive non-blocking events', async () => {
  const { SearchAnalyticsService } = await import('../searchAnalyticsService.ts');
  const records: any[] = [];
  const service = new SearchAnalyticsService(buildClient(records) as any);

  await service.logSearchResult({
    query: '  неизвестный продукт  ',
    context: 'diary',
    userId: 'user-1',
    resultCount: 0,
    metadata: { source_surface: 'food_diary_search' },
  });

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => ({
      event_type: record.event_type,
      selected_canonical_food_id: record.selected_canonical_food_id,
      no_selection: record.no_selection,
      not_found: record.not_found,
      ambiguous: record.ambiguous,
      result_count: record.result_count,
    })),
    [
      {
        event_type: 'query',
        selected_canonical_food_id: null,
        no_selection: false,
        not_found: false,
        ambiguous: false,
        result_count: 0,
      },
      {
        event_type: 'not_found',
        selected_canonical_food_id: null,
        no_selection: false,
        not_found: true,
        ambiguous: false,
        result_count: 0,
      },
    ]
  );
  assert.equal(records[0].query, 'неизвестный продукт');
  assert.equal(records[0].normalized_query, 'неизвестный продукт');
  assert.equal(records[0].user_id, 'user-1');
  assert.equal(records[0].session_id_hash, null);
});

test('logs ambiguous candidates without selecting a canonical food', async () => {
  const { SearchAnalyticsService } = await import('../searchAnalyticsService.ts');
  const records: any[] = [];
  const service = new SearchAnalyticsService(buildClient(records) as any);

  await service.logSearchResult({
    query: 'чай',
    context: 'diary',
    userId: 'user-1',
    resultCount: 2,
    ambiguous: true,
    results: [
      { id: 'food-a', canonical_food_id: 'canonical-a', source: 'core' },
      { id: 'food-b', canonical_food_id: null, source: 'brand' },
    ] as any,
  });

  assert.equal(records.length, 2);
  const ambiguous = records[1];
  assert.equal(ambiguous.event_type, 'ambiguous');
  assert.equal(ambiguous.selected_canonical_food_id, null);
  assert.equal(ambiguous.ambiguous, true);
  assert.deepEqual(ambiguous.candidate_canonical_food_ids, ['canonical-a', 'food-b']);
  assert.deepEqual(ambiguous.metadata.result_source_counts, { core: 1, brand: 1 });
  assert.equal(ambiguous.metadata.reason, 'manual_disambiguation');
});

test('logs selection with selected canonical id and no decision flags', async () => {
  const { SearchAnalyticsService } = await import('../searchAnalyticsService.ts');
  const records: any[] = [];
  const service = new SearchAnalyticsService(buildClient(records) as any);

  await service.logSelection({
    query: 'овсянка',
    context: 'diary',
    userId: 'user-1',
    food: { id: 'food-raw', canonical_food_id: 'food-canonical', source: 'core' },
    resultCount: 4,
    metadata: { source_surface: 'food_diary_search' },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].event_type, 'selection');
  assert.equal(records[0].selected_canonical_food_id, 'food-canonical');
  assert.equal(records[0].no_selection, false);
  assert.equal(records[0].not_found, false);
  assert.equal(records[0].ambiguous, false);
});

test('skips obvious PII and short queries', async () => {
  const { SearchAnalyticsService } = await import('../searchAnalyticsService.ts');
  const records: any[] = [];
  const service = new SearchAnalyticsService(buildClient(records) as any);

  await service.logSearchResult({ query: 'a', resultCount: 0 });
  await service.logSearchResult({ query: 'test@example.com', resultCount: 0 });
  await service.logSearchResult({ query: '+7 (999) 123-45-67', resultCount: 0 });

  assert.equal(records.length, 0);
});

test('uses session_id_hash without user_id and keeps metadata allowlisted', async () => {
  const { SearchAnalyticsService } = await import('../searchAnalyticsService.ts');
  const records: any[] = [];
  const service = new SearchAnalyticsService(buildClient(records) as any);
  service.resetForTests();
  localStorageMock.clear();

  await service.logSearchResult({
    query: 'гречка',
    context: 'other',
    resultCount: 1,
    results: [{ id: 'food-1', canonical_food_id: 'food-1', source: 'core' }] as any,
    metadata: {
      source_surface: 'food_search',
      latency_ms: 12.6,
      email: 'hidden@example.com',
      token: 'secret',
      result_source_counts: { core: 1, user: 0, extra: 999 },
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].user_id, null);
  assert.ok(records[0].session_id_hash);
  assert.equal(records[0].metadata.source_surface, 'food_search');
  assert.equal(records[0].metadata.latency_ms, 13);
  assert.deepEqual(records[0].metadata.result_source_counts, { core: 1 });
  assert.equal('email' in records[0].metadata, false);
  assert.equal('token' in records[0].metadata, false);
});

test('treats blank user id as anonymous session hash', async () => {
  const { SearchAnalyticsService } = await import('../searchAnalyticsService.ts');
  const records: any[] = [];
  const service = new SearchAnalyticsService(buildClient(records) as any);
  service.resetForTests();

  await service.logSelection({
    query: 'рис',
    userId: '',
    food: { id: 'food-1', canonical_food_id: 'food-1', source: 'core' },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].user_id, null);
  assert.ok(records[0].session_id_hash);
});

test('dedupes repeated events and swallows insert failures', async () => {
  const { SearchAnalyticsService } = await import('../searchAnalyticsService.ts');
  const records: any[] = [];
  const service = new SearchAnalyticsService(buildClient(records) as any);

  await service.logSearchResult({ query: 'рис', context: 'diary', userId: 'user-1', resultCount: 1 });
  await service.logSearchResult({ query: 'рис', context: 'diary', userId: 'user-1', resultCount: 1 });
  assert.equal(records.length, 1);

  const failingService = new SearchAnalyticsService(buildClient([], { throwOnInsert: true }) as any);
  await assert.doesNotReject(() =>
    failingService.logSelection({
      query: 'рис',
      userId: 'user-1',
      food: { id: 'food-1', canonical_food_id: 'food-1', source: 'core' },
    })
  );
});
