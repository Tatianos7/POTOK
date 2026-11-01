import assert from 'node:assert/strict';
import test from 'node:test';
import {createGenerationSqlGatewayV1,generationLoadGatewaySqlV1,generationRecordGatewaySqlV1,generationActivateGatewaySqlV1} from '../generationSqlGatewayV1';
const request='00000000-0000-4000-8000-000000000001';
const args={p_request_operation_id:request};
const response={contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status:'GENERATED',retryable:true,reasonCode:null};
const loaded={...response,generationInputCanonicalHex:null,candidateManifestCanonicalHex:null,attemptOperationId:null};
test('three fixed parameterized SQL statements preserve request identity and every canonical byte',async()=>{
  const calls:{sql:string;parameters:readonly string[]}[]=[];
  const client=createGenerationSqlGatewayV1({async query(sql,parameters){calls.push({sql,parameters});assert.ok(Object.isFrozen(parameters));
    return {rows:[{result_raw:sql===generationLoadGatewaySqlV1?loaded:response}]};}},()=>true);
  assert.equal((await client.rpc('load_generation_request_v2',args)).error,null);
  const raw='{ "кириллица": "\\n$1; DROP TABLE x; --" }',hex=Buffer.from(raw).toString('hex');
  assert.equal((await client.rpc('record_generated_week_gateway_v2',{...args,p_generated_week_plan_canonical:'\\x'+hex})).error,null);
  assert.equal((await client.rpc('activate_generated_week_gateway_v2',args)).error,null);
  assert.deepEqual(calls,[{sql:generationLoadGatewaySqlV1,parameters:[request]},{sql:generationRecordGatewaySqlV1,parameters:[request,hex]},
    {sql:generationActivateGatewaySqlV1,parameters:[request]}]);
  assert.equal(Buffer.from(calls[1].parameters[1],'hex').toString('utf8'),raw);
  for(const c of calls){assert.match(c.sql,/current_user='service_role'/);assert.match(c.sql,/session_user/);assert.doesNotMatch(c.sql,/SET ROLE|SET SESSION|jwt|claim/);assert.ok(!c.sql.includes(hex));}
});
test('unknown operations, extra/missing fields, malformed UUID and noncanonical bytea never reach SQL',async()=>{
  let calls=0;const client=createGenerationSqlGatewayV1({async query(){calls++;throw Error('unexpected');}},()=>true);
  for(const name of ['record_generated_week_v2','public.load_generation_request_v2','arbitrary_sql'])await assert.rejects(client.rpc(name,args),/INVALID_GENERATION_GATEWAY_OPERATION/);
  for(const value of [{...args,accountId:request},{},{...args,p_request_operation_id:request+"';SELECT 1;--"}])
    await assert.rejects(client.rpc('load_generation_request_v2',value),/INVALID_GENERATION_GATEWAY_ARGUMENTS/);
  for(const bytes of ['','{}','\\x','\\x0','\\xAA','\\xzz'])await assert.rejects(client.rpc('record_generated_week_gateway_v2',{...args,p_generated_week_plan_canonical:bytes}),/INVALID_GENERATION_GATEWAY_ARGUMENTS/);
  assert.equal(calls,0);
});
test('default gate performs no SQL and closing it after a committed call does not retry or report success',async()=>{
  let enabled=true,calls=0;const driver={async query(){calls++;enabled=false;return {rows:[{result_raw:response}]};}};
  await assert.rejects(createGenerationSqlGatewayV1(driver).rpc('activate_generated_week_gateway_v2',args),/GENERATION_RUNTIME_DISABLED/);assert.equal(calls,0);
  await assert.rejects(createGenerationSqlGatewayV1(driver,()=>enabled).rpc('activate_generated_week_gateway_v2',args),/GENERATION_RUNTIME_DISABLED/);assert.equal(calls,1);
});
test('database failures expose only a fixed error, without details, credentials or automatic retry',async()=>{
  let calls=0;const client=createGenerationSqlGatewayV1({async query(){calls++;throw Error('sensitive SQL/connection detail');}},()=>true);
  const r=await client.rpc('load_generation_request_v2',args);assert.deepEqual(r,{data:null,error:{code:'GENERATION_GATEWAY_SQL_UNAVAILABLE'}});assert.equal(calls,1);
});
test('denied identity, malformed rows and wrong-request replies expose no accepted result',async()=>{
  for(const rows of [[],[{result_raw:null}],[{result_raw:response},{result_raw:response}],[{result_raw:response,extra:true}],
    [{result_raw:{...response,requestOperationId:'00000000-0000-4000-8000-000000000002'}}]]){
    const client=createGenerationSqlGatewayV1({async query(){return {rows};}},()=>true);
    assert.deepEqual(await client.rpc('activate_generated_week_gateway_v2',args),{data:null,error:{code:'GENERATION_GATEWAY_SQL_RESPONSE_INVALID'}});
  }
});
test('caller argument replacement during an await cannot redirect the pinned operation',async()=>{
  let complete!:(v:{rows:{result_raw:unknown}[]})=>void;let pinned:readonly string[]=[];
  const client=createGenerationSqlGatewayV1({async query(_s,p){pinned=p;return new Promise(r=>{complete=r;});}},()=>true);
  const supplied={...args};const pending=client.rpc('activate_generated_week_gateway_v2',supplied);supplied.p_request_operation_id='00000000-0000-4000-8000-000000000002';
  complete({rows:[{result_raw:response}]});assert.equal((await pending).error,null);assert.deepEqual(pinned,[request]);
});
