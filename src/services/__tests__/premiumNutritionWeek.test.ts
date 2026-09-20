import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPremiumNutritionWeeks } from '../premiumTodayAdapter';
import type { PremiumMealSlot, PremiumPlan, PremiumPlanDay } from '../premiumCatalogService';

const plan: PremiumPlan = { id: 'legacy-plan', title: 'Legacy fixture', subtitle: '', goalType: 'maintain',
  durationDays: 14, difficulty: '', isActive: true };
const scope = { userId: 'A', planId: plan.id, planVersion: 'fixture-v1', goalVersion: 'fixture-goal-v1' };
const days: PremiumPlanDay[] = Array.from({ length: 14 }, (_, i) => ({ id: `day-${i + 1}`, planId: plan.id,
  dayNumber: i + 1, calories: null, protein: null, fat: null, carbs: null,
  workoutTitle: '', workoutDurationMin: null, workoutFocus: '' }));
const slotsByDayId: Record<string, PremiumMealSlot[]> = Object.fromEntries(days.map((day) => [day.id, [{
  id: `slot-${day.id}`, dayId: day.id, mealType: 'lunch', title: 'Synthetic slot',
  calories: null, protein: null, fat: null, carbs: null, sortOrder: 0,
}]]));
const input = { plan, days, scope, slotsByDayId, sourceStartDate: '2026-09-14', today: '2026-09-19' };

test('14-day source becomes seven active and seven provisional dates without changing IDs or facts', () => {
  const before = structuredClone(input);
  const result = buildPremiumNutritionWeeks(input);
  assert.equal(result.active.status, 'active');
  assert.equal(result.provisional.status, 'provisional');
  assert.equal(result.active.days.length, 7);
  assert.equal(result.active.days[0].sourceDay?.day, 1);
  assert.equal(result.provisional.days[0].sourceDay?.day, 8);
  assert.equal(result.provisional.days[6].sourceDay?.catalogDayId, 'day-14');
  assert.equal(result.active.targetValidation, 'not-validated');
  assert.equal(result.active.days.every((day) => day.kind === 'planned'), true);
  assert.deepEqual(input, before);
});

test('two-day seed remains incomplete; missing days never borrow a demo or repeat day 1', () => {
  const result = buildPremiumNutritionWeeks({ ...input, days: days.slice(0, 2) });
  assert.equal(result.active.contentStatus, 'incomplete');
  assert.equal(result.active.days[2].sourceDay, null);
  assert.equal(result.provisional.days.every((day) => day.sourceDay === null), true);
  assert.equal(buildPremiumNutritionWeeks({ ...input, slotsByDayId: {} }).active.contentStatus, 'incomplete');
});

test('calendar rollover selects actual remaining source dates without cycling old meals', () => {
  const next = buildPremiumNutritionWeeks({ ...input, today: '2026-09-21' });
  assert.equal(next.active.days[0].sourceDay?.day, 8);
  assert.equal(next.provisional.days.every((day) => day.sourceDay === null), true);
  const midweek = buildPremiumNutritionWeeks({ ...input, sourceStartDate: '2026-09-16' });
  assert.equal(midweek.active.days[0].sourceDay, null);
  assert.equal(midweek.active.days[2].sourceDay?.day, 1);
});

test('invalid scope, ambiguous source dates and cross-plan/day data are rejected', () => {
  assert.throws(() => buildPremiumNutritionWeeks({ ...input, scope: { ...scope, userId: '' } }), /scope/);
  assert.throws(() => buildPremiumNutritionWeeks({ ...input, plan: { ...plan, isActive: false } }), /scope/);
  assert.throws(() => buildPremiumNutritionWeeks({ ...input, scope: { ...scope, planId: 'other' } }), /scope/);
  assert.throws(() => buildPremiumNutritionWeeks({ ...input, days: [days[0], { ...days[0], id: 'other' }] }), /duplicate/);
  assert.throws(() => buildPremiumNutritionWeeks({ ...input, days: [{ ...days[0], planId: 'other' }] }), /source_plan_day/);
  assert.throws(() => buildPremiumNutritionWeeks({ ...input, slotsByDayId: { 'day-1': [{ ...slotsByDayId['day-1'][0], dayId: 'other' }] } }), /meal_scope/);
  assert.throws(() => buildPremiumNutritionWeeks({ ...input, days: [], sourceStartDate: '2026-02-30' }), /calendar/);
});
