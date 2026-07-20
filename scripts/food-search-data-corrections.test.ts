import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptedDataCorrectionAliases,
  foodSearchDataCorrectionProposals,
  proposedNewCanonicals,
} from './food-search-data-corrections-proposal.js';

const byQuery = new Map(foodSearchDataCorrectionProposals.map((proposal) => [proposal.query, proposal]));

test('data-correction proposal covers all requested candidates', () => {
  assert.deepEqual(
    foodSearchDataCorrectionProposals.map((proposal) => proposal.query),
    ['йогурт', 'кефир', 'творог', 'яйцо', 'сахар', 'соль', 'греческий йогурт', 'хлеб ржаной', 'картофель варёный']
  );
});

test('unsafe broad dairy products are not auto-created without nutrition source', () => {
  for (const query of ['йогурт', 'греческий йогурт']) {
    const proposal = byQuery.get(query);
    assert.equal(proposal?.classification, 'REJECT');
    assert.equal(proposal?.stable_food_id, null);
    assert.match(proposal?.source_of_nutrition ?? '', /Required before patch/);
  }
});

test('fat-specific dairy queries remain manual-selection rather than false generic rows', () => {
  for (const query of ['кефир', 'творог']) {
    const proposal = byQuery.get(query);
    assert.equal(proposal?.classification, 'REJECT');
    assert.equal(proposal?.aliases.length, 0);
    assert.match(proposal?.current_state ?? '', /fat-specific/i);
  }
});

test('safe alias-only corrections target existing stable food ids', () => {
  assert.equal(byQuery.get('яйцо')?.classification, 'ALIAS_ONLY');
  assert.equal(byQuery.get('яйцо')?.stable_food_id, 'egg_chicken');
  assert.equal(byQuery.get('сахар')?.classification, 'ALIAS_ONLY');
  assert.equal(byQuery.get('сахар')?.stable_food_id, 'granulated_sugar');
  assert.equal(byQuery.get('хлеб ржаной')?.classification, 'ALIAS_ONLY');
  assert.equal(byQuery.get('хлеб ржаной')?.stable_food_id, 'pan_baked_rye_bread');
});

test('existing boiled potato row needs no data correction', () => {
  const proposal = byQuery.get('картофель варёный');
  assert.equal(proposal?.classification, 'EXISTING_CANONICAL');
  assert.equal(proposal?.stable_food_id, 'boiled_potato');
  assert.equal(proposal?.aliases.length, 0);
});

test('new canonical proposal is limited to plain salt and has deterministic identity', () => {
  assert.equal(proposedNewCanonicals.length, 1);
  assert.deepEqual(proposedNewCanonicals[0], {
    name: 'Соль поваренная',
    stable_food_id: 'salt',
    normalized_name: 'соль поваренная',
    aliases: ['соль', 'поваренная соль', 'соль поваренная', 'столовая соль', 'соль столовая'],
    category: 'seasonings',
    cooking_state: 'unknown',
    product_scope: 'generic',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0,
    nutrition_source: 'Table salt pantry identity; current schema has no sodium column.',
    confidence: 'high',
  });
});

test('proposal does not contain duplicate new stable ids or aliases', () => {
  const stableIds = proposedNewCanonicals.map((item) => item.stable_food_id);
  assert.equal(new Set(stableIds).size, stableIds.length);

  const aliases = acceptedDataCorrectionAliases.map((item) => item.source_phrase);
  assert.equal(new Set(aliases).size, aliases.length);
});

test('accepted aliases do not point broad ambiguous yogurt/kefir/tvorog phrases to one row', () => {
  const aliases = new Set(acceptedDataCorrectionAliases.map((item) => item.source_phrase));
  for (const unsafe of ['йогурт', 'греческий йогурт', 'кефир', 'творог']) {
    assert.equal(aliases.has(unsafe), false);
  }
});
