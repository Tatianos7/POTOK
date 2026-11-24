import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  initialSideDishPreview, previewReferenceSideDish, reduceSideDishPreview, referenceSideDishScenarios,
} from '../referenceSideDishScenario';

test('replacing one dry side dish calculates new meal and day totals from the reference amounts', () => {
  const [wednesday] = referenceSideDishScenarios;
  const result = previewReferenceSideDish(wednesday, {id: 'quinoa', dryGrams: 60});
  assert.equal(result.day.axes.calories.actual, 1681.7);
  assert.equal(result.day.axes.protein.actual, 153.252);
  assert.equal(result.day.axes.fat.actual, 62.077);
  assert.equal(result.day.axes.carbs.actual, 143.726);
  assert.equal(result.day.passed, true);
  assert.equal(Math.round(result.dish.calories * 10) / 10, 532);
  assert.equal(wednesday.day.calories, 1679.9);
});

test('portion size is assessed before confirmation and unsupported sizes are rejected', () => {
  const [, friday] = referenceSideDishScenarios;
  const small = previewReferenceSideDish(friday, {id: 'quinoa', dryGrams: 60});
  assert.equal(small.day.axes.calories.actual, 1638.3);
  assert.equal(small.day.axes.calories.passed, false);
  assert.equal(small.day.passed, false);
  const larger = previewReferenceSideDish(friday, {id: 'quinoa', dryGrams: 65});
  assert.equal(larger.day.axes.calories.actual, 1656.7);
  assert.equal(larger.day.passed, true);
  assert.throws(() => previewReferenceSideDish(friday, {id: 'quinoa', dryGrams: 64}), /UNSUPPORTED_REFERENCE_SIDE_DISH_PORTION/);
});

test('cancel clears the preview and switching days discards only the pending choice', () => {
  const [wednesday, friday] = referenceSideDishScenarios;
  const preview = reduceSideDishPreview(initialSideDishPreview, {type: 'choose', id: 'quinoa'});
  assert.deepEqual(reduceSideDishPreview(preview, {type: 'cancel'}), initialSideDishPreview);
  const confirmed = reduceSideDishPreview(preview, {type: 'confirm'});
  const anotherPreview = reduceSideDishPreview(confirmed, {type: 'choose', id: 'soba'});
  const switched = reduceSideDishPreview(anotherPreview, {type: 'day', date: friday.date});
  assert.equal(switched.pending, null);
  assert.deepEqual(switched.confirmed, {[wednesday.date]: {id: 'quinoa', dryGrams: 60}});
});

test('confirmation does not apply a rejected portion and applies the corrected weight only to its day', () => {
  const [, friday] = referenceSideDishScenarios;
  const day = reduceSideDishPreview(initialSideDishPreview, {type: 'day', date: friday.date});
  const small = reduceSideDishPreview(day, {type: 'choose', id: 'quinoa'});
  assert.equal(reduceSideDishPreview(small, {type: 'confirm'}), small);
  const larger = reduceSideDishPreview(small, {type: 'quinoaWeight', dryGrams: 65});
  assert.deepEqual(larger.confirmed, {});
  const confirmed = reduceSideDishPreview(larger, {type: 'confirm'});
  assert.deepEqual(confirmed.confirmed, {[friday.date]: {id: 'quinoa', dryGrams: 65}});
  assert.equal(confirmed.pending, null);
  assert.equal(reduceSideDishPreview(confirmed, {type: 'confirm'}), confirmed);
});
