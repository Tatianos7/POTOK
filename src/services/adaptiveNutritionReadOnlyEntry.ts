import {
  adaptiveNutritionReadOnlyService,
  isAdaptiveNutritionReadEnabled,
  type AdaptiveNutritionDiscoveryResult,
  type AdaptiveNutritionReadOnlyService,
  type AdaptiveNutritionReadSession,
} from './adaptiveNutritionReadOnlyService';
import {
  adaptiveNutritionTodaySlots,
  type AdaptiveNutritionTodaySlot,
} from './adaptiveNutritionTodayRuntime';
import type { AdaptiveNutritionReadModelV1 } from './adaptiveNutritionPersistenceService';
export function shouldUseAdaptiveNutritionReadOnlyEntry(
  verifiedPremium: boolean | undefined,
  readGateEnabled = isAdaptiveNutritionReadEnabled(),
): boolean {
  return verifiedPremium === true && readGateEnabled;
}

export type AdaptiveNutritionReadOnlyEntryPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'no_active_plan'
  | 'ambiguous'
  | 'denied'
  | 'unavailable';

export interface AdaptiveNutritionReadOnlyEntryState {
  phase: AdaptiveNutritionReadOnlyEntryPhase;
  accountId: string | null;
  today: string | null;
  timeZone: string | null;
  selectionId: string | null;
  model: AdaptiveNutritionReadModelV1 | null;
  slots: AdaptiveNutritionTodaySlot[];
}

type ReadOnlyTransport = Pick<AdaptiveNutritionReadOnlyService,
  'beginSession' | 'endSession' | 'discoverCurrent' | 'readCurrent'>;
type Listener = (state: AdaptiveNutritionReadOnlyEntryState) => void;

function initialState(): AdaptiveNutritionReadOnlyEntryState {
  return {
    phase: 'idle', accountId: null, today: null, timeZone: null,
    selectionId: null, model: null, slots: [],
  };
}

function terminalPhase(result: Exclude<AdaptiveNutritionDiscoveryResult, { kind: 'ready' }>): AdaptiveNutritionReadOnlyEntryPhase {
  if (result.kind === 'no_active_plan') return 'no_active_plan';
  if (result.kind === 'ambiguous') return 'ambiguous';
  if (result.kind === 'denied') return 'denied';
  return 'unavailable';
}

export class AdaptiveNutritionReadOnlyEntryController {
  private state = initialState();
  private generation = 0;
  private session: AdaptiveNutritionReadSession | null = null;
  private listeners = new Set<Listener>();

  constructor(private readonly transport: ReadOnlyTransport = adaptiveNutritionReadOnlyService) {}

  snapshot(): AdaptiveNutritionReadOnlyEntryState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private publish(next: AdaptiveNutritionReadOnlyEntryState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }

  async start(accountId: string, today: string, timeZone: string): Promise<void> {
    const token = ++this.generation;
    if (this.session) this.transport.endSession();
    let session: AdaptiveNutritionReadSession;
    try {
      session = this.transport.beginSession(accountId);
    } catch {
      this.session = null;
      this.publish({ ...initialState(), phase: 'unavailable' });
      return;
    }
    this.session = session;
    this.publish({
      ...initialState(), phase: 'loading', accountId, today, timeZone,
    });

    const discovery = await this.transport.discoverCurrent(session, timeZone);
    if (token !== this.generation || this.session !== session) return;
    if (discovery.kind !== 'ready') {
      this.publish({
        ...this.state, phase: terminalPhase(discovery), selectionId: null, model: null, slots: [],
      });
      return;
    }

    const read = await this.transport.readCurrent(session, discovery.selectionId);
    if (token !== this.generation || this.session !== session) return;
    if (read.kind !== 'ready') {
      const phase = read.kind === 'denied' ? 'denied' : 'unavailable';
      this.publish({ ...this.state, phase, selectionId: discovery.selectionId, model: null, slots: [] });
      return;
    }
    const slots = adaptiveNutritionTodaySlots(read, today);
    if (!slots || read.selectionId !== discovery.selectionId
        || read.weekAnchor !== discovery.weekAnchor || read.timeZone !== discovery.timeZone
        || read.status !== 'active') {
      this.publish({ ...this.state, phase: 'unavailable', selectionId: discovery.selectionId, model: null, slots: [] });
      return;
    }
    this.publish({
      phase: 'ready', accountId, today, timeZone,
      selectionId: discovery.selectionId, model: read, slots,
    });
  }

  stop(): void {
    this.generation += 1;
    if (this.session) this.transport.endSession();
    this.session = null;
    this.publish(initialState());
  }
}
