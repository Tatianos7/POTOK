import {supabase} from '../lib/supabaseClient';
import {isStagingGenerationProbeEnabled} from './stagingGenerationProbe';

/** Bound readback of an actual persistent server operation, never synthetic data.
 * The RLS/SECURITY DEFINER RPCs enforce auth.uid() and verified premium in SQL.
 * This module contains no write path and does not expose plan graph data.
 */
export const generationRequestIdPatternV2=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states=['REQUESTED','GENERATING','GENERATED','ACTIVATING','ACTIVE','REJECTED','CONFLICT','UNKNOWN_RETRYABLE'] as const;
export type ServerGenerationStateV2=typeof states[number];
export type GenerationReadbackV2=
  | {kind:'status';status:Exclude<ServerGenerationStateV2,'ACTIVE'>;reasonCode:string|null;requestOperationId:string}
  | {kind:'active';status:'ACTIVE';requestOperationId:string;selectionId:string;planRevision:string;graphDigest:string}
  | {kind:'not-ready'|'denied'|'unavailable'|'invalid-input'|'session-mismatch'|'server-error';message:string};

type Obj=Record<string,unknown>;
const obj=(x:unknown):x is Obj=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function exact(x:unknown,keys:readonly string[]):x is Obj {
  return obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
}
export function decodeGenerationStatusForReadbackV2(x:unknown,requestId:string) {
  if(!exact(x,['contract','requestOperationId','status','retryable','reasonCode'])||
    x.contract!=='potok-adaptive-generation-request-status-v2'||
    x.requestOperationId!==requestId||
    !states.includes(x.status as ServerGenerationStateV2)||
    typeof x.retryable!=='boolean'||
    !(x.reasonCode===null||typeof x.reasonCode==='string'))return null;
  return {status:x.status as ServerGenerationStateV2,reasonCode:x.reasonCode as string|null};
}
export function decodeActiveGenerationReadbackV2(x:unknown,requestId:string) {
  if(!exact(x,['kind','contract','request_operation_id','account_id','selection_id',
    'plan_revision','generation_operation_id','activation_operation_id','graph_digest_hex','graph'])||
    x.kind!=='ready'||x.contract!=='potok-generation-plan-readback-v2'||x.request_operation_id!==requestId||
    typeof x.selection_id!=='string'||!generationRequestIdPatternV2.test(x.selection_id)||
    typeof x.plan_revision!=='string'||!generationRequestIdPatternV2.test(x.plan_revision)||
    typeof x.graph_digest_hex!=='string'||!/^[a-f0-9]{64}$/.test(x.graph_digest_hex)||
    !obj(x.graph))return null;
  return {selectionId:x.selection_id,planRevision:x.plan_revision,graphDigest:x.graph_digest_hex};
}

export async function readOwnGenerationOperationV2(userId:string,rawId:string):Promise<GenerationReadbackV2> {
  const requestId=rawId.trim().toLowerCase();
  if(!generationRequestIdPatternV2.test(requestId))return {kind:'invalid-input',message:'Введите корректный UUID операции генерации.'};
  if(!isStagingGenerationProbeEnabled()||!supabase)return {kind:'unavailable',message:'Чтение доступно только в POTOK Staging.'};
  try {
    const user=await supabase.auth.getUser();
    if(user.error||user.data.user?.id!==userId)return {kind:'session-mismatch',message:'Сессия тестового аккаунта не подтверждена.'};
    const status=await supabase.rpc('adaptive_nutrition_generation_status_v2',{p_request_operation_id:requestId});
    if(status.error||status.data===null)return {kind:'unavailable',message:'Операция не найдена или недоступна этому аккаунту.'};
    const decoded=decodeGenerationStatusForReadbackV2(status.data,requestId);
    if(!decoded)return {kind:'server-error',message:'Неожиданный формат серверного статуса.'};
    if(decoded.status!=='ACTIVE')return {kind:'status',status:decoded.status,reasonCode:decoded.reasonCode,requestOperationId:requestId};
    const read=await supabase.rpc('adaptive_nutrition_read_generation_plan_v2',{p_request_operation_id:requestId});
    if(read.error||!obj(read.data))return {kind:'server-error',message:'Не удалось подтвердить сохранённый план.'};
    if(read.data.kind==='denied')return {kind:'denied',message:'Для чтения сохранённого плана требуется подтверждённый Premium.'};
    if(read.data.kind==='not_ready'||read.data.kind==='not_found')return {kind:'not-ready',message:'План ещё не подготовлен.'};
    if(read.data.kind!=='ready')return {kind:'unavailable',message:'Сервер не подтвердил сохранённый план.'};
    if(read.data.account_id!==userId)return {kind:'server-error',message:'Сервер вернул план другой учётной записи.'};
    const active=decodeActiveGenerationReadbackV2(read.data,requestId);
    if(!active)return {kind:'server-error',message:'Сохранённый план не прошёл проверку контракта.'};
    return {kind:'active',status:'ACTIVE',requestOperationId:requestId,
      selectionId:active.selectionId,planRevision:active.planRevision,graphDigest:active.graphDigest};
  }catch{return {kind:'server-error',message:'Не удалось прочитать серверное состояние.'};}
}
