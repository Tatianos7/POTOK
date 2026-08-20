import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTodayPlanFromDemoDay,
  getDemoTodayPrograms,
  todayNotSuitableReasons,
  updateTodayPlanItemStatus,
} from '../demoTodayPlansProvider';

test('demo provider exposes a purchased plan preview program', () => {
  const programs = getDemoTodayPrograms();
  const program = programs[0];

  assert.equal(program.title, 'Похудение дома · 7 дней');
  assert.equal(program.goal, 'снижение веса');
  assert.equal(program.format, 'дома');
  assert.equal(program.level, 'начинающий');
  assert.equal(program.durationDays, 7);
  assert.equal(program.days.length, 7);
});

test('demo program day produces Today meal, workout, and water items', () => {
  const plan = buildTodayPlanFromDemoDay('demo-home-weight-loss-7-days', 1, '2026-08-20');

  assert.equal(plan.source, 'purchased_plan');
  assert.equal(plan.items.length, 3);
  assert.equal(plan.items[0].type, 'meal');
  assert.equal(plan.items[0].title, 'Завтрак');
  assert.equal(plan.items[0].subtitle, 'Овсянка, банан, йогурт');
  assert.equal(plan.items[0].actionLabel, 'Перейти в дневник');
  assert.equal(plan.items[1].type, 'workout');
  assert.equal(plan.items[1].actionLabel, 'Начать тренировку');
  assert.equal(plan.items[2].type, 'water');
  assert.equal(plan.items[2].actionLabel, 'Выполнено');
});

test('done action changes only mock Today plan state', () => {
  const plan = buildTodayPlanFromDemoDay('demo-home-weight-loss-7-days', 1, '2026-08-20');
  const updated = updateTodayPlanItemStatus(plan, plan.items[2].id, 'done');

  assert.equal(updated.items[2].status, 'done');
  assert.equal(updated.status, 'partially_completed');
  assert.equal(plan.items[2].status, 'planned');
});

test('not suitable action stores a mock reason without mutation', () => {
  const plan = buildTodayPlanFromDemoDay('demo-home-weight-loss-7-days', 1, '2026-08-20');
  const updated = updateTodayPlanItemStatus(plan, plan.items[0].id, 'not_suitable', 'no_products');

  assert.ok(todayNotSuitableReasons.some((reason) => reason.id === 'no_products'));
  assert.equal(updated.items[0].status, 'not_suitable');
  assert.equal(updated.items[0].notSuitableReason, 'no_products');
  assert.equal(plan.items[0].notSuitableReason, undefined);
});
