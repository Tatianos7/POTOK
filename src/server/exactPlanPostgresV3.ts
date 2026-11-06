/** Fixed private SQL transaction adapter; inactive, no connection, credential, role switch or retry. */
import type {GenerationTransactionPoolV1} from './generationTransactionClientV1';
import type {ExactPlanTransactionalStoreV3,ExactPlanTransactionV3} from './exactPlanAdmissionV3';
import type {ExactWeekOptimizationResultV3} from './exactWeekOptimizationV3';
export interface ExactPlanSqlRowV3 {result_raw:string|null}
export interface ExactPlanSqlSourceClientV3 {query(sql:string,parameters:readonly string[]):Promise<{rows:ExactPlanSqlRowV3[]}>}
const role="current_user='potok_generation_gateway_v1' AND session_user=current_user AND EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) AND NOT EXISTS(SELECT FROM pg_catalog.pg_auth_members WHERE member=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=session_user))";
export const exactPlanChannelSqlV3=`SELECT CASE WHEN ${role} THEN 'EXACT_PLAN_CHANNEL_V3' ELSE NULL END AS result_raw`;
export const exactPlanCurrentSqlV3="SELECT potok_nutrition.load_locked_exact_plan_admission_v3($1::uuid, CASE WHEN $2::text='' THEN NULL ELSE pg_catalog.decode($2::text,'hex') END) AS result_raw";
export const exactPlanReadSqlV3='SELECT potok_nutrition.read_exact_retained_plan_v3($1::uuid) AS result_raw';
export const exactPlanInsertSqlV3="SELECT potok_nutrition.retain_exact_plan_v3($1::uuid,$2::uuid,pg_catalog.decode($3::text,'hex'),$4::text) AS result_raw";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
function result(value:{rows:ExactPlanSqlRowV3[]}):string|null{
 if(!value||!Array.isArray(value.rows)||value.rows.length!==1||!value.rows[0]||Object.keys(value.rows[0]).length!==1||!Object.prototype.hasOwnProperty.call(value.rows[0],'result_raw')||value.rows[0].result_raw!==null&&typeof value.rows[0].result_raw!=='string')throw Error('EXACT_SQL_ROW_INVALID');return value.rows[0].result_raw;
}
/** Source allowlist/factory are trusted backend composition, never client arguments.
 * All source/metric adapters receive the same fenced exclusive session and must lock current heads.
 * This factory does not implement source/metric issuance or permit arbitrary public SQL.
 */
export function createExactPlanPostgresStoreV3(pool:GenerationTransactionPoolV1<ExactPlanSqlRowV3>,
 sourceStatements:readonly string[],optimizerFactory:(client:ExactPlanSqlSourceClientV3)=>{optimize(operation:string):Promise<ExactWeekOptimizationResultV3>},
 enabled:()=>boolean=()=>false):ExactPlanTransactionalStoreV3{
 if(!Array.isArray(sourceStatements)||!sourceStatements.length||sourceStatements.length>16||new Set(sourceStatements).size!==sourceStatements.length||sourceStatements.some(s=>typeof s!=='string'||s.length>4096||!s.startsWith('SELECT potok_nutrition.')||s.includes(';')))throw Error('EXACT_SQL_SOURCE_ALLOWLIST_INVALID');
 const allowlist=new Set(sourceStatements);const gate=()=>{if(enabled()!==true)throw Error('EXACT_SQL_DISABLED');};
 return Object.freeze({async transaction<T>(operation:string,work:(tx:ExactPlanTransactionV3)=>Promise<T>):Promise<T>{
  gate();if(typeof operation!=='string'||!uuid.test(operation))throw Error('EXACT_SQL_OPERATION_INVALID');
  let connection:Awaited<ReturnType<typeof pool.acquire>>|undefined,begun=false,live=false,busy=false,commitAttempted=false,committed=false;
  let value:T|undefined,failure:unknown;
  try{
   connection=await pool.acquire();gate();await connection.query('BEGIN ISOLATION LEVEL READ COMMITTED',[]);begun=true;gate();
   if(result(await connection.query(exactPlanChannelSqlV3,[]))!=='EXACT_PLAN_CHANNEL_V3')throw Error('EXACT_SQL_CHANNEL_REQUIRED');live=true;
   const query=async(sql:string,parameters:readonly string[])=>{
    gate();if(!live||busy)throw Error('EXACT_SQL_SESSION_CLOSED_OR_BUSY');const owned=Object.freeze([...parameters]);busy=true;
    try{const row=await connection!.query(sql,owned);gate();if(!live)throw Error('EXACT_SQL_SESSION_CLOSED');return row;}finally{busy=false;}
   };
   const optimizer=optimizerFactory(Object.freeze({query:async(sql:string,parameters:readonly string[])=>{
    if(!allowlist.has(sql))throw Error('EXACT_SQL_SOURCE_NOT_ALLOWLISTED');return query(sql,parameters);
   }}));
   const operationMatches=(op:string)=>{if(op!==operation)throw Error('EXACT_SQL_REQUEST_MISMATCH');};
   const tx:ExactPlanTransactionV3=Object.freeze({
    loadLockedCurrentRequestRaw:async(op:string,subject:string|null)=>{operationMatches(op);if(subject!==null&&!hash.test(subject))throw Error('EXACT_SQL_SUBJECT_INVALID');return result(await query(exactPlanCurrentSqlV3,[op,subject??'']));},
    optimize:async(op:string)=>{operationMatches(op);gate();if(!live)throw Error('EXACT_SQL_SESSION_CLOSED');const r=await optimizer.optimize(op);gate();if(!live)throw Error('EXACT_SQL_SESSION_CLOSED');return r;},
    readRetainedSnapshotRaw:async(op:string)=>{operationMatches(op);return result(await query(exactPlanReadSqlV3,[op]));},
    insertSnapshotIfAbsentRaw:async(op:string,account:string,inputDigest:string,raw:string)=>{operationMatches(op);if(!uuid.test(account)||!hash.test(inputDigest)||typeof raw!=='string'||new TextEncoder().encode(raw).length>4_194_304)throw Error('EXACT_SQL_RECORD_INVALID');const row=result(await query(exactPlanInsertSqlV3,[op,account,inputDigest,raw]));if(row===null)throw Error('EXACT_SQL_RECORD_UNAVAILABLE');return row;},
   });
   value=await work(tx);gate();if(busy)throw Error('EXACT_SQL_SESSION_BUSY');live=false;
   commitAttempted=true;await connection.query('COMMIT',[]);committed=true;gate();
  }catch(error){failure=commitAttempted&&!committed?Error('GENERATION_SQL_COMMIT_UNKNOWN'):error;
   if(connection&&begun&&!commitAttempted){try{await connection.query('ROLLBACK',[]);}catch{/* Discard; never retry. */}}
  }finally{live=false;if(connection){try{await connection.release(failure!==undefined);}catch{failure=committed?Error('GENERATION_SQL_COMMITTED_RELEASE_FAILED'):failure??Error('EXACT_SQL_RELEASE_FAILED');}}}
  if(failure!==undefined)throw failure;gate();return value as T;
 }});
}
