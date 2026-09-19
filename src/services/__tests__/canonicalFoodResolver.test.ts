import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalFoodResolver, createExactFoodRepository, resolveExactFoodCandidates, type ResolverFood } from '../canonicalFoodResolver';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const food = (changes: Partial<ResolverFood> = {}): ResolverFood => ({
  id: A, canonical_food_id: A, name: 'Молоко', normalized_name: 'молоко', source: 'core',
  calories: 60, protein: 3, fat: 3, carbs: 5, fiber: null, createdAt: '', updatedAt: '', ...changes,
});

test('exact name and conflicting alias are ambiguous regardless of ranking or input order', () => {
  const rows = [food(), food({ id: B, canonical_food_id: B, name: 'Другое молоко', normalized_name: 'другое молоко', aliases: ['молоко'] })];
  for (const candidates of [rows, [...rows].reverse()]) {
    const result = resolveExactFoodCandidates('МОЛОКО', candidates);
    assert.equal(result.status, 'ambiguous');
    assert.equal(result.food, null);
    assert.deepEqual(result.candidates.map((item) => item.id), [A, B]);
  }
});

test('duplicates of the same UUID are one match; prefix and fuzzy candidates never resolve', () => {
  assert.equal(resolveExactFoodCandidates('молоко', [food(), food()]).status, 'resolved');
  assert.equal(resolveExactFoodCandidates('моло', [food()]).status, 'unresolved');
  assert.equal(resolveExactFoodCandidates('малако', [food()]).status, 'unresolved');
  assert.equal(resolveExactFoodCandidates('кефир 1,5%', [food({ aliases: ['кефир 1.5%'] })]).status, 'resolved');
});

test('visibility, review, root identity and base/sprout boundaries are enforced', () => {
  const privateFood = food({ source: 'user', created_by_user_id: 'A' });
  assert.equal(resolveExactFoodCandidates('молоко', [privateFood], 'A').status, 'resolved');
  for (const userId of [undefined, 'B']) assert.equal(resolveExactFoodCandidates('молоко', [privateFood], userId).status, 'unresolved');
  for (const changes of [{ canonical_food_id: null }, { id: 'semantic-id' }, { canonical_food_id: B }, { needs_review: true }, { is_searchable: false }]) {
    assert.equal(resolveExactFoodCandidates('молоко', [food(changes)]).status, 'unresolved');
  }
  assert.equal(resolveExactFoodCandidates('чечевица', [food({ name: 'Чечевица ростки', normalized_name: 'чечевица ростки', aliases: ['чечевица'] })]).status, 'unresolved');
});

type Response = { data: unknown[] | null; count: number | null; error: unknown };
const response = (data: unknown[], count = data.length): Response => ({ data, count, error: null });
function repositoryFor(responses: Response[]) {
  let index = 0;
  const client = { from: () => {
    const next = responses[index++];
    const builder = {
      select: (_columns: string, options: { count: string }) => { assert.equal(options.count, 'exact'); return builder; },
      eq: () => builder, in: () => builder,
      limit: (limit: number) => { assert.equal(limit, 100); return Promise.resolve(next); },
    };
    return builder;
  } } as unknown as Pick<SupabaseClient, 'from'>;
  return createExactFoodRepository(client);
}

test('repository combines full name/alias sets without ranked-search deduplication', async () => {
  const other = food({ id: B, canonical_food_id: B, name: 'Другое', normalized_name: 'другое' });
  const repository = repositoryFor([response([food()]), response([{ canonical_food_id: B }]), response([other])]);
  const result = await canonicalFoodResolver.resolve('молоко', undefined, repository);
  assert.equal(result.status, 'ambiguous');
});

test('capped, countless, failed and missing-target reads cannot produce a resolved identity', async () => {
  const cases: Response[][] = [
    [response([food()], 101), response([])],
    [{ ...response([food()]), count: null }, response([])],
    [response([food()]), { data: null, count: null, error: new Error('offline') }],
    [response([]), response([{ canonical_food_id: A }]), response([])],
    [response([]), response([{ canonical_food_id: 'invented-id' }])],
    [{ data: null, count: null, error: new Error('names denied') }, response([])],
    [response([food()]), response([{ canonical_food_id: A }], 101)],
    [response([]), response([{ canonical_food_id: A }]), { data: null, count: null, error: new Error('targets denied') }],
    [response([]), response([{ canonical_food_id: A }]), { ...response([food()]), count: null }],
  ];
  for (const responses of cases) {
    const result = await canonicalFoodResolver.resolve('молоко', undefined, repositoryFor(responses));
    assert.equal(result.status, 'unresolved');
    assert.ok('reason' in result && result.reason === 'unavailable');
  }
});

test('raw missing nutrition never becomes zero; legitimate zero and unknown fiber survive', async () => {
  const repository = repositoryFor([response([{ ...food(), calories: null, protein: '0', fiber: null }]), response([])]);
  const result = await canonicalFoodResolver.resolve('молоко', undefined, repository);
  assert.equal(result.status, 'resolved');
  assert.ok(result.food && Number.isNaN(result.food.calories));
  assert.equal(result.food?.protein, 0);
  assert.equal(result.food?.fiber, null);
});

test('conflicting snapshots of one UUID fail closed before visibility filtering, in either order', () => {
  const changes: Partial<ResolverFood>[] = [
    { calories: 61 }, { protein: NaN }, { fiber: 0 }, { canonical_food_id: B },
    { source: 'user', created_by_user_id: 'another-account' },
    { created_by_user_id: 'another-account' },
    { needs_review: true }, { is_searchable: false }, { name: 'Другое молоко' },
  ];
  for (const change of changes) {
    const rows = [food(), food(change)];
    for (const candidates of [rows, [...rows].reverse()]) {
      assert.deepEqual(resolveExactFoodCandidates('молоко', candidates), {
        status: 'unresolved', food: null, candidates: [], reason: 'unavailable',
      });
    }
  }
});

test('alias enrichment of a consistent snapshot is order independent and does not mutate inputs', () => {
  const rows = [food(), food({ aliases: ['точный алиас'] })];
  for (const candidates of [rows, [...rows].reverse()]) {
    const result = resolveExactFoodCandidates('точный алиас', candidates);
    assert.equal(result.status, 'resolved');
    assert.equal(result.food?.id, A);
  }
  assert.equal(rows[0].aliases, undefined);
});

test('separate name and alias reads cannot select the last conflicting nutrition snapshot', async () => {
  const repository = repositoryFor([
    response([food()]), response([{ canonical_food_id: A }]), response([food({ calories: 120 })]),
  ]);
  assert.deepEqual(await canonicalFoodResolver.resolve('молоко', undefined, repository), {
    status: 'unresolved', food: null, candidates: [], reason: 'unavailable',
  });
});

test('alias target identities must match the requested set, not merely its row count', async () => {
  for (const [ids, targets] of [
    [[A], [food({ id: B, canonical_food_id: B })]],
    [[A, B], [food(), food()]],
  ] as Array<[string[], ResolverFood[]]>) {
    const repository = repositoryFor([
      response([]), response(ids.map((canonical_food_id) => ({ canonical_food_id }))), response(targets),
    ]);
    const result = await canonicalFoodResolver.resolve('молоко', undefined, repository);
    assert.ok(result.status === 'unresolved' && result.reason === 'unavailable');
    assert.deepEqual(result.candidates, []);
  }
});
