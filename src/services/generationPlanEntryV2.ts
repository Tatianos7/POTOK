import {GenerationPlanReadbackServiceV2, type GenerationPlanReadModelV2, type GenerationPlanReadSessionV2} from './generationPlanReadbackV2';
import type {AdaptiveNutritionGraphSlotV2} from '../utils/adaptiveNutritionGraphV2';

export interface GenerationPlanEntryStateV2 {
  readonly phase: 'idle' | 'loading' | 'pending' | 'ready' | 'denied' | 'unavailable';
  readonly model: GenerationPlanReadModelV2 | null;
  readonly slots: readonly AdaptiveNutritionGraphSlotV2[];
}
type Transport = Pick<GenerationPlanReadbackServiceV2,'beginSession' | 'endSession' | 'read'>;
const empty = (phase: GenerationPlanEntryStateV2['phase']): GenerationPlanEntryStateV2 => Object.freeze({phase,model:null,slots:Object.freeze([])});
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
/** Separate Graph V2 opening controller; never translates a V2 graph into the V1 mutation runtime. */
export class GenerationPlanEntryControllerV2 {
  private state = empty('idle');
  private token = 0;
  private session: GenerationPlanReadSessionV2 | null = null;
  private listeners = new Set<(value: GenerationPlanEntryStateV2) => void>();
  constructor(private readonly transport: Transport = new GenerationPlanReadbackServiceV2()) {}
  snapshot(): GenerationPlanEntryStateV2 {return this.state;}
  subscribe(listener: (state: GenerationPlanEntryStateV2) => void): () => void {
    this.listeners.add(listener); listener(this.state); return () => {this.listeners.delete(listener);};
  }
  private publish(state: GenerationPlanEntryStateV2): void {this.state = state; this.listeners.forEach(l => l(state));}
  async open(accountId: string, requestId: string, today: string, timeZone: string): Promise<void> {
    const token = ++this.token;
    if (this.session) this.transport.endSession();
    this.session = null;
    this.publish(empty('loading'));
    try {
      if (!validDate(today) || !timeZone || timeZone.trim() !== timeZone) throw new Error('INVALID_READBACK_DATE');
      new Intl.DateTimeFormat('en-US',{timeZone}).format(new Date(0));
      const session = this.session = this.transport.beginSession(accountId);
      const result = await this.transport.read(session,requestId);
      if (token !== this.token || this.session !== session) return;
      if (result.kind !== 'ready') {
        this.publish(empty(result.kind === 'not_ready' ? 'pending' : result.kind === 'denied' ? 'denied' : 'unavailable')); return;
      }
      // Bind the response again at the presentation boundary, including the requested local day.
      const day = result.graph.days.find(d => d.date === today);
      if (result.accountId !== accountId || result.requestOperationId !== requestId
        || result.graph.timezone !== timeZone || !day) throw new Error('ENTRY_READBACK_MISMATCH');
      this.publish(Object.freeze({phase:'ready',model:result,slots:Object.freeze([...day.slots])}));
    } catch {if (token === this.token) this.publish(empty('unavailable'));}
  }
  stop(): void {
    this.token++; if (this.session) this.transport.endSession(); this.session = null; this.publish(empty('idle'));
  }
}
