/** Fixed private source readers. Retention integrity never establishes review/publication authority. */
import {adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {decodeTrustedGenerationInputRawV1,trustedGenerationInputDigestV1} from '../utils/adaptiveNutritionGraphV2';
import {parseExactValidationJsonRawV3 as parse} from './exactWeekNutritionValidationV3';
import {exactPlanAdmissionSourceContractV3} from './exactPlanAdmissionV3';
import {exactPlanCurrentSqlV3,type ExactPlanSqlSourceClientV3} from './exactPlanPostgresV3';
import {createExactWeekOptimizationV3} from './exactWeekOptimizationV3';
import {createExactWeekMetricProducerV3} from './exactWeekMetricProducerV3';
import type {ExactTypedRecipeAuthorityV3} from './exactTypedRecipePreparationV3';
type Kind='POOL'|'GRAPH'|'METRIC_POLICY'|'CONVENIENCE'|'TITLES';
const statement=(kind:Kind,subject:boolean)=>`SELECT potok_nutrition.read_exact_generation_source_v3($1::uuid,'${kind}',${subject?"pg_catalog.decode($2::text,'hex')":'NULL'}) AS result_raw`;
export const exactGenerationSourceSqlV3=Object.freeze({POOL:statement('POOL',false),GRAPH:statement('GRAPH',true),METRIC_POLICY:statement('METRIC_POLICY',false),CONVENIENCE:statement('CONVENIENCE',true),TITLES:statement('TITLES',true)});
export const exactGenerationSourceStatementsV3=Object.freeze([exactPlanCurrentSqlV3,...Object.values(exactGenerationSourceSqlV3)]);
export interface ExactGenerationSourceBindingV3 {requestOperationId:string;accountId:string;generationInputDigest:string}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hex=/^[a-f0-9]{64}$/;
function fields(v:unknown,keys:readonly string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))throw Error('EXACT_SOURCE_FIELDS');return v as Record<string,unknown>;}
function result(r:{rows:{result_raw:string|null}[]}):string|null{
 if(!r||!Array.isArray(r.rows)||r.rows.length!==1)throw Error('EXACT_SOURCE_SQL_ROWS');const row=fields(r.rows[0],['result_raw']);
 if(row.result_raw!==null&&typeof row.result_raw!=='string')throw Error('EXACT_SOURCE_SQL_RAW');return row.result_raw;
}
/** Binding and SQL client are trusted, same-transaction backend dependencies, never request DTOs. */
export function createExactGenerationSourcePortsV3(sql:ExactPlanSqlSourceClientV3,binding:ExactGenerationSourceBindingV3){
 const op=binding.requestOperationId,account=binding.accountId,input=binding.generationInputDigest;
 if(!uuid.test(op)||!uuid.test(account)||!hex.test(input))throw Error('EXACT_SOURCE_BINDING');
 async function read(operation:string,kind:Kind,subject:string|null):Promise<string|null>{
  if(operation!==op||subject!==null&&!hex.test(subject))throw Error('EXACT_SOURCE_LOOKUP');
  const raw=result(await sql.query(exactGenerationSourceSqlV3[kind],subject===null?[op]:[op,subject]));if(raw===null)return null;
  const envelope=fields(parse(raw,16_777_216,28),['contract','purpose','requestOperationId','accountId','generationInputDigest','sourceKind','subjectSha256','payloadRaw','storageSha256','sourceRef']);
  if(envelope.contract!=='potok-exact-generation-source-envelope-v3'||envelope.purpose!=='RETAINED_SOURCE_NOT_REVIEW_APPROVAL'||envelope.requestOperationId!==op||envelope.accountId!==account
   ||envelope.generationInputDigest!==input||envelope.sourceKind!==kind||envelope.subjectSha256!==subject||typeof envelope.payloadRaw!=='string'
   ||typeof envelope.sourceRef!=='string'||!envelope.sourceRef.trim()||envelope.sourceRef.length>256)throw Error('EXACT_SOURCE_ENVELOPE_BINDING');
  const payload=envelope.payloadRaw;parse(payload,kind==='POOL'||kind==='GRAPH'?4_194_304:65536,24);
  if(envelope.storageSha256!==await adaptiveNutritionSha256HexV1(new TextEncoder().encode(payload)))throw Error('EXACT_SOURCE_STORAGE_DIGEST');
  return payload; // Exact stored bytes; all full consumer/event/policy checks remain mandatory.
 }
 return Object.freeze({pool:Object.freeze({loadForOperationRaw:(operation:string)=>read(operation,'POOL',null)}),
  graph:Object.freeze({loadForProposalRaw:(operation:string,subject:string)=>read(operation,'GRAPH',subject)}),
  loadMetricPolicyRaw:(operation:string)=>read(operation,'METRIC_POLICY',null),
  convenience:Object.freeze({loadConvenienceRaw:async(operation:string,graphRawSha256:string,_input:string,_revision:string)=>{
   if(_input!==input||!uuid.test(_revision))throw Error('EXACT_CONVENIENCE_LOOKUP');return read(operation,'CONVENIENCE',graphRawSha256);
  }}),loadTitlesRaw:async(operation:string,accountId:string,graphDigest:string)=>{
   if(accountId!==account)throw Error('EXACT_TITLE_ACCOUNT');return read(operation,'TITLES',graphDigest);
  }});
}
/** Composes existing exact optimizer + derived metric producer on one fenced SQL connection.
 * No pool acquisition, credentials, SQL writer, source approval or runtime activation is added. */
export function createExactGenerationSqlOptimizerV3(sql:ExactPlanSqlSourceClientV3,eventAuthority:ExactTypedRecipeAuthorityV3){
 return Object.freeze({async optimize(operation:string){
  if(!uuid.test(operation))throw Error('EXACT_SOURCE_OPERATION');
  const raw=result(await sql.query(exactPlanCurrentSqlV3,[operation,'']));if(raw===null)throw Error('EXACT_SOURCE_CURRENT_MISSING');
  const r=fields(parse(raw,262144,12),['contract','requestOperationId','actorAccountId','accountId','generationInputDigest','evaluatedProposalRawSha256','trustedGenerationInputRaw','currentAuthority']);
  if(r.contract!==exactPlanAdmissionSourceContractV3||r.requestOperationId!==operation||r.actorAccountId!==r.accountId||r.evaluatedProposalRawSha256!==null||typeof r.trustedGenerationInputRaw!=='string')throw Error('EXACT_SOURCE_CURRENT_BINDING');
  parse(r.trustedGenerationInputRaw,262144,12);const input=decodeTrustedGenerationInputRawV1(r.trustedGenerationInputRaw);
  if(input.accountId!==r.accountId||input.operation.requestId!==operation||await trustedGenerationInputDigestV1(input)!==r.generationInputDigest)throw Error('EXACT_SOURCE_CURRENT_INPUT');
  const ports=createExactGenerationSourcePortsV3(sql,{requestOperationId:operation,accountId:input.accountId,generationInputDigest:r.generationInputDigest as string});
  const policy=await ports.loadMetricPolicyRaw(operation);if(policy===null)throw Error('EXACT_SOURCE_METRIC_POLICY_UNAVAILABLE');
  return createExactWeekOptimizationV3(ports.pool,ports.graph,createExactWeekMetricProducerV3(ports.pool,ports.graph,eventAuthority,policy,ports.convenience),eventAuthority).optimize(operation);
 }});
}
