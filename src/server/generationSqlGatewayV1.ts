import {GenerationEdgeErrorV2,decodeGenerationResponseV2,decodeLoadedRequestV2,type GenerationRpcClientV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';

export interface GenerationGatewaySqlClientV1 {
  /** A dedicated, already admitted backend driver. No role/session mutation here. */
  query(statement:string,parameters:readonly string[]):Promise<{rows:Array<{result_raw:unknown}>}>;
}
// Check the real database execution identity in the same statement as the call.
// JWT/GUC role labels are not consulted. Owner/superuser/BYPASSRLS login sessions
// are rejected even if somebody SET ROLE service_role on that connection.
const identity="current_user='service_role' AND session_user NOT IN ('postgres','supabase_admin') AND EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname=session_user AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) AND NOT pg_catalog.pg_has_role(session_user,'postgres','MEMBER')";
const statement=(call:string)=>`SELECT CASE WHEN ${identity} THEN ${call} ELSE NULL END AS result_raw`;
export const generationLoadGatewaySqlV1=statement('potok_nutrition.load_generation_request_v2($1::uuid)');
export const generationRecordGatewaySqlV1=statement("potok_nutrition.record_generated_week_gateway_v2($1::uuid,pg_catalog.decode($2::text,'hex'))");
export const generationActivateGatewaySqlV1=statement('potok_nutrition.activate_generated_week_gateway_v2($1::uuid)');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonicalBytea=/^\\x(?:[0-9a-f]{2})+$/;
const failure=(code:string)=>Object.freeze({data:null,error:Object.freeze({code})});
/** Fixed direct SQL transport for the three existing protected gateway operations.
 * No HTTP schema exposure, connection, credentials, retries, owner fallback, source
 * reader, internal writer or arbitrary SQL/RPC selector is exposed by this adapter.
 */
export function createGenerationSqlGatewayV1(client:GenerationGatewaySqlClientV1,enabled:()=>boolean=()=>false):GenerationRpcClientV2{
  const assertEnabled=()=>{if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);};
  return Object.freeze({async rpc<T>(name:string,args:Record<string,unknown>){
    assertEnabled();
    const record=name==='record_generated_week_gateway_v2';
    if(!record&&name!=='load_generation_request_v2'&&name!=='activate_generated_week_gateway_v2')
      throw new GenerationEdgeErrorV2('INVALID_GENERATION_GATEWAY_OPERATION',502);
    const keys=record?['p_request_operation_id','p_generated_week_plan_canonical']:['p_request_operation_id'];
    if(!args||Object.getPrototypeOf(args)!==Object.prototype||Object.keys(args).length!==keys.length
      ||!keys.every(k=>Object.prototype.hasOwnProperty.call(args,k)))throw new GenerationEdgeErrorV2('INVALID_GENERATION_GATEWAY_ARGUMENTS',400);
    const request=args.p_request_operation_id,bytea=args.p_generated_week_plan_canonical;
    if(typeof request!=='string'||!uuid.test(request)||(record&&(typeof bytea!=='string'||bytea.length>16_000_002||!canonicalBytea.test(bytea))))
      throw new GenerationEdgeErrorV2('INVALID_GENERATION_GATEWAY_ARGUMENTS',400);
    const sql=record?generationRecordGatewaySqlV1:name==='load_generation_request_v2'?generationLoadGatewaySqlV1:generationActivateGatewaySqlV1;
    const parameters=Object.freeze(record?[request,(bytea as string).slice(2)]:[request]);
    let result:Awaited<ReturnType<GenerationGatewaySqlClientV1['query']>>;
    try{result=await client.query(sql,parameters);}catch{return failure('GENERATION_GATEWAY_SQL_UNAVAILABLE');}
    assertEnabled();
    try{
      if(!result||!Array.isArray(result.rows)||result.rows.length!==1||!result.rows[0]
        ||Object.keys(result.rows[0]).length!==1||!Object.prototype.hasOwnProperty.call(result.rows[0],'result_raw'))throw Error('INVALID_ROW');
      const value=name==='load_generation_request_v2'?decodeLoadedRequestV2(result.rows[0].result_raw):decodeGenerationResponseV2(result.rows[0].result_raw);
      if(value.requestOperationId!==request)throw Error('REQUEST_MISMATCH');
      return Object.freeze({data:Object.freeze(value) as T,error:null});
    }catch{return failure('GENERATION_GATEWAY_SQL_RESPONSE_INVALID');}
  }});
}
