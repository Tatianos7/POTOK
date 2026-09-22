import {
  adaptiveNutritionPersistenceService,
  type AdaptiveNutritionMutationResult,
  type AdaptiveNutritionPersistenceService,
  type AdaptiveNutritionReadModelV1,
  type AdaptiveNutritionReadResult,
  type AdaptiveNutritionReceiptV1,
  type AdaptiveNutritionRuntimeSession,
} from './adaptiveNutritionPersistenceService';
import { adaptiveNutritionProtocolV1, type AdaptiveNutritionWireSnapshotV1 } from '../utils/adaptiveNutritionWireV1';
import { nutritionWeekDates } from '../utils/nutritionWeek';

export type AdaptiveNutritionTodayPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'unknown'
  | 'conflict'
  | 'denied'
  | 'unavailable';

export interface AdaptiveNutritionTodaySlot {
  date: string;
  slotId: string;
  snapshot: AdaptiveNutritionWireSnapshotV1;
}

export interface PendingRuntimeOperation {
  rawRequest: string;
  idempotencyKey: string;
}

interface AccountRecoveryOperation extends PendingRuntimeOperation {
  selectionId: string;
  today: string;
}

const unresolvedByAccount = new Map<string, AccountRecoveryOperation>();

export interface AdaptiveNutritionTodayState {
  phase: AdaptiveNutritionTodayPhase;
  accountId: string | null;
  selectionId: string | null;
  today: string | null;
  model: AdaptiveNutritionReadModelV1 | null;
  slots: AdaptiveNutritionTodaySlot[];
  pending: PendingRuntimeOperation | null;
  notice: 'confirmed' | null;
}

type RuntimeTransport = Pick<AdaptiveNutritionPersistenceService,
  'beginSession' | 'endSession' | 'readCurrent' | 'readExact' | 'lookup' | 'mutate'>;
