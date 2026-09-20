import type { NutritionDomainCommand, NutritionPlanReadModel, NutritionRevisionContext } from '../types/nutritionPersistence';
import { assertNutritionReadModelContinuity, createNutritionSimulation, nutritionCommandFingerprint,
  reduceNutritionSimulation } from './nutritionPersistence';
import { nutritionWeekDates } from './nutritionWeek';

export interface NutritionRecoveryBinding {
  accountId: string;
  planId: string;
  weekAnchor: string;
  timeZone: string;
  today: string;
}
export interface NutritionReadTicket { session: number; request: number; binding: NutritionRecoveryBinding }
export interface NutritionAttemptTicket { session: number; attempt: number; idempotencyKey: string; fingerprint: string }
interface RecoveryOperation {
  command: NutritionDomainCommand;
  fingerprint: string;
  ticket: NutritionAttemptTicket;
  status: 'awaiting-outcome' | 'outcome-unknown' | 'accepted' | 'conflict';
}
export interface NutritionRecoveryState {
  mode: 'local-protocol-simulation';
  networkWritesEnabled: false;
  binding: NutritionRecoveryBinding;
  session: number;
  readGeneration: number;
  attemptGeneration: number;
  readTicket: NutritionReadTicket | null;
  status: 'empty' | 'loading' | 'ready' | 'unavailable' | 'conflict';
  model: NutritionPlanReadModel | null;
  /** Session-local continuity evidence, never a cache exposed directly to UI. */
  observed: NutritionPlanReadModel[];
  pending: { command: NutritionDomainCommand; fingerprint: string; modelKey: string } | null;
  operation: RecoveryOperation | null;
  /** In-memory quarantine across account/calendar switches, never exposed as another user's data. */
  detachedOperations: RecoveryOperation[];
  history: RecoveryOperation[];
  requiredReadRevision: NutritionRevisionContext | null;
}
export type NutritionOutcomeFixture = {
  accountId: string; planId: string; idempotencyKey: string; fingerprint: string;
} & ({ outcome: 'accepted'; revision: NutritionRevisionContext } | { outcome: 'conflict' });

const copy = <T,>(value: T): T => structuredClone(value);
const equal = (a: unknown, b: unknown) => nutritionCommandFingerprint(a) === nutritionCommandFingerprint(b);
const unresolved = (op: RecoveryOperation | null) => op?.status === 'awaiting-outcome' || op?.status === 'outcome-unknown';
const current = (s: NutritionRecoveryState) => ({ accountId: s.binding.accountId, today: s.binding.today });
const bound = (b: NutritionRecoveryBinding, c: NutritionRevisionContext) =>
  b.accountId === c.accountId && b.planId === c.planId && b.weekAnchor === c.weekAnchor && b.timeZone === c.timeZone;

export function createNutritionRecovery(binding: NutritionRecoveryBinding, session = 0): NutritionRecoveryState {
  if (!Number.isSafeInteger(session) || session < 0) throw new Error('invalid_session_generation');
  // Validate the client binding independently; no placeholder server revisions.
  if (![binding.accountId, binding.planId, binding.timeZone].every((value) => typeof value === 'string' && value.trim()) ||
      binding.weekAnchor !== nutritionWeekDates(binding.today)[0]) throw new Error('invalid_recovery_binding');
  try { new Intl.DateTimeFormat('en', { timeZone: binding.timeZone }); } catch { throw new Error('invalid_recovery_timezone'); }
  return { mode: 'local-protocol-simulation', networkWritesEnabled: false, binding: copy(binding), session,
    readGeneration: 0, attemptGeneration: 0, readTicket: null, status: 'empty', model: null,
    observed: [], pending: null, operation: null, detachedOperations: [], history: [], requiredReadRevision: null };
}

/** Caller receives unresolved work explicitly; changing accounts must not mean "write failed". */
export function resetNutritionRecovery(state: NutritionRecoveryState, binding: NutritionRecoveryBinding) {
  const next = createNutritionRecovery(binding, state.session + 1);
  const detachedOperation = unresolved(state.operation) ? copy({ ...state.operation!, status: 'outcome-unknown' as const }) : null;
  const retained = [...state.detachedOperations, ...(detachedOperation ? [detachedOperation] : [])];
  const matching = retained.find((op) => bound(binding, op.command.expected));
  return { state: { ...next,
    operation: matching ? { ...copy(matching), ticket: { ...matching.ticket, session: next.session, attempt: 0 } } : null,
    detachedOperations: retained.filter((op) => op !== matching),
    history: state.operation && !unresolved(state.operation) ? [...state.history, copy(state.operation)] : state.history,
  }, detachedOperation };
}

