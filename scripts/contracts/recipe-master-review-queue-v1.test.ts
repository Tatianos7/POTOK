import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecipeIngredientReviewQueueV1 as queue } from './recipe-master-review-queue-v1.ts';
const row = (id: string, recipe: string, name: unknown = 'Apple') => ({ ingredient_row_id: id,
  recipe_id: recipe, ingredient_name_ru: name, weight_g: 100, canonical_status: 'UNRESOLVED', food_stable_id: null });
test('prioritizes distinct recipe reach, preserves individual quantities and does not mutate input', () => {
  const input = [row('a', 'one'), row('b', 'two'), row('c', 'one', 'Oats'), row('d', 'one', 'Oats'), row('e', 'one', 'Oats')];
  input[1].weight_g = 50; const before = JSON.stringify(input); const r = queue(input);
  assert.equal(r.entries[0].name, 'Apple'); assert.equal(r.entries[0].affectedRecipeCount, 2);
  assert.deepEqual(r.entries[0].rows.map(x => x.recordedWeightG), [100, 50]);
  assert.equal(r.blockedIngredientRows, 5); assert.equal(JSON.stringify(input), before);
  assert.equal(r.runtimePublishable, false); assert.equal(r.groupingDoesNotEstablishIdentity, true);
});
test('literal spelling variants remain separate; equal labels still are not food identities', () => {
  const r = queue([row('a', 'one', 'Apple'), row('b', 'two', 'apple'), row('c', 'three', ' Apple ')]);
  assert.equal(r.entries.length, 3);
  assert.ok(r.entries.every(x => x.grouping === 'EXACT_AUTHORING_NAME_ONLY'));
});
test('unnamed rows stay separate and retain repair locations', () => {
  const r = queue([row('a', 'one', ''), row('b', 'two', null)]);
  assert.equal(r.entries.length, 2);
  assert.deepEqual(r.entries.map(x => x.rows[0].inputRowIndex), [0, 1]);
  assert.ok(r.entries.every(x => x.rows[0].issues.includes('INGREDIENT_NAME_MISSING')));
});
test('resolved status alone cannot hide missing identity or invalid grams', () => {
  for (const value of [null, '', '100', 0, -1, NaN, Infinity]) {
    const input = { ...row('a', 'one'), canonical_status: 'RESOLVED', weight_g: value };
    const issues = queue([input]).entries[0].rows[0].issues;
    assert.ok(issues.includes('INGREDIENT_GRAMS_NEED_REVIEW'));
    assert.ok(issues.includes('STABLE_FOOD_ID_MISSING'));
  }
});
test('complete authoring row leaves queue but never becomes runtime publication', () => {
  const r = queue([{ ...row('a', 'one'), canonical_status: 'RESOLVED', food_stable_id: 'source-only' }]);
  assert.equal(r.blockedIngredientRows, 0); assert.equal(r.runtimePublishable, false);
});
test('rejects missing and repeated source identities instead of creating ambiguous repair targets', () => {
  assert.throws(() => queue([row('a', 'one'), row('a', 'two')]), /DUPLICATE/);
  assert.throws(() => queue([row('', 'one')]), /INVALID/);
  assert.throws(() => queue([row('a', '')]), /INVALID/);
});
test('deterministic tie ordering uses source labels without locale-dependent collation', () => {
  const input = [row('b', 'one', 'B'), row('a', 'two', 'A')];
  assert.deepEqual(queue(input).entries.map(x => x.name), ['A', 'B']);
  assert.deepEqual(queue(input), queue(input));
});
