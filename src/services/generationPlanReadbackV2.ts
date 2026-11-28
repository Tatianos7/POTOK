import {decodeAdaptiveNutritionGraphV2, adaptiveNutritionGraphSha256HexV2, type AdaptiveNutritionGraphV2} from '../utils/adaptiveNutritionGraphV2';

export const generationPlanReadbackContractV2 = 'potok-generation-plan-readback-v2';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha = /^[0-9a-f]{64}$/;
export interface GenerationPlanReadClientV2 {
  auth: {getUser(): Promise<{data: {user: {id: string} | null}; error: unknown}>};
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}>;
}
export interface GenerationPlanReadSessionV2 {readonly accountId: string; readonly generation: number}
export interface GenerationPlanReadModelV2 {
  readonly kind: 'ready';
  readonly requestOperationId: string;
  readonly accountId: string;
  readonly selectionId: string;
  readonly planRevision: string;
  readonly generationOperationId: string;
  readonly activationOperationId: string;
  readonly graphDigest: string;
  readonly graph: AdaptiveNutritionGraphV2;
}
export type GenerationPlanReadResultV2 = GenerationPlanReadModelV2
  | {kind: 'not_ready' | 'denied' | 'not_found' | 'unavailable' | 'invalid-request' | 'invalid-server-response' | 'session-stale'};
function exact(row: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(row).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(row,k));
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {for (const child of Object.values(value)) freeze(child); Object.freeze(value);}
  return value;
}
export async function decodeGenerationPlanReadbackV2(value: unknown, accountId: string, requestId: string): Promise<GenerationPlanReadResultV2> {
  // Own the complete transport snapshot before the first asynchronous digest check.
  const raw = JSON.stringify(value);
  if (typeof raw !== 'string' || raw.length > 8_000_000) throw new Error('INVALID_READBACK');
  const row: Record<string, unknown> = JSON.parse(raw);
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('INVALID_READBACK');
  if (['not_ready','denied','not_found','unavailable'].includes(row.kind as string) && exact(row,['kind'])) {
    return {kind: row.kind as 'not_ready' | 'denied' | 'not_found' | 'unavailable'};
  }
  if (!exact(row,['kind','contract','request_operation_id','account_id','selection_id','plan_revision',
    'generation_operation_id','activation_operation_id','graph_digest_hex','graph'])
    || row.kind !== 'ready' || row.contract !== generationPlanReadbackContractV2
    || row.account_id !== accountId || row.request_operation_id !== requestId
    || !uuid.test(accountId) || !uuid.test(requestId)
    || !['selection_id','plan_revision','generation_operation_id','activation_operation_id'].every(k => typeof row[k] === 'string' && uuid.test(row[k] as string))
    || typeof row.graph_digest_hex !== 'string' || !sha.test(row.graph_digest_hex)) throw new Error('INVALID_READBACK');
  const graph = await decodeAdaptiveNutritionGraphV2(row.graph);
  if (graph.selectionId !== row.selection_id || graph.planRevision !== row.plan_revision
    || await adaptiveNutritionGraphSha256HexV2(graph) !== row.graph_digest_hex) throw new Error('READBACK_GRAPH_MISMATCH');
  return freeze({kind:'ready',requestOperationId:requestId,accountId,selectionId:row.selection_id as string,
    planRevision:row.plan_revision as string,generationOperationId:row.generation_operation_id as string,
    activationOperationId:row.activation_operation_id as string,graphDigest:row.graph_digest_hex,graph});
}

/** Inactive until explicitly provided a client and read gate. No writer, retry, storage or V1 fallback. */
export class GenerationPlanReadbackServiceV2 {
  private generation = 0;
  private current: GenerationPlanReadSessionV2 | null = null;
  constructor(private readonly client: GenerationPlanReadClientV2 | null = null,
    private readonly enabled: () => boolean = () => false) {}
  beginSession(accountId: string): GenerationPlanReadSessionV2 {
    if (!uuid.test(accountId)) throw new Error('INVALID_READBACK_ACCOUNT');
    return this.current = Object.freeze({accountId,generation:++this.generation});
  }
  endSession(): void {this.current = null; this.generation++;}
  private async authenticated(session: GenerationPlanReadSessionV2): Promise<boolean> {
    if (!this.enabled() || !this.client || session !== this.current) return false;
    const {data,error} = await this.client.auth.getUser();
    return this.enabled() && session === this.current && !error && data.user?.id === session.accountId;
  }
  async read(session: GenerationPlanReadSessionV2, requestId: string): Promise<GenerationPlanReadResultV2> {
    const pinned = requestId;
    if (!this.enabled() || !this.client) return {kind:'unavailable'};
    if (typeof pinned !== 'string' || !uuid.test(pinned)) return {kind:'invalid-request'};
    try {
      if (!await this.authenticated(session) || session !== this.current || !this.enabled()) return {kind:'session-stale'};
      const {data,error} = await this.client.rpc('adaptive_nutrition_read_generation_plan_v2',{p_request_operation_id:pinned});
      let result: GenerationPlanReadResultV2;
      if (error) result = {kind:'unavailable'};
      else {try {result = await decodeGenerationPlanReadbackV2(data,session.accountId,pinned);}
        catch {result = {kind:'invalid-server-response'};}}
      if (!await this.authenticated(session) || session !== this.current || !this.enabled()) return {kind:'session-stale'};
      return result;
    } catch {return {kind:session === this.current && this.enabled() ? 'unavailable' : 'session-stale'};}
  }
}