export function beginNutritionRead(state: NutritionRecoveryState): NutritionRecoveryState {
  const request = state.readGeneration + 1;
  return { ...state, status: 'loading', readGeneration: request,
    readTicket: { session: state.session, request, binding: copy(state.binding) } };
}

/** Synthetic response reconciliation only; no fetch or server identity verification. */
export function receiveNutritionRead(state: NutritionRecoveryState, ticket: NutritionReadTicket,
  result: { kind: 'success'; model: NutritionPlanReadModel } | { kind: 'failed' }): NutritionRecoveryState {
  if (!state.readTicket || !equal(state.readTicket, ticket)) return state;
  if (result.kind === 'failed') return { ...state, readTicket: null, status: 'unavailable', model: null, pending: null };
  const model = result.model;
  try {
    if (!bound(state.binding, model.context)) throw new Error('read_scope_conflict');
    createNutritionSimulation(model, state.binding.accountId, state.binding.today);
    if (state.requiredReadRevision && !equal(state.requiredReadRevision, model.context)) throw new Error('receipt_revision_not_reconciled');
    const accepted = state.operation?.status === 'accepted' ? state.operation.command : null;
    if (state.requiredReadRevision && accepted?.type === 'REPLACE') {
      const slot = model.slots.find((item) => item.date === accepted.date && item.slotId === accepted.slotId);
      if (!slot || !equal(slot.snapshot, accepted.replacement)) throw new Error('replacement_receipt_graph_conflict');
    }
    for (const previous of state.observed) assertNutritionReadModelContinuity(previous, model);
    const last = state.observed[state.observed.length - 1];
    if (last && !equal(last.context, model.context) && state.observed.some((item) => equal(item.context, model.context))) {
      throw new Error('retired_read_revision');
    }
    const unchanged = state.model && equal(state.model, model);
    return { ...state, status: 'ready', readTicket: null, model: copy(model), requiredReadRevision: null,
      observed: last && equal(last, model) ? state.observed : [...state.observed, copy(model)],
      pending: unchanged ? state.pending : null };
  } catch {
    // Never retain a clickable stale plan or accidentally complete an unknown operation.
    return { ...state, status: 'conflict', model: null, pending: null, readTicket: null };
  }
}

export function reviewNutritionRecoveryCommand(state: NutritionRecoveryState, command: NutritionDomainCommand): NutritionRecoveryState {
  if (state.status !== 'ready' || !state.model || unresolved(state.operation) ||
      state.detachedOperations.some((op) => op.command.expected.accountId === state.binding.accountId)) throw new Error('nutrition_recovery_not_ready');
  if (state.operation?.command.idempotencyKey === command.idempotencyKey ||
      state.history.some((op) => op.command.expected.accountId === state.binding.accountId &&
        op.command.idempotencyKey === command.idempotencyKey)) throw new Error('use_existing_operation_outcome');
  // No authoritative history read model yet: history edits remain in the separate domain simulator.
  const simulation = createNutritionSimulation(state.model, state.binding.accountId, state.binding.today);
  const proposed = reduceNutritionSimulation(simulation, { type: 'PROPOSE', command }, current(state));
  const preview = reduceNutritionSimulation(proposed, { type: 'PREVIEW' }, current(state));
  return { ...state, pending: { command: copy(command), fingerprint: preview.pending!.fingerprint,
    modelKey: nutritionCommandFingerprint(state.model) } };
}

/** Simulates a submitted request after explicit review. Does not send anything. */
export function simulateNutritionAttempt(state: NutritionRecoveryState,
  confirmation: { fingerprint: string; explicitConfirmation: true }): NutritionRecoveryState {
  if (confirmation.explicitConfirmation !== true || !state.pending || !state.model || state.status !== 'ready' || unresolved(state.operation)) {
    throw new Error('reviewed_confirmation_required');
  }
  const pending = state.pending;
  if (pending.fingerprint !== confirmation.fingerprint || nutritionCommandFingerprint(pending.command) !== pending.fingerprint ||
      nutritionCommandFingerprint(state.model) !== pending.modelKey) throw new Error('changed_recovery_preview');
  reviewNutritionRecoveryCommand(state, pending.command);
  const attempt = state.attemptGeneration + 1;
  const operation: RecoveryOperation = { command: copy(pending.command), fingerprint: pending.fingerprint, status: 'awaiting-outcome',
    ticket: { session: state.session, attempt, idempotencyKey: pending.command.idempotencyKey, fingerprint: pending.fingerprint } };
  return { ...state, attemptGeneration: attempt, pending: null, operation, readTicket: null,
    history: state.operation ? [...state.history, copy(state.operation)] : state.history };
}

