import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Today from '../Today';
import { nutritionWeekPreviewFixture } from '../../test/nutritionWeekPreviewFixture';
import { beginNutritionRead, createNutritionRecovery, receiveNutritionRead, reviewNutritionRecoveryCommand,
  simulateNutritionAttempt, timeoutNutritionAttempt, type NutritionRecoveryState } from '../../utils/nutritionRecovery';
import type { NutritionPlanReadModel } from '../../types/nutritionPersistence';

function fixture() {
  const week = nutritionWeekPreviewFixture();
  const binding = { accountId: week.scope.userId, planId: week.scope.planId, weekAnchor: week.weeks.active.startDate,
    today: week.today, timeZone: 'Europe/Moscow' };
  const model: NutritionPlanReadModel = { context: { accountId: binding.accountId, planId: binding.planId,
    weekAnchor: binding.weekAnchor, timeZone: binding.timeZone, planRevision: week.scope.planVersion, goalRevision: week.scope.goalVersion },
    status: 'active', slots: [{ date: week.today, slotId: 'fixture-slot-3', snapshot: {
      recipeId: 'synthetic-recipe', recipeRevision: 'recipe-1', snapshotRevision: 'snapshot-1', portionRevision: 'portion-1', servings: 1,
      foods: [{ foodRef: 'synthetic-food', name: 'Synthetic food', amount: 100, unit: 'g', state: 'raw',
        nutrition: { calories: 100, protein: 10, fat: 5, carbs: 20 } }] } }] };
  const snapshot = model.slots[0].snapshot;
  model.slots = week.weeks.active.days.flatMap((day) => (day.sourceDay?.meals ?? []).map((meal) => {
    meal.catalogPrimaryRecipeId = snapshot.recipeId!;
    return { date: day.date, slotId: meal.catalogSlotId!, snapshot: structuredClone(snapshot) };
  }));
  const reading = beginNutritionRead(createNutritionRecovery(binding));
  return { week, binding, model, state: receiveNutritionRead(reading, reading.readTicket!, { kind: 'success', model }) };
}
function render(state: NutritionRecoveryState, fixtureData = fixture()) {
  const { week, binding } = fixtureData;
  return renderToStaticMarkup(<MemoryRouter><Today currentUserId={binding.accountId}
    weeklyPreview={{ today: week.today, weeks: week.weeks, source: 'catalog-preview', recovery: { state, timeZone: binding.timeZone } }} /></MemoryRouter>);
}

test('Today optional local recovery projection permits intent controls only for a reconciled matching model', () => {
  const f = fixture(); const html = render(f.state, f);
  assert.match(html, /Локальный сценарий восстановления/);
  assert.match(html, /Версия недельного экрана согласована/);
  assert.match(html, /Fixture meal 3/);
  assert.match(html, /Съел\(а\) по плану/);
  assert.match(html, /Отправка запросов и запись в дневник выключены/);
});

test('loading, foreign account and newer goal hide stale meal buttons and content', () => {
  const f = fixture();
  const changed = structuredClone(f.model); changed.context.goalRevision = 'new-goal';
  const reading = beginNutritionRead(f.state);
  const newer = receiveNutritionRead(reading, reading.readTicket!, { kind: 'success', model: changed });
  const foreign = { ...f.state, binding: { ...f.binding, accountId: 'foreign-account' } };
  for (const state of [reading, newer, foreign]) {
    const html = render(state, f);
    assert.doesNotMatch(html, /Fixture meal|Съел\(а\)|Было что-то ещё/);
    assert.match(html, /Состояние восстановления плана/);
  }
});

test('timeout preview explicitly says unknown and never exposes a second meal action or success message', () => {
  const f = fixture(); const snapshot = f.model.slots[0].snapshot;
  const reviewed = reviewNutritionRecoveryCommand(f.state, { type: 'MEAL', action: 'CONSUMED_AS_PLANNED', expected: f.model.context,
    expectedLocalSequence: 0, idempotencyKey: 'synthetic-key', date: f.week.today, slotId: 'fixture-slot-3',
    expectedSnapshot: { snapshotRevision: snapshot.snapshotRevision, recipeRevision: snapshot.recipeRevision, portionRevision: snapshot.portionRevision } });
  const active = simulateNutritionAttempt(reviewed, { fingerprint: reviewed.pending!.fingerprint, explicitConfirmation: true });
  const unknown = timeoutNutritionAttempt(active, active.operation!.ticket);
  const html = render(unknown, f);
  assert.match(html, /Результат действия неизвестен/);
  assert.doesNotMatch(html, /Fixture meal|Съел\(а\)|Сохранено|Записано в дневник/);
});

test('matching revision labels cannot enable a weekly display with different recipe or slot identities', () => {
  for (const mismatch of ['recipe', 'slot', 'missing-day']) {
    const f = fixture(); const day = f.week.weeks.active.days[2];
    if (mismatch === 'recipe') day.sourceDay!.meals[0].catalogPrimaryRecipeId = 'wrong-recipe';
    if (mismatch === 'slot') day.sourceDay!.meals[0].catalogSlotId = 'wrong-slot';
    if (mismatch === 'missing-day') day.sourceDay = null;
    const html = render(f.state, f);
    assert.match(html, /Состав недельного экрана не совпадает/);
    assert.doesNotMatch(html, /Fixture meal|Съел\(а\)/);
  }
});