type RuntimeListener = (state: AdaptiveNutritionTodayState) => void;
type RuntimeAction =
  | { type: 'SKIPPED'; slotId: string }
  | { type: 'UNDO_ANNOTATION'; targetEventId: string }
  | { type: 'REPLACE'; slotId: string; replacementOfferId: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readSnapshot(value: unknown): AdaptiveNutritionWireSnapshotV1 | null {
  const row = record(value);
  if (!row || typeof row.snapshotRevision !== 'string' || !uuidPattern.test(row.snapshotRevision)
      || typeof row.portionRevision !== 'string' || !uuidPattern.test(row.portionRevision)
      || (row.recipeRevision !== null
        && (typeof row.recipeRevision !== 'string' || !uuidPattern.test(row.recipeRevision)))) return null;
  return { snapshotRevision: row.snapshotRevision, recipeRevision: row.recipeRevision as string | null,
    portionRevision: row.portionRevision };
}

export function adaptiveNutritionTodaySlots(
  model: AdaptiveNutritionReadModelV1,
  today: string,
): AdaptiveNutritionTodaySlot[] | null {
  if (model.status !== 'active' || model.weekAnchor !== nutritionWeekDates(today)[0]) return null;
  const graph = record(model.graph.graph_snapshot);
  if (!graph || !Array.isArray(graph.days) || graph.days.length !== 7) return null;
  const expectedDates = nutritionWeekDates(today);
  const slots: AdaptiveNutritionTodaySlot[] = [];
  const ids = new Set<string>();
  for (const [index, value] of graph.days.entries()) {
    const day = record(value);
    if (!day || day.date !== expectedDates[index] || !Array.isArray(day.slots)) return null;
    for (const valueSlot of day.slots) {
      const slot = record(valueSlot);
      const snapshot = slot ? readSnapshot(slot.snapshot) : null;
      if (!slot || typeof slot.slotId !== 'string' || !uuidPattern.test(slot.slotId)
          || ids.has(slot.slotId) || !snapshot) return null;
      ids.add(slot.slotId);
      slots.push({ date: day.date as string, slotId: slot.slotId, snapshot });
    }
  }
  return slots;
}

export function activeAdaptiveNutritionAnnotations(model: AdaptiveNutritionReadModelV1): Array<{
  eventId: string; slotId: string; date: string;
}> {
  const events = model.events.map(record).filter((event): event is Record<string, unknown> => Boolean(event));
  const superseded = new Set(events.map((event) => event.supersedes_event_id)
    .filter((value): value is string => typeof value === 'string'));
  return events.flatMap((event) => event.kind === 'ANNOTATION'
      && typeof event.event_id === 'string' && uuidPattern.test(event.event_id)
      && typeof event.slot_id === 'string' && uuidPattern.test(event.slot_id)
      && typeof event.local_date === 'string' && !superseded.has(event.event_id)
    ? [{ eventId: event.event_id, slotId: event.slot_id, date: event.local_date }]
    : []);
}

function initialState(): AdaptiveNutritionTodayState {
  return { phase: 'idle', accountId: null, selectionId: null, today: null,
    model: null, slots: [], pending: null, notice: null };
}

export class AdaptiveNutritionTodayRuntimeController {
  private state = initialState();
  private generation = 0;
  private session: AdaptiveNutritionRuntimeSession | null = null;
  private listeners = new Set<RuntimeListener>();

  constructor(
    private readonly transport: RuntimeTransport = adaptiveNutritionPersistenceService,
    private readonly idempotencyKey: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  snapshot(): AdaptiveNutritionTodayState {
    return structuredClone(this.state);
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private publish(next: AdaptiveNutritionTodayState): void {
    this.state = next;
    for (const listener of this.listeners) listener(this.snapshot());
  }

  private current(token: number): boolean {
    return token === this.generation;
  }

  async start(accountId: string, selectionId: string, today: string): Promise<void> {
    const token = ++this.generation;
    let session: AdaptiveNutritionRuntimeSession;
    try {
      session = this.transport.beginSession(accountId);
    } catch {
      this.publish({ ...initialState(), phase: 'unavailable', accountId, selectionId, today });
      return;
    }
    this.session = session;
    const unresolved = unresolvedByAccount.get(accountId);
    if (unresolved) {
      this.publish({ ...initialState(), phase: 'unknown', accountId,
        selectionId: unresolved.selectionId, today: unresolved.today,
        pending: { rawRequest: unresolved.rawRequest, idempotencyKey: unresolved.idempotencyKey } });
      return;
    }
    this.publish({ ...initialState(), phase: 'loading', accountId, selectionId, today });
    const result = await this.transport.readCurrent(session, selectionId);
    if (!this.current(token)) return;
    this.applyReadResult(result, false);
  }

  stop(): void {
    this.generation += 1;
    this.session = null;
    this.transport.endSession();
    this.publish(initialState());
  }

  acknowledgeConflict(): void {
    if (this.state.phase === 'conflict' && this.state.model) {
      this.publish({ ...this.state, phase: 'ready', notice: null });
    }
  }

  async skip(slotId: string): Promise<void> {
    await this.submit({ type: 'SKIPPED', slotId });
  }

  async undoAnnotation(targetEventId: string): Promise<void> {
    await this.submit({ type: 'UNDO_ANNOTATION', targetEventId });
  }

  async replace(slotId: string, replacementOfferId: string | null | undefined): Promise<void> {
    if (!replacementOfferId || !uuidPattern.test(replacementOfferId)) return;
    await this.submit({ type: 'REPLACE', slotId, replacementOfferId });
  }

  async resolveUnknown(): Promise<void> {
    const token = this.generation;
    const session = this.session;
    const pending = this.state.pending;
    if (!session || !pending || this.state.phase !== 'unknown') return;
    const result = await this.transport.lookup(session, pending.idempotencyKey);
    if (!this.current(token)) return;
    if (result.kind === 'settled') {
      if (result.outcome === 'accepted') await this.reconcileReceipt(token, result);
      else {
        this.clearUnresolved();
        await this.refreshConflict(token);
      }
    }
    else if (result.kind === 'conflict') await this.refreshConflict(token);
    else if (result.kind === 'denied') this.publish({ ...this.state, phase: 'denied' });
  }

  private applyReadResult(result: AdaptiveNutritionReadResult, keepConflict: boolean): void {
    if (result.kind === 'ready' && this.state.today) {
      const slots = adaptiveNutritionTodaySlots(result, this.state.today);
      if (slots) {
        this.publish({ ...this.state, phase: keepConflict ? 'conflict' : 'ready', model: result,
          slots, pending: null, notice: keepConflict ? null : this.state.notice });
        return;
      }
    }
    const phase: AdaptiveNutritionTodayPhase = result.kind === 'denied' ? 'denied'
      : result.kind === 'conflict' || result.kind === 'invalid-server-response' ? 'conflict'
        : result.kind === 'unknown' || result.kind === 'session-stale' ? 'unknown' : 'unavailable';
    this.publish({ ...this.state, phase, model: null, slots: [], notice: null });
  }

  private async submit(action: RuntimeAction): Promise<void> {
    const token = this.generation;
    const session = this.session;
    const model = this.state.model;
    if (!session || !model || this.state.phase !== 'ready' || this.state.pending) return;
    let wireAction: Record<string, unknown>;
    if (action.type === 'UNDO_ANNOTATION') {
      if (!activeAdaptiveNutritionAnnotations(model).some((item) => item.eventId === action.targetEventId)) return;
      wireAction = { type: action.type, targetEventId: action.targetEventId };
    } else {
      const slot = this.state.slots.find((item) => item.slotId === action.slotId);
      if (!slot) return;
      wireAction = action.type === 'REPLACE'
        ? { type: action.type, slot, replacementOfferId: action.replacementOfferId }
        : { type: action.type, slot };
    }
    const key = this.idempotencyKey();
    if (!uuidPattern.test(key)) {
      this.publish({ ...this.state, phase: 'unavailable' });
      return;
    }
    const rawRequest = JSON.stringify({
      contract: adaptiveNutritionProtocolV1,
      expected: { accountId: this.state.accountId, planId: model.selectionId,
        planRevision: model.planRevision, goalRevision: model.goalRevision,
        historyRevision: model.historyRevision, diaryRevision: model.diaryRevision,
        weekAnchor: model.weekAnchor, timeZone: model.timeZone },
      idempotencyKey: key,
      explicitConfirmation: true,
      action: wireAction,
    });
    this.publish({ ...this.state, phase: 'submitting', pending: { rawRequest, idempotencyKey: key }, notice: null });
    const result = await this.transport.mutate(session, rawRequest);
    if (!this.current(token)) return;
    await this.applyMutationResult(token, result);
  }

  private async applyMutationResult(token: number, result: AdaptiveNutritionMutationResult): Promise<void> {
    if (result.kind === 'settled') {
      if (result.outcome === 'accepted') await this.reconcileReceipt(token, result);
      else await this.refreshConflict(token);
      return;
    }
    if (result.kind === 'unknown' || result.kind === 'unavailable') {
      const pending = this.state.pending;
      if (pending && this.state.accountId && this.state.selectionId && this.state.today) {
        unresolvedByAccount.set(this.state.accountId, { ...pending,
          selectionId: this.state.selectionId, today: this.state.today });
      }
      this.publish({ ...this.state, phase: 'unknown' });
    } else if (result.kind === 'conflict') {
      await this.refreshConflict(token);
    } else if (result.kind === 'denied') {
      this.publish({ ...this.state, phase: 'denied', pending: null });
    } else if (result.kind !== 'session-stale') {
      this.publish({ ...this.state, phase: 'conflict', pending: null, model: null, slots: [] });
    }
  }

  private async reconcileReceipt(token: number, receipt: AdaptiveNutritionReceiptV1): Promise<void> {
    const session = this.session;
    const selectionId = this.state.selectionId;
    if (!session || !selectionId) return;
    const read = await this.transport.readExact(session, selectionId, receipt);
    if (!this.current(token)) return;
    if (read.kind === 'ready' && this.state.today) {
      const slots = adaptiveNutritionTodaySlots(read, this.state.today);
      if (slots) {
        this.clearUnresolved();
        this.publish({ ...this.state, phase: 'ready', model: read, slots,
          pending: null, notice: 'confirmed' });
        return;
      }
    }
    this.applyReadResult(read, false);
  }

  private async refreshConflict(token: number): Promise<void> {
    const session = this.session;
    const selectionId = this.state.selectionId;
    if (!session || !selectionId) return;
    this.publish({ ...this.state, phase: 'loading', pending: null, notice: null });
    const read = await this.transport.readCurrent(session, selectionId);
    if (!this.current(token)) return;
    this.applyReadResult(read, true);
  }

  private clearUnresolved(): void {
    if (this.state.accountId) unresolvedByAccount.delete(this.state.accountId);
  }
}