export function timeoutNutritionAttempt(state: NutritionRecoveryState, ticket: NutritionAttemptTicket): NutritionRecoveryState {
  if (!state.operation || !equal(state.operation.ticket, ticket) || state.operation.status !== 'awaiting-outcome') return state;
  return { ...state, operation: { ...state.operation, status: 'outcome-unknown' } };
}

export function simulateNutritionRetry(state: NutritionRecoveryState, explicitConfirmation: true): NutritionRecoveryState {
  if (explicitConfirmation !== true || state.operation?.status !== 'outcome-unknown') throw new Error('unknown_outcome_retry_required');
  const attempt = state.attemptGeneration + 1;
  // Preserve original expected revisions, payload and key even if a newer read has arrived.
  return { ...state, attemptGeneration: attempt, readTicket: null, operation: { ...state.operation, status: 'awaiting-outcome',
    ticket: { ...state.operation.ticket, attempt } } };
}

export function receiveNutritionOutcome(state: NutritionRecoveryState, ticket: NutritionAttemptTicket,
  result: NutritionOutcomeFixture): NutritionRecoveryState {
  const op = state.operation;
  if (!op || !unresolved(op) || !equal(ticket, op.ticket)) return state;
  if (result.accountId !== state.binding.accountId || result.planId !== state.binding.planId ||
      result.idempotencyKey !== op.command.idempotencyKey || result.fingerprint !== op.fingerprint) {
    return { ...state, operation: { ...op, status: 'outcome-unknown' } };
  }
  if (result.outcome === 'accepted') {
    try {
      if (!bound(state.binding, result.revision)) throw new Error('receipt_scope_conflict');
      if (result.revision.goalRevision !== op.command.expected.goalRevision ||
          (op.command.type === 'REPLACE' && result.revision.planRevision === op.command.expected.planRevision)) throw new Error('receipt_revision_conflict');
      createNutritionSimulation({ context: result.revision, status: 'active', slots: [] }, state.binding.accountId, state.binding.today);
    } catch { return { ...state, operation: { ...op, status: 'outcome-unknown' } }; }
    return { ...state, operation: { ...op, status: 'accepted' }, requiredReadRevision: copy(result.revision),
      model: null, pending: null, readTicket: null, status: 'empty' };
  }
  if (result.outcome !== 'conflict') return { ...state, operation: { ...op, status: 'outcome-unknown' } };
  return { ...state, operation: { ...op, status: 'conflict' }, model: null, pending: null, readTicket: null, status: 'conflict' };
}

/** Account/calendar-bound projection; never expose archived graphs or foreign operation payloads. */
export function nutritionRecoveryView(state: NutritionRecoveryState, binding: NutritionRecoveryBinding) {
  if (!equal(state.binding, binding)) return { status: 'empty' as const, model: null, outcome: null, canSubmit: false as const };
  return { status: state.status, model: state.status === 'ready' && state.model ? copy(state.model) : null,
    outcome: state.detachedOperations.some((op) => op.command.expected.accountId === binding.accountId) ?
      'outcome-unknown' as const : state.operation?.status ?? null, canSubmit: false as const };
}

/** Binds the older weekly display projection to a reconciled model before enabling local intent controls. */
export function nutritionRecoveryPreviewView(state: NutritionRecoveryState, binding: NutritionRecoveryBinding,
  expected: { planRevision: string; goalRevision: string; slots?: Array<{ date: string; slotId: string; recipeId: string | null }> }) {
  const view = nutritionRecoveryView(state, binding);
  const result = (phase: 'empty' | 'loading' | 'unavailable' | 'conflict' | 'outcome-unknown' |
    'awaiting-outcome' | 'refresh-required' | 'revision-mismatch' | 'graph-mismatch' | 'ready', canReview = false) =>
    ({ phase, canReview, canSubmit: false as const });
  if (view.outcome === 'outcome-unknown' || view.outcome === 'awaiting-outcome') return result(view.outcome);
  if (view.outcome === 'accepted' && state.requiredReadRevision) return result('refresh-required');
  if (view.status !== 'ready' || !view.model) return result(view.status === 'ready' ? 'empty' : view.status);
  if (view.model.context.planRevision !== expected.planRevision || view.model.context.goalRevision !== expected.goalRevision) {
    return result('revision-mismatch');
  }
  if (expected.slots && (expected.slots.length !== view.model.slots.length ||
      new Set(expected.slots.map((slot) => datedSlotKey(slot))).size !== expected.slots.length ||
      expected.slots.some((slot) => !slot.slotId || !slot.recipeId || !view.model!.slots.some((item) =>
        item.date === slot.date && item.slotId === slot.slotId && item.snapshot.recipeId === slot.recipeId)))) return result('graph-mismatch');
  return result('ready', true);
}

const datedSlotKey = (slot: { date: string; slotId: string }) => nutritionCommandFingerprint([slot.date, slot.slotId]);
