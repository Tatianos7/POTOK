import type { NutritionDomainCommand, NutritionPlanReadModel, NutritionPortionSnapshot,
  NutritionRevisionContext, NutritionSimulatedEffect, NutritionSimulationState } from '../types/nutritionPersistence';
import { nutritionWeekDates, parseNutritionDate } from './nutritionWeek';

const clone = <T,>(value: T): T => structuredClone(value);
const required = (value: string) => typeof value === 'string' && value.trim().length > 0;

/** Stable content identity for in-memory replay checks, not a cryptographic signature. */
export function nutritionCommandFingerprint(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(nutritionCommandFingerprint).join(',')}]`;
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${nutritionCommandFingerprint((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  throw new Error('invalid_command_value');
}

export function nutritionRevisionKey(context: NutritionRevisionContext): string {
  return nutritionCommandFingerprint(context);
}

function assertContext(graph: NutritionPlanReadModel, accountId: string, today: string) {
  parseNutritionDate(today);
  const c = graph.context;
  if (!required(accountId) || c.accountId !== accountId ||
      ![c.accountId, c.planId, c.planRevision, c.goalRevision, c.weekAnchor, c.timeZone].every(required)) throw new Error('nutrition_account_or_revision_missing');
  try { new Intl.DateTimeFormat('en', { timeZone: c.timeZone }); } catch { throw new Error('invalid_nutrition_timezone'); }
  if (graph.status !== 'active' || c.weekAnchor !== nutritionWeekDates(today)[0]) throw new Error('inactive_nutrition_week');
}

function assertSnapshot(snapshot: NutritionPortionSnapshot) {
  if (!snapshot || ![snapshot.snapshotRevision, snapshot.portionRevision].every(required) ||
      (snapshot.recipeId === null ? snapshot.recipeRevision !== null : !required(snapshot.recipeId) || !required(snapshot.recipeRevision ?? '')) ||
      !Number.isFinite(snapshot.servings) || snapshot.servings <= 0 || !snapshot.foods?.length) throw new Error('missing_actual_food_or_portion_snapshot');
  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const food of snapshot.foods) {
    if (!required(food.foodRef) || !required(food.name) || !Number.isFinite(food.amount) || food.amount <= 0 ||
        !['g', 'ml'].includes(food.unit) || !['raw', 'dry', 'frozen', 'cooked', 'as-sold'].includes(food.state)) throw new Error('invalid_snapshot_food');
    for (const key of ['calories', 'protein', 'fat', 'carbs'] as const) {
      if (!Number.isFinite(food.nutrition?.[key]) || food.nutrition[key] < 0) throw new Error('invalid_snapshot_nutrition');
      totals[key] += food.nutrition[key];
      if (!Number.isFinite(totals[key])) throw new Error('snapshot_nutrition_overflow');
    }
  }
}

function assertGraph(graph: NutritionPlanReadModel) {
  const dates = nutritionWeekDates(graph.context.weekAnchor);
  const seen = new Set<string>();
  const snapshots: NutritionPortionSnapshot[] = [];
  for (const slot of graph.slots) {
    const key = nutritionCommandFingerprint([slot.date, slot.slotId]);
    if (!dates.includes(slot.date) || !required(slot.slotId) || seen.has(key)) throw new Error('invalid_or_duplicate_dated_slot');
    seen.add(key);
    assertSnapshot(slot.snapshot);
    assertSnapshotConsistency(slot.snapshot, snapshots);
    snapshots.push(slot.snapshot);
    if (!slot.snapshot.recipeId) throw new Error('planned_recipe_missing');
  }
}

function assertSnapshotConsistency(candidate: NutritionPortionSnapshot, snapshots: NutritionPortionSnapshot[]) {
  for (const previous of snapshots) {
    if (previous.snapshotRevision === candidate.snapshotRevision &&
        nutritionCommandFingerprint(previous) !== nutritionCommandFingerprint(candidate)) throw new Error('contradictory_snapshot_revision');
    if (previous.recipeId === candidate.recipeId && previous.recipeRevision === candidate.recipeRevision &&
        previous.portionRevision === candidate.portionRevision &&
        nutritionCommandFingerprint([previous.servings, previous.foods]) !== nutritionCommandFingerprint([candidate.servings, candidate.foods])) {
      throw new Error('contradictory_portion_revision');
    }
  }
}

/** Cross-read immutability check; opaque revisions cannot be ordered lexically. */
export function assertNutritionReadModelContinuity(previous: NutritionPlanReadModel, next: NutritionPlanReadModel) {
  if (previous.context.accountId !== next.context.accountId || previous.context.planId !== next.context.planId) {
    throw new Error('nutrition_read_model_scope_conflict');
  }
  if (previous.context.planRevision === next.context.planRevision &&
      nutritionCommandFingerprint([previous.status, previous.slots]) !== nutritionCommandFingerprint([next.status, next.slots])) {
    throw new Error('contradictory_plan_revision');
  }
  for (const slot of next.slots) assertSnapshotConsistency(slot.snapshot, previous.slots.map((item) => item.snapshot));
}

function assertCandidateSnapshot(state: NutritionSimulationState, snapshot: NutritionPortionSnapshot) {
  assertSnapshot(snapshot);
  const previous = state.graph.slots.map((slot) => slot.snapshot);
  for (const { effect } of state.history) {
    if (effect.kind === 'diary-snapshot') previous.push(effect.snapshot);
    if (effect.kind === 'plan-replacement') previous.push(effect.before, effect.after);
  }
  assertSnapshotConsistency(snapshot, previous);
}

export function createNutritionSimulation(graph: NutritionPlanReadModel, accountId: string, today: string): NutritionSimulationState {
  assertContext(graph, accountId, today);
  assertGraph(graph);
  return { mode: 'local-simulation', networkWritesEnabled: false, graph: clone(graph),
    localSequence: 0, localPlanSequence: 0, history: [], pending: null };
}

/** History is append-only; edit/undo only supersede a currently effective snapshot. */
export function effectiveSimulatedDiary(state: NutritionSimulationState) {
  const superseded = new Set(state.history.flatMap(({ effect }) =>
    'supersedes' in effect && effect.supersedes ? [effect.supersedes] : []));
  return clone(state.history.filter((event) => event.effect.kind === 'diary-snapshot' && !superseded.has(event.eventId)));
}

export function effectiveSimulatedSkips(state: NutritionSimulationState) {
  return clone(state.history.filter((event, index) => event.effect.kind === 'skip-annotation' &&
    !state.history.slice(index + 1).some(({ effect }) => effect.date === event.effect.date && effect.slotId === event.effect.slotId &&
      ['skip-annotation', 'diary-snapshot', 'annotation-retraction'].includes(effect.kind))));
}

function previewEffect(state: NutritionSimulationState, command: NutritionDomainCommand, today: string): NutritionSimulatedEffect {
  if (nutritionRevisionKey(command.expected) !== nutritionRevisionKey(state.graph.context) ||
      command.expectedLocalSequence !== state.localSequence) throw new Error('nutrition_revision_conflict');
  if (!required(command.idempotencyKey)) throw new Error('missing_idempotency_key');
  if (command.type === 'UNDO_ANNOTATION') {
    const target = effectiveSimulatedSkips(state).find((event) => event.eventId === command.targetEventId);
    if (!target || target.effect.kind !== 'skip-annotation') throw new Error('stale_or_unknown_annotation');
    return { kind: 'annotation-retraction', date: target.effect.date, slotId: target.effect.slotId, supersedes: target.eventId };
  }
  if (command.type === 'REVISE_FACT') {
    const target = effectiveSimulatedDiary(state).find((event) => event.eventId === command.targetEventId);
    if (!target || target.effect.kind !== 'diary-snapshot') throw new Error('stale_or_unknown_fact_history');
    const { date, slotId } = target.effect;
    if (command.operation === 'UNDO') {
      if ('actual' in command) throw new Error('undo_must_not_create_fact');
      return { kind: 'fact-retraction', date, slotId, supersedes: target.eventId };
    }
    if (command.operation !== 'EDIT') throw new Error('unknown_history_operation');
    assertCandidateSnapshot(state, command.actual);
    return { kind: 'diary-snapshot', date, slotId, snapshot: clone(command.actual), supersedes: target.eventId };
  }
  if (!nutritionWeekDates(state.graph.context.weekAnchor).includes(command.date)) throw new Error('date_outside_active_week');
  if (command.type === 'MEAL' && command.date > today) throw new Error('future_meal_is_not_fact');
  if (command.type === 'MEAL' && command.action === 'EXTRA_FOOD') {
    if (command.slotId !== null) throw new Error('extra_food_is_independent');
    assertCandidateSnapshot(state, command.actual);
    return { kind: 'diary-snapshot', date: command.date, slotId: null, snapshot: clone(command.actual), supersedes: null };
  }
  const slots = state.graph.slots.filter((slot) => slot.slotId === command.slotId && slot.date === command.date);
  if (slots.length !== 1) throw new Error('unknown_dated_meal_slot');
  const slot = slots[0];
  if (!('expectedSnapshot' in command) || !command.expectedSnapshot ||
      command.expectedSnapshot.snapshotRevision !== slot.snapshot.snapshotRevision ||
      command.expectedSnapshot.recipeRevision !== slot.snapshot.recipeRevision ||
      command.expectedSnapshot.portionRevision !== slot.snapshot.portionRevision) throw new Error('nutrition_snapshot_conflict');
  if (command.type === 'REPLACE') {
    if (command.date < today) throw new Error('past_plan_requires_history_contract');
    assertCandidateSnapshot(state, command.replacement);
    if (!command.replacement.recipeId || command.replacement.snapshotRevision === slot.snapshot.snapshotRevision ||
        command.replacement.portionRevision === slot.snapshot.portionRevision) throw new Error('replacement_requires_new_snapshot_revision');
    return { kind: 'plan-replacement', date: command.date, slotId: slot.slotId, before: clone(slot.snapshot), after: clone(command.replacement) };
  }
  if (command.type !== 'MEAL') throw new Error('unknown_nutrition_command');
  if (effectiveSimulatedDiary(state).some(({ effect }) => effect.kind === 'diary-snapshot' && effect.date === command.date && effect.slotId === command.slotId)) {
    throw new Error('meal_already_consumed_use_revision');
  }
  if (command.action === 'SKIPPED') {
    if ('actual' in command) throw new Error('skip_must_not_create_fact');
    if (effectiveSimulatedSkips(state).some(({ effect }) => effect.date === command.date && effect.slotId === command.slotId)) {
      throw new Error('meal_already_skipped');
    }
    return { kind: 'skip-annotation', date: command.date, slotId: command.slotId };
  }
  if (command.action === 'CONSUMED_AS_PLANNED') {
    if ('actual' in command) throw new Error('planned_action_must_use_exact_snapshot');
    return { kind: 'diary-snapshot', date: command.date, slotId: command.slotId, snapshot: clone(slot.snapshot), supersedes: null };
  }
  if (command.action !== 'CONSUMED_MODIFIED') throw new Error('unknown_meal_action');
  assertCandidateSnapshot(state, command.actual);
  return { kind: 'diary-snapshot', date: command.date, slotId: command.slotId, snapshot: clone(command.actual), supersedes: null };
}

export type NutritionSimulationAction =
  | { type: 'PROPOSE'; command: NutritionDomainCommand }
  | { type: 'PREVIEW' }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM'; idempotencyKey: string; previewFingerprint: string; explicitConfirmation: true };

/** Local state machine only. It has no transport, storage or authoritative revision generator. */
export function reduceNutritionSimulation(state: NutritionSimulationState, action: NutritionSimulationAction,
  current: { accountId: string; today: string }): NutritionSimulationState {
  assertContext(state.graph, current.accountId, current.today);
  if (state.mode !== 'local-simulation' || state.networkWritesEnabled !== false) throw new Error('invalid_simulation_mode');
  if (action.type === 'CANCEL') return { ...state, pending: null };
  if (action.type === 'PROPOSE') {
    if (nutritionRevisionKey(action.command.expected) !== nutritionRevisionKey(state.graph.context)) throw new Error('nutrition_revision_conflict');
    const fingerprint = nutritionCommandFingerprint(action.command);
    const replay = state.history.find((event) => event.eventId === action.command.idempotencyKey);
    if (replay) {
      if (replay.commandFingerprint !== fingerprint) throw new Error('idempotency_payload_conflict');
      return state;
    }
    const effect = previewEffect(state, action.command, current.today);
    return { ...state, pending: { stage: 'proposed', command: clone(action.command), fingerprint, effect } };
  }
  if (action.type === 'CONFIRM') {
    if (action.explicitConfirmation !== true) throw new Error('explicit_confirmation_required');
    const replay = state.history.find((event) => event.eventId === action.idempotencyKey);
    if (replay) {
      if (nutritionRevisionKey(replay.command.expected) !== nutritionRevisionKey(state.graph.context)) throw new Error('nutrition_revision_conflict');
      if (replay.commandFingerprint !== action.previewFingerprint) throw new Error('idempotency_payload_conflict');
      return state;
    }
  }
  const pending = state.pending;
  if (!pending) throw new Error('nutrition_proposal_missing');
  if (nutritionCommandFingerprint(pending.command) !== pending.fingerprint) throw new Error('changed_preview_requires_review');
  const effect = previewEffect(state, pending.command, current.today);
  if (nutritionCommandFingerprint(effect) !== nutritionCommandFingerprint(pending.effect)) throw new Error('changed_snapshot_requires_review');
  if (action.type === 'PREVIEW') return { ...state, pending: { ...pending, stage: 'previewed' } };
  if (action.type !== 'CONFIRM' || pending.stage !== 'previewed' || action.idempotencyKey !== pending.command.idempotencyKey ||
      action.previewFingerprint !== pending.fingerprint) throw new Error('reviewed_preview_required');
  const graph = clone(state.graph);
  if (effect.kind === 'plan-replacement') {
    const slot = graph.slots.find((item) => item.date === effect.date && item.slotId === effect.slotId)!;
    slot.snapshot = clone(effect.after);
  }
  return { ...state, graph, pending: null, localSequence: state.localSequence + 1,
    localPlanSequence: state.localPlanSequence + (effect.kind === 'plan-replacement' ? 1 : 0),
    history: [...state.history, { eventId: pending.command.idempotencyKey, commandFingerprint: pending.fingerprint,
      command: clone(pending.command), effect }] };
}

export function simulationShoppingRevision(state: NutritionSimulationState): string {
  return nutritionCommandFingerprint({ context: state.graph.context, localPlanSequence: state.localPlanSequence });
}

/** Revision-bound occurrences; pending proposals and diary history never become shopping input. */
export function getSimulationShoppingSelection(state: NutritionSimulationState,
  current: { accountId: string; today: string; expectedRevision: string }) {
  assertContext(state.graph, current.accountId, current.today);
  if (current.expectedRevision !== simulationShoppingRevision(state)) throw new Error('shopping_revision_conflict');
  return { mode: 'local-simulation' as const, networkWritesEnabled: false as const,
    revision: current.expectedRevision, slots: clone(state.graph.slots) };
}
