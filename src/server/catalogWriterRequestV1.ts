import { assertRawJsonWithoutDuplicateKeysV1 } from '../utils/adaptiveNutritionWireV1';
/** Pure typed request decoder. No mounted endpoint, normalization or authority generation.
 * Operational numeric(8,2) strings are NOT Phase1 evidence decimals. */
export interface CatalogFoodPayloadV1 {
  name: string; normalizedName: string; brand: string | null; normalizedBrand: string | null;
  calories: string; protein: string; fat: string; carbs: string; fiber: string;
}
export type PrivateFoodRequestV1 =
  | { contract: 'potok-private-food-request-v1'; kind: 'CREATE'; payload: CatalogFoodPayloadV1 }
  | { contract: 'potok-private-food-request-v1'; kind: 'UPDATE'; foodId: string; expectedDigest: string; payload: CatalogFoodPayloadV1 }
  | { contract: 'potok-private-food-request-v1'; kind: 'DELETE'; foodId: string; expectedDigest: string };
export interface CatalogBatchRequestV1 {
  contract: 'potok-catalog-batch-request-v1'; mode: 'INSERT' | 'UPSERT_ID' | 'UPSERT_NORMALIZED';
  rows: { foodId: string; foodStableId: string | null; source: 'core' | 'brand'; payload: CatalogFoodPayloadV1 }[];
}
function fail(): never { throw new Error('CATALOG_REQUEST_INVALID'); }
function object(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail();
  const r=v as Record<string,unknown>;
  if (Object.keys(r).length!==keys.length || keys.some(k=>!Object.prototype.hasOwnProperty.call(r,k))) fail();return r;
}
function text(v: unknown): string {
  if(typeof v!=='string'||!v.trim()||v.includes('\u0000')||new TextDecoder().decode(new TextEncoder().encode(v))!==v) fail();return v;
}
function nullable(v:unknown):string|null {
 if(v===null)return null;if(typeof v!=='string'||v.includes('\u0000')||new TextDecoder().decode(new TextEncoder().encode(v))!==v)fail();return v;
}
function match(v:unknown,re:RegExp):string {const s=text(v);if(!re.test(s))fail();return s;}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash=/^[a-f0-9]{64}$/;
function payload(v:unknown):CatalogFoodPayloadV1 {
  const r=object(v,['name','normalizedName','brand','normalizedBrand','calories','protein','fat','carbs','fiber']);
  const decimal=/^(0|[1-9][0-9]{0,5})\.[0-9]{2}$/;
  return {name:text(r.name),normalizedName:text(r.normalizedName),brand:nullable(r.brand),normalizedBrand:nullable(r.normalizedBrand),
    calories:match(r.calories,decimal),protein:match(r.protein,decimal),fat:match(r.fat,decimal),carbs:match(r.carbs,decimal),fiber:match(r.fiber,decimal)};
}
function raw(v:unknown):Record<string,unknown> {
  if(typeof v!=='string'||new TextEncoder().encode(v).length>1048576)fail();assertRawJsonWithoutDuplicateKeysV1(v);
  const p:unknown=JSON.parse(v);if(!p||typeof p!=='object'||Array.isArray(p))fail();return p as Record<string,unknown>;
}
export function decodePrivateFoodRequestRawV1(value:unknown):PrivateFoodRequestV1 {
  const r=raw(value);if(r.contract!=='potok-private-food-request-v1')fail();const contract=r.contract;
  if(r.kind==='CREATE'){object(r,['contract','kind','payload']);return {contract,kind:r.kind,payload:payload(r.payload)};}
  if(r.kind==='UPDATE'){object(r,['contract','kind','foodId','expectedDigest','payload']);return {contract,kind:r.kind,foodId:match(r.foodId,uuid),expectedDigest:match(r.expectedDigest,hash),payload:payload(r.payload)};}
  if(r.kind==='DELETE'){object(r,['contract','kind','foodId','expectedDigest']);return {contract,kind:r.kind,foodId:match(r.foodId,uuid),expectedDigest:match(r.expectedDigest,hash)};}return fail();
}
export function decodeCatalogBatchRequestRawV1(value:unknown):CatalogBatchRequestV1 {
  const r=object(raw(value),['contract','mode','rows']);
  if(r.contract!=='potok-catalog-batch-request-v1'||!['INSERT','UPSERT_ID','UPSERT_NORMALIZED'].includes(text(r.mode))||!Array.isArray(r.rows)||r.rows.length<1||r.rows.length>200)fail();
  const ids=new Set<string>(),keys=new Set<string>();
  const rows:CatalogBatchRequestV1['rows']=r.rows.map(v=>{const x=object(v,['foodId','foodStableId','source','payload']);const foodId=match(x.foodId,uuid),p=payload(x.payload);
    if(x.source!=='core'&&x.source!=='brand')fail();const key=JSON.stringify([p.normalizedName,p.normalizedBrand??'']);
    if(ids.has(foodId)||keys.has(key))fail();ids.add(foodId);keys.add(key);
    return {foodId,foodStableId:x.foodStableId===null?null:match(x.foodStableId,/^[a-z0-9][a-z0-9_-]{0,127}$/),source:x.source,payload:p};});
  return {contract:r.contract,mode:r.mode as CatalogBatchRequestV1['mode'],rows};
}
/** Job bookkeeping is not a durable receipt or proof of database authority. */
export type CatalogBatchOutcomeV1 =
  | { status:'COMMITTED'; rowsApplied:number }
  | { status:'ABORTED'; rollbackConfirmed:true }
  | { status:'UNKNOWN'; retryAllowed:false };
