import {decodeGenerationResponseV2, generationRequestProtocolV2, type GenerationRequestResponseV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {GenerationPlanReadbackServiceV2,type GenerationPlanReadClientV2} from './generationPlanReadbackV2';
import {GenerationPlanEntryControllerV2,type GenerationPlanEntryStateV2} from './generationPlanEntryV2';

export type GenerationFlowPhaseV2 = 'idle' | 'requesting' | 'pending' | 'checking' | 'opening'
  | 'ready' | 'unknown' | 'rejected' | 'conflict' | 'denied' | 'unavailable';
export interface GenerationFlowStateV2 {
  readonly phase: GenerationFlowPhaseV2;
  readonly requestOperationId: string | null;
  readonly entry: GenerationPlanEntryStateV2;
}
interface Scope {accountId:string;today:string;timeZone:string}
interface Attempt extends Scope {readonly idempotencyKey:string;readonly requestOperationId:string|null}
export interface GenerationRecoveryV2 extends Attempt {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const emptyEntry = (): GenerationPlanEntryStateV2 => Object.freeze({phase:'idle',model:null,slots:Object.freeze([])});
function validScope(scope:Scope):boolean {
  if (!uuid.test(scope.accountId) || !/^\d{4}-\d{2}-\d{2}$/.test(scope.today)
    || !scope.timeZone || scope.timeZone !== scope.timeZone.trim()) return false;
  try {
    if (new Date(scope.today+'T00:00:00Z').toISOString().slice(0,10) !== scope.today) return false;
    new Intl.DateTimeFormat('en-US',{timeZone:scope.timeZone}).format(new Date(0));return true;
  } catch {return false;}
}
const sameScope = (a:Scope,b:Scope):boolean => a.accountId===b.accountId && a.today===b.today && a.timeZone===b.timeZone;

/** Explicit user action only. No timers, privileged worker client, disk cache or automatic generation on mount. */
export class GenerationRequestFlowV2 {
  private epoch = 0;
  private busy = false;
  private scope: Readonly<Scope> | null = null;
  // Retain uncertain request identity across stop/account switches within this controller.
  private attempts = new Map<string,Readonly<Attempt>>();
  private settled = new Set<string>();
  private entry: GenerationPlanEntryControllerV2;
  private state: GenerationFlowStateV2 = Object.freeze({phase:'idle',requestOperationId:null,entry:emptyEntry()});
  private listeners = new Set<(state:GenerationFlowStateV2)=>void>();
  constructor(private readonly client:GenerationPlanReadClientV2|null = null,
    private readonly enabled:()=>boolean = ()=>false,
    private readonly newKey:()=>string = ()=>globalThis.crypto.randomUUID()) {
    this.entry = new GenerationPlanEntryControllerV2(new GenerationPlanReadbackServiceV2(client,enabled));
  }
  snapshot():GenerationFlowStateV2 {return this.state;}
  subscribe(listener:(state:GenerationFlowStateV2)=>void):()=>void {
    this.listeners.add(listener);listener(this.state);return ()=>{this.listeners.delete(listener);};
  }
  private publish(phase:GenerationFlowPhaseV2,requestOperationId:string|null=null,entry:GenerationPlanEntryStateV2=emptyEntry()):void {
    this.state=Object.freeze({phase,requestOperationId,entry});this.listeners.forEach(l=>l(this.state));
  }
  attach(accountId:string,today:string,timeZone:string):void {
    this.stop();
    const scope=Object.freeze({accountId,today,timeZone});
    if (!validScope(scope)) {this.publish('unavailable');return;}
    this.scope=scope;
    let attempt=this.attempts.get(accountId);
    if (attempt && !sameScope(attempt,scope)) {
      const identity=accountId+':'+attempt.idempotencyKey;
      if(!this.settled.has(identity)) {this.publish('unavailable');return;}
      this.attempts.delete(accountId);this.settled.delete(identity);attempt=undefined;
    }
    this.publish(this.enabled()&&this.client ? attempt ? 'unknown' : 'idle' : 'unavailable',attempt?.requestOperationId??null);
  }
  /** Caller may explicitly retain this non-secret handle; no implicit persistence is installed here. */
  recovery():Readonly<GenerationRecoveryV2>|null {
    const attempt=this.scope ? this.attempts.get(this.scope.accountId) : null;
    return attempt ? Object.freeze({...attempt}) : null;
  }
  restore(handle:GenerationRecoveryV2):void {
    // Own primitive fields before touching controller state; handle cannot replace an unresolved attempt.
    const saved=Object.freeze({accountId:handle.accountId,today:handle.today,timeZone:handle.timeZone,
      idempotencyKey:handle.idempotencyKey,requestOperationId:handle.requestOperationId});
    if (!validScope(saved)||!uuid.test(saved.idempotencyKey)||(saved.requestOperationId!==null&&!uuid.test(saved.requestOperationId))) throw new Error('INVALID_GENERATION_RECOVERY');
    const existing=this.attempts.get(saved.accountId);
    if (existing && (existing.idempotencyKey!==saved.idempotencyKey || !sameScope(existing,saved)
      || existing.requestOperationId!==saved.requestOperationId)) throw new Error('GENERATION_RECOVERY_CONFLICT');
    this.attempts.set(saved.accountId,saved);this.attach(saved.accountId,saved.today,saved.timeZone);
  }
  stop():void {this.epoch++;this.busy=false;this.scope=null;this.entry.stop();this.publish('idle');}
  private current(token:number,scope:Scope):boolean {return token===this.epoch && this.scope===scope && this.enabled() && this.client!==null;}
  private async authenticated(token:number,scope:Scope):Promise<boolean> {
    if (!this.current(token,scope) || !this.client) return false;
    const {data,error}=await this.client.auth.getUser();
    return this.current(token,scope)&&!error&&data.user?.id===scope.accountId;
  }
  async start():Promise<void> {return this.advance(true);}
  async refresh():Promise<void> {return this.advance(false);}
  private async advance(create:boolean):Promise<void> {
    if (this.busy) return;
    const scope=this.scope,token=this.epoch;
    if (!scope || !this.current(token,scope)||!this.client) {this.publish('unavailable');return;}
    let attempt=this.attempts.get(scope.accountId);
    if (attempt && !sameScope(attempt,scope)) {this.publish('unavailable');return;}
    if (!attempt && !create) {this.publish('unavailable');return;}
    this.busy=true;
    try {
      if (!await this.authenticated(token,scope)||!this.current(token,scope)) {
        if(token===this.epoch)this.publish('denied');return;
      }
      if (!attempt) {
        const key=this.newKey();if(!uuid.test(key))throw new Error('INVALID_GENERATION_KEY');
        attempt=Object.freeze({...scope,idempotencyKey:key,requestOperationId:null});
        this.attempts.set(scope.accountId,attempt);
      }
      const pinned=attempt;
      this.publish(pinned.requestOperationId ? 'checking' : 'requesting',pinned.requestOperationId);
      // An uncertain initial request is replayed only on explicit action, with the original key.
      // A known request always uses status lookup and never calls the request endpoint again.
      const {data,error}=await this.client.rpc(pinned.requestOperationId
        ? 'adaptive_nutrition_generation_status_v2' : 'adaptive_nutrition_request_generation_v2',
        pinned.requestOperationId ? {p_request_operation_id:pinned.requestOperationId}
          : {p_protocol_version:generationRequestProtocolV2,p_idempotency_key:pinned.idempotencyKey});
      const status:GenerationRequestResponseV2|null=error?null:decodeGenerationResponseV2(data);
      if (!await this.authenticated(token,scope)||!this.current(token,scope)) {
        if(token===this.epoch)this.publish('denied');return;
      }
      if(!status)throw new Error('GENERATION_REQUEST_UNKNOWN');
      if(pinned.requestOperationId && status.requestOperationId!==pinned.requestOperationId)throw new Error('GENERATION_REQUEST_MISMATCH');
      const terminal=['ACTIVE','REJECTED','CONFLICT'].includes(status.status);
      if(status.retryable===terminal)throw new Error('GENERATION_STATUS_MISMATCH');
      attempt=Object.freeze({...pinned,requestOperationId:status.requestOperationId});
      this.attempts.set(scope.accountId,attempt);
      if(terminal)this.settled.add(scope.accountId+':'+attempt.idempotencyKey);
      if(status.status==='REJECTED'||status.status==='CONFLICT') {
        this.publish(status.status==='REJECTED'?'rejected':'conflict',status.requestOperationId);return;
      }
      if(status.status!=='ACTIVE') {this.publish('pending',status.requestOperationId);return;}
      this.publish('opening',status.requestOperationId);
      await this.entry.open(scope.accountId,status.requestOperationId,scope.today,scope.timeZone);
      if(!await this.authenticated(token,scope)||!this.current(token,scope)) {
        if(token===this.epoch)this.publish('denied');return;
      }
      const entry=this.entry.snapshot();
      if(entry.phase==='ready')this.publish('ready',status.requestOperationId,entry);
      else this.publish(entry.phase==='denied'?'denied':entry.phase==='pending'?'pending':'unavailable',status.requestOperationId);
    } catch {
      if(token===this.epoch) {
        const saved=this.attempts.get(scope.accountId);
        this.publish(saved?'unknown':'unavailable',saved?.requestOperationId??null);
      }
    } finally {if(token===this.epoch)this.busy=false;}
  }
}
