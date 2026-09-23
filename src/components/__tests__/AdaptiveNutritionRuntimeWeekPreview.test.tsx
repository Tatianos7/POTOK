import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdaptiveNutritionRuntimeWeekView } from '../AdaptiveNutritionRuntimeWeekPreview';
import type { AdaptiveNutritionTodayState } from '../../services/adaptiveNutritionTodayRuntime';
import type { PremiumNutritionWeek } from '../../services/premiumTodayAdapter';

const slotId = '70000000-0000-4000-8000-000000000001';
const recipeId = '71000000-0000-4000-8000-000000000001';
const eventId = '72000000-0000-4000-8000-000000000001';
const offerId = '73000000-0000-4000-8000-000000000001';
const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];

const week: PremiumNutritionWeek = {
  scope: { userId: '10000000-0000-4000-8000-000000000001', planId: '20000000-0000-4000-8000-000000000001',
    planVersion: 'server', goalVersion: 'server' },
  status: 'active', startDate: dates[0], endDate: dates[6], contentStatus: 'incomplete', targetValidation: 'not-validated',
  days: dates.map((date, index) => ({ date, kind: 'planned', sourceDay: index === 1 ? {
    day: 2, macros: 'local', calories: 'local', macroDetails: 'local', workout: null,
    meals: [{ title: 'Обед', summary: 'Проверенное локальное название', calories: '420 ккал',
      macroDetails: 'Б 30 · Ж 10 · У 50', ingredients: [], portionHints: [], steps: [],
      catalogSlotId: slotId, catalogPrimaryRecipeId: recipeId }],
  } : null })),
};

function readyState(events: unknown[] = []): AdaptiveNutritionTodayState {
  return {
    phase: 'ready', accountId: week.scope.userId, selectionId: week.scope.planId, today: dates[1], pending: null,
    notice: null,
    slots: [{ date: dates[1], slotId, snapshot: { snapshotRevision: '74000000-0000-4000-8000-000000000001',
      recipeRevision: recipeId, portionRevision: '75000000-0000-4000-8000-000000000001' } }],
    model: { kind: 'ready', selectionId: week.scope.planId, weekAnchor: dates[0], timeZone: 'Europe/Moscow',
      status: 'active', originKind: 'generated', originLineage: {},
      planRevision: '76000000-0000-4000-8000-000000000001',
      goalRevision: '77000000-0000-4000-8000-000000000001',
      historyRevision: '78000000-0000-4000-8000-000000000001',
      diaryRevision: '79000000-0000-4000-8000-000000000001',
      graph: {}, events, exactOperationId: null },
  };
}

const noop = () => undefined;
function render(state: AdaptiveNutritionTodayState, replacementOfferIds?: Readonly<Record<string, string>>, readOnly = false) {
  return renderToStaticMarkup(<AdaptiveNutritionRuntimeWeekView state={state} today={dates[1]} week={week}
    selectedDate={dates[1]} replacementOfferIds={replacementOfferIds} readOnly={readOnly}
    onSelectDate={noop} onSkip={noop} onUndo={noop} onReplace={noop}
    onResolveUnknown={noop} onAcknowledgeConflict={noop} />);
}

test('authoritative ready week exposes only annotation actions and an explicitly supplied offer', () => {
  const withoutOffer = render(readyState());
  assert.match(withoutOffer, /Проверенное локальное название/);
  assert.match(withoutOffer, /Не ел\(а\)/);
  assert.doesNotMatch(withoutOffer, /Заменить блюдо|Съел\(а\) по плану|Съел\(а\) с изменениями|Было что-то ещё/);

  const withOffer = render(readyState(), { [slotId]: offerId });
  assert.match(withOffer, /Заменить блюдо/);
  assert.doesNotMatch(withOffer, new RegExp(`${slotId}|${offerId}|[a-f0-9]{64}`));
});

test('live annotation offers server-backed undo instead of a second skip', () => {
  const html = render(readyState([{ event_id: eventId, kind: 'ANNOTATION', slot_id: slotId,
    local_date: dates[1], supersedes_event_id: null }]));
  assert.match(html, /Отменить отметку/);
  assert.doesNotMatch(html, /<button[^>]*>Не ел\(а\)<\/button>/);
});

test('UNKNOWN, conflict, and denied states explain recovery and block mutation controls', () => {
  const unknown = render({ ...readyState(), phase: 'unknown', pending: {
    rawRequest: '{"redacted":"in-test"}', idempotencyKey: '7a000000-0000-4000-8000-000000000001',
  } });
  assert.match(unknown, /Результат операции пока неизвестен|Проверить результат/);
  assert.match(unknown, /disabled=""/);

  const conflict = render({ ...readyState(), phase: 'conflict' });
  assert.match(conflict, /План изменился|Показать обновлённый план/);
  assert.doesNotMatch(conflict, /подтверждено сервером/);

  const denied = render({ ...readyState(), phase: 'denied' });
  assert.match(denied, /Premium-доступ сейчас не подтверждён/);
  assert.match(denied, /disabled=""/);
});

test('unmatched server snapshot never borrows local catalog labels or macros', () => {
  const state = readyState();
  state.slots[0].snapshot.recipeRevision = null;
  const html = render(state);
  assert.match(html, /Блюдо подтверждено сервером/);
  assert.doesNotMatch(html, /Проверенное локальное название|420 ккал|Б 30/);
});

test('read-only view exposes the authoritative week with no mutation or FACT controls', () => {
  const html = render(readyState([{ event_id: eventId, kind: 'ANNOTATION', slot_id: slotId,
    local_date: dates[1], supersedes_event_id: null }]), { [slotId]: offerId }, true);
  assert.match(html, /Активная неделя|Проверенное локальное название/);
  assert.match(html, /Действия с планом и дневником пока недоступны/);
  assert.doesNotMatch(html,
    /Не ел\(а\)|Отменить отметку|Заменить блюдо|Съел\(а\) по плану|Съел\(а\) с изменениями|Было что-то ещё/);
});
