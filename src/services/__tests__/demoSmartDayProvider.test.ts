import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoSmartDayPlan, smartDayStateOptions } from '../demoSmartDayProvider';
import { updateTodayPlanItemStatus } from '../demoTodayPlansProvider';

test('Smart Day exposes the three owner-approved day states', () => {
  assert.deepEqual(
    smartDayStateOptions.map((state) => state.label),
    ['Нет сил', 'Обычный день', 'Готова работать']
  );
});

test('Smart Day demo plan contains nutrition, workout, water/activity, and recommendations', () => {
  const plan = buildDemoSmartDayPlan('normal', '2026-08-21');

  assert.equal(plan.source, 'smart_day');
  assert.equal(plan.title, 'Сегодня готово · Обычный день');
  assert.deepEqual(
    plan.items.map((item) => item.type),
    ['meal', 'workout', 'water', 'task']
  );
  assert.match(plan.items[0].subtitle ?? '', /Завтрак|завтрак/);
  assert.match(plan.items[1].subtitle ?? '', /25 минут/);
  assert.match(plan.items[2].title, /Вода/);
  assert.match(plan.items[3].title, /Рекомендации/);
});

test('Smart Day demo actions update only mock Today plan state', () => {
  const plan = buildDemoSmartDayPlan('low_energy', '2026-08-21');
  const updated = updateTodayPlanItemStatus(plan, plan.items[0].id, 'done');

  assert.equal(updated.items[0].status, 'done');
  assert.equal(updated.status, 'partially_completed');
  assert.equal(plan.items[0].status, 'planned');
});
