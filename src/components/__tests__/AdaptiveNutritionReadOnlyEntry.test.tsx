import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdaptiveNutritionReadOnlyEntryView } from '../AdaptiveNutritionReadOnlyEntry';
import type { AdaptiveNutritionReadOnlyEntryState } from '../../services/adaptiveNutritionReadOnlyEntry';

const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
const ids = {
  account: '12000000-0000-4000-8000-000000000001',
  selection: '23000000-0000-4000-8000-000000000001',
  plan: '34000000-0000-4000-8000-000000000001',
  goal: '45000000-0000-4000-8000-000000000001',
  history: '56000000-0000-4000-8000-000000000001',
  diary: '67000000-0000-4000-8000-000000000001',
  slot: '78000000-0000-4000-8000-000000000001',
  snapshot: '89000000-0000-4000-8000-000000000001',
  portion: '9a000000-0000-4000-8000-000000000001',
};

function state(phase: AdaptiveNutritionReadOnlyEntryState['phase']): AdaptiveNutritionReadOnlyEntryState {
  const model = {
    kind: 'ready' as const, selectionId: ids.selection, weekAnchor: dates[0], timeZone: 'Europe/Moscow',
    status: 'active' as const, originKind: 'generated' as const, originLineage: { source: 'goal-plan-engine-v1' },
    planRevision: ids.plan, goalRevision: ids.goal, historyRevision: ids.history, diaryRevision: ids.diary,
    graph: {}, events: [], exactOperationId: null,
  };
  return {
    phase,
    accountId: ids.account,
    today: dates[1],
    timeZone: 'Europe/Moscow',
    selectionId: ids.selection,
    model: phase === 'ready' ? model : null,
    slots: phase === 'ready' ? [{ date: dates[1], slotId: ids.slot, snapshot: {
      snapshotRevision: ids.snapshot, recipeRevision: null, portionRevision: ids.portion,
    } }] : [],
  };
}

test('ready entry renders seven authoritative days and no mutation surface', () => {
  const html = renderToStaticMarkup(<AdaptiveNutritionReadOnlyEntryView state={state('ready')} />);
  assert.match(html, /Активная неделя|Блюдо подтверждено сервером/);
  assert.equal((html.match(/aria-label="(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс) \d\d\.\d\d"/g) ?? []).length, 7);
  assert.doesNotMatch(html,
    /Не ел\(а\)|Отменить отметку|Заменить блюдо|Съел\(а\) по плану|Съел\(а\) с изменениями|Было что-то ещё/);
});

test('zero and ambiguous selections render distinct fail-closed states', () => {
  const none = renderToStaticMarkup(<AdaptiveNutritionReadOnlyEntryView state={state('no_active_plan')} />);
  assert.match(none, /Персональный недельный план ещё не создан/);
  assert.doesNotMatch(none, /14 дней|Питание \+ тренировки/);
  const ambiguous = renderToStaticMarkup(<AdaptiveNutritionReadOnlyEntryView state={state('ambiguous')} />);
  assert.match(ambiguous, /несколько активных версий/);
  assert.doesNotMatch(ambiguous, /Блюдо подтверждено сервером/);
});

test('read-only entry source cannot import or dispatch the mutation controller', () => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const component = readFileSync(resolve(currentDir, '../AdaptiveNutritionReadOnlyEntry.tsx'), 'utf8');
  const controller = readFileSync(resolve(currentDir, '../../services/adaptiveNutritionReadOnlyEntry.ts'), 'utf8');
  for (const source of [component, controller]) {
    assert.doesNotMatch(source, /import\s+\{[^}]*adaptiveNutritionPersistenceService|AdaptiveNutritionTodayRuntimeController/);
    assert.doesNotMatch(source, /\.mutate\(|\.skip\(|\.undoAnnotation\(|\.replace\(/);
    assert.doesNotMatch(source, /CONSUMED_AS_PLANNED|CONSUMED_MODIFIED|EXTRA_FOOD|PLAN_REPLACED/);
  }
});
