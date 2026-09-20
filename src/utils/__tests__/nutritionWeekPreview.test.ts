import assert from 'node:assert/strict';
import test from 'node:test';
import { nutritionWeekPreviewFixture } from '../../test/nutritionWeekPreviewFixture';
import { createWeekPreviewState, reduceWeekPreview, weekPreviewContextKey } from '../nutritionWeekPreview';
import { DAILY_NUTRITION_STATES, normalizeDailyNutritionState } from '../nutritionAdaptation';
import { normalizeCuratedRecipeTag, PREMIUM_NUTRITION_FILTERS } from '../curatedRecipeEligibility';

test('four meal actions leave original plan untouched and never complete a diary fact', () => {
  const { context } = nutritionWeekPreviewFixture();
  const before = structuredClone(context);
  const state = createWeekPreviewState(context);
  for (const choice of ['ate-as-planned', 'ate-with-changes', 'did-not-eat', 'extra-food'] as const) {
    const next = reduceWeekPreview(state, { type: 'meal-intent', contextKey: state.contextKey,
      slotId: choice === 'extra-food' ? null : 'fixture-slot-3', choice }, context);
    assert.equal(next.intent?.choice, choice);
    assert.equal(next.intent?.createsDiaryFact, false);
    assert.equal(next.intent?.requiresFactReview, true);
    assert.equal(state.intent, null);
    assert.deepEqual(context, before);
    assert.equal(reduceWeekPreview(next, { type: 'dismiss-intent', contextKey: state.contextKey }, context).intent, null);
  }
});

test('future and foreign-day slots cannot be confirmed; changing date dismisses old intent', () => {
  const { context } = nutritionWeekPreviewFixture();
  const state = createWeekPreviewState(context);
  assert.throws(() => reduceWeekPreview(state, { type: 'meal-intent', contextKey: state.contextKey,
    slotId: 'fixture-slot-1', choice: 'ate-as-planned' }, context), /meal_outside/);
  const confirmed = reduceWeekPreview(state, { type: 'meal-intent', contextKey: state.contextKey,
    slotId: 'fixture-slot-3', choice: 'ate-as-planned' }, context);
  const future = reduceWeekPreview(confirmed, { type: 'select-day', date: '2026-09-17', contextKey: state.contextKey }, context);
  assert.equal(future.intent, null);
  assert.throws(() => reduceWeekPreview(future, { type: 'meal-intent', contextKey: state.contextKey,
    slotId: null, choice: 'extra-food' }, context), /future/);
  assert.throws(() => reduceWeekPreview(state, { type: 'select-day', date: '2026-09-21', contextKey: state.contextKey }, context), /outside/);
});

test('account, plan/goal version and date rollover invalidate stale actions', () => {
  const { context } = nutritionWeekPreviewFixture();
  const state = createWeekPreviewState(context);
  assert.throws(() => createWeekPreviewState({ ...context, currentUserId: 'account-B' }), /scope/);
  assert.throws(() => createWeekPreviewState({ ...context, week: { ...context.week, status: 'provisional' } }), /scope/);
  for (const update of [{ planVersion: 'plan-v2' }, { goalVersion: 'goal-v2' }]) {
    const changed = { ...context, week: { ...context.week, scope: { ...context.week.scope, ...update } } };
    assert.notEqual(weekPreviewContextKey(changed), state.contextKey);
    assert.throws(() => reduceWeekPreview(state, { type: 'dismiss-intent', contextKey: state.contextKey }, changed), /stale/);
    assert.equal(createWeekPreviewState(changed).intent, null);
  }
  assert.throws(() => reduceWeekPreview(state, { type: 'dismiss-intent', contextKey: 'foreign' }, context), /stale/);
  assert.notEqual(weekPreviewContextKey({ ...context, today: '2026-09-17' }), state.contextKey);
});

test('six daily states remain scoped to selected day without nutrition mutations', () => {
  const { context } = nutritionWeekPreviewFixture();
  const before = structuredClone(context);
  let state = createWeekPreviewState(context);
  assert.deepEqual(DAILY_NUTRITION_STATES.map(({ id }) => id), ['normal', 'no_time', 'tired', 'hungry', 'training_day', 'rest_day']);
  for (const { id } of DAILY_NUTRITION_STATES) {
    state = reduceWeekPreview(state, { type: 'day-state', value: id, contextKey: state.contextKey }, context);
    assert.equal(state.dayStates[context.today], id);
    assert.equal(state.intent, null);
  }
  state = reduceWeekPreview(state, { type: 'select-day', date: '2026-09-15', contextKey: state.contextKey }, context);
  assert.equal(state.dayStates[state.selectedDate], undefined);
  assert.equal(state.dayStates[context.today], 'rest_day');
  assert.deepEqual(context, before);
});

test('compatibility normalizes only explicit known day states and reviewed-tag spellings', () => {
  assert.equal(normalizeDailyNutritionState('low_energy'), 'tired');
  assert.equal(normalizeDailyNutritionState('ready'), null);
  assert.equal(normalizeDailyNutritionState('rest'), 'rest_day');
  assert.equal(normalizeCuratedRecipeTag('gain'), 'bulk');
  assert.equal(normalizeCuratedRecipeTag('high-protein'), 'high_protein');
  assert.equal(normalizeCuratedRecipeTag('higher-carb'), 'high_carb');
  assert.deepEqual(PREMIUM_NUTRITION_FILTERS.map(({ tag }) => tag), ['cut', 'bulk', 'vegan', 'high_protein', 'high_carb', 'keto']);
  for (const value of ['unknown', '__proto__', 'constructor', 'toString']) {
    assert.equal(normalizeDailyNutritionState(value), null);
    assert.equal(normalizeCuratedRecipeTag(value), null);
  }
});