export function catalogBatchOutcomeV1(value:
  | { kind:'COMMIT_ACK'; rowsApplied:number }
  | { kind:'FAILURE'; rollbackConfirmed:boolean }):CatalogBatchOutcomeV1 {
  if(value.kind==='COMMIT_ACK') {
    if(!Number.isSafeInteger(value.rowsApplied)||value.rowsApplied<1||value.rowsApplied>200)fail();
    return {status:'COMMITTED',rowsApplied:value.rowsApplied};
  }
  return value.rollbackConfirmed?{status:'ABORTED',rollbackConfirmed:true}:{status:'UNKNOWN',retryAllowed:false};
}
/** Sequential pinned manifest runner, not a transport or durable receipt. Trusted
 * adapter reports commit acknowledgement / proven rollback; thrown errors are UNKNOWN.
 * No automatic retry, replacement IDs, partial-job success or next batch after UNKNOWN. */
export async function runCatalogImportJobV1(
  rawBatches:readonly string[],
  execute:(raw:string)=>Promise<CatalogBatchOutcomeV1>,
):Promise<{status:'COMPLETE'|'STOPPED_ABORTED'|'STOPPED_UNKNOWN';batches:{index:number;outcome:CatalogBatchOutcomeV1}[]}> {
  const requests=rawBatches.map(decodeCatalogBatchRequestRawV1);
  const batches:{index:number;outcome:CatalogBatchOutcomeV1}[]=[];
  for(let index=0;index<rawBatches.length;index++) {
    let outcome:CatalogBatchOutcomeV1;
    try {outcome=await execute(rawBatches[index]);}catch{outcome={status:'UNKNOWN',retryAllowed:false};}
    if(outcome.status==='COMMITTED'&&outcome.rowsApplied!==requests[index].rows.length)outcome={status:'UNKNOWN',retryAllowed:false};
    batches.push({index,outcome});
    if(outcome.status==='UNKNOWN')return {status:'STOPPED_UNKNOWN',batches};
    if(outcome.status==='ABORTED')return {status:'STOPPED_ABORTED',batches};
  }
  return {status:'COMPLETE',batches};
}
