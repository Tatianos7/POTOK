import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFoodTextForDb, resolveDbLevel } from './smoke-test-food-search-staging.ts';

const foods = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    stable_food_id: 'acidophilus_0_1',
    canonical_food_id: '11111111-1111-4111-8111-111111111111',
    name: 'Ацидофилин 0,1%',
    normalized_name: 'ацидофилин 0 1',
    source: 'core',
    category: 'dairy',
    cooking_state: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    stable_food_id: 'milk',
    canonical_food_id: '22222222-2222-4222-8222-222222222222',
    name: 'Молоко',
    normalized_name: 'молоко',
    source: 'core',
    category: 'dairy',
    cooking_state: null,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    stable_food_id: 'milk_2_5',
    canonical_food_id: '33333333-3333-4333-8333-333333333333',
    name: 'Молоко 2,5%',
    normalized_name: 'молоко 2 5',
    source: 'core',
    category: 'dairy',
    cooking_state: null,
  },
];

const aliases = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    alias: 'ацидофилин 0.1%',
    normalized_alias: 'ацидофилин 0 1',
    canonical_food_id: '11111111-1111-4111-8111-111111111111',
  },
];

test('DB normalizer collapses punctuation variants', () => {
  assert.equal(normalizeFoodTextForDb('Ацидофилин 0,1%'), 'ацидофилин 0 1');
  assert.equal(normalizeFoodTextForDb('ацидофилин 0.1%'), 'ацидофилин 0 1');
});

test('exact canonical search resolves deterministically', () => {
  const result = resolveDbLevel('Ацидофилин 0,1%', foods, aliases);
  assert.equal(result.status, 'resolved');
  assert.equal(result.matchedStableFoodIds[0], 'acidophilus_0_1');
});

test('alias punctuation search resolves to canonical UUID', () => {
  const result = resolveDbLevel('ацидофилин 0.1%', foods, aliases);
  assert.equal(result.status, 'resolved');
  assert.equal(result.matchSource, 'canonical_name');
  assert.equal(result.matchedIds[0], '11111111-1111-4111-8111-111111111111');
});

test('unknown query stays unresolved', () => {
  const result = resolveDbLevel('несуществующий продукт xyz', foods, aliases);
  assert.equal(result.status, 'unresolved');
});

test('exact query wins before broad ambiguity', () => {
  const result = resolveDbLevel('молоко', foods, aliases);
  assert.equal(result.status, 'resolved');
  assert.equal(result.matchedStableFoodIds[0], 'milk');
});

test('broad query is ambiguous and deterministic', () => {
  const first = resolveDbLevel('мол', foods, aliases);
  const second = resolveDbLevel('мол', foods, aliases);
  assert.equal(first.status, 'ambiguous');
  assert.deepEqual(first.matchedIds, second.matchedIds);
});
