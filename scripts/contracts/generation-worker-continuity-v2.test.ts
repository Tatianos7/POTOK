import assert from 'node:assert/strict';
import test from 'node:test';
import {continueGenerationV2,lookupGenerationStatusV2,type GenerationRpcClientV2,
  type GenerationProposalProviderV2,type TrustedGenerationValidatorV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts.ts';
const request='93020000-0000-4000-8000-000000000060';
const other='93020000-0000-4000-8000-000000000070';
const load='load_generation_request_v2', record='record_generated_week_gateway_v2', activate='activate_generated_week_gateway_v2';
function fixture(options: {loadedStatus?:string;recordStatus?:string;wrongAt?:string;errorAt?:string}={}) {
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  let generated=0,validated=0;
  const client: GenerationRpcClientV2={async rpc<T>(name,args){
    calls.push({name,args:structuredClone(args)});
    if(options.errorAt===name)return {data:null,error:{unavailable:true}};
    const response={contract:'potok-adaptive-generation-request-status-v2',requestOperationId:options.wrongAt===name?other:request,
      status:name===load?(options.loadedStatus??'GENERATING'):name===record?(options.recordStatus??'GENERATED'):'ACTIVE',retryable:true,reasonCode:null};
    return {data:(name===load?{...response,generationInputCanonicalHex:'7b7d',candidateManifestCanonicalHex:'7b7d',attemptOperationId:other}:response) as T,error:null};
  }};
  const generator:GenerationProposalProviderV2={async generate(value){generated++;assert.equal(value.requestOperationId,request);assert.ok(Object.isFrozen(value));return {generatedWeekPlanCanonicalHex:'7b7d'};}};
  const validator:TrustedGenerationValidatorV2={async validate(value){validated++;assert.equal(value.requestOperationId,request);assert.ok(Object.isFrozen(value));return {generatedWeekPlanCanonicalHex:value.generatedWeekPlanCanonicalHex};}};
  const input={requestOperationId:request,gatewayClient:client,generator,validator};
  return {input,calls,counts:()=>({generated,validated}),run:()=>continueGenerationV2(input)};
}
test('one request reaches validation, record and activation with identical proposal bytes',async()=>{
  const f=fixture();assert.equal((await f.run()).status,'ACTIVE');
  assert.deepEqual(f.calls.map(c=>c.name),[load,record,activate]);
  assert.ok(f.calls.every(c=>c.args.p_request_operation_id===request));
  assert.equal(f.calls[1].args.p_generated_week_plan_canonical,'\\x7b7d');
  assert.deepEqual(f.counts(),{generated:1,validated:1});
});
test('invalid request identity stops before any RPC',async()=>{
  const f=fixture();f.input.requestOperationId='bad';await assert.rejects(f.run(),/INVALID_REQUEST_OPERATION_ID/);assert.equal(f.calls.length,0);
});
for(const stage of [load,record,activate])test(`foreign response identity at ${stage} aborts the chain`,async()=>{
  const f=fixture({wrongAt:stage});await assert.rejects(f.run(),/REQUEST_BINDING_MISMATCH/);
  assert.deepEqual(f.calls.map(c=>c.name),[load,record,activate].slice(0,[load,record,activate].indexOf(stage)+1));
  if(stage===load)assert.deepEqual(f.counts(),{generated:0,validated:0});
});
test('resume activation also rejects a foreign response',async()=>{
  const f=fixture({loadedStatus:'GENERATED',wrongAt:activate});await assert.rejects(f.run(),/REQUEST_BINDING_MISMATCH/);
  assert.deepEqual(f.calls.map(c=>c.name),[load,activate]);assert.deepEqual(f.counts(),{generated:0,validated:0});
});
test('validator cannot replace a proposal with other canonical bytes',async()=>{
  const f=fixture();f.input.validator={async validate(){return {generatedWeekPlanCanonicalHex:'5b5d'};}};
  await assert.rejects(f.run(),/VALIDATED_PROPOSAL_MISMATCH/);assert.deepEqual(f.calls.map(c=>c.name),[load]);
});
for(const stage of ['generator','validator'] as const)test(`malformed ${stage} results never reach record`,async()=>{
  for(const value of [null,{}, {generatedWeekPlanCanonicalHex:''},{generatedWeekPlanCanonicalHex:'a'},
    {generatedWeekPlanCanonicalHex:'7B7D'},{generatedWeekPlanCanonicalHex:'7b7d',approved:true}]){
    const f=fixture();if(stage==='generator')f.input.generator={async generate(){return value as never;}};
    else f.input.validator={async validate(){return value as never;}};
    await assert.rejects(f.run());assert.deepEqual(f.calls.map(c=>c.name),[load]);
  }
});
test('validator refusal leaves record and activation untouched',async()=>{
  const f=fixture();f.input.validator={async validate(){throw Error('VALIDATION_BLOCKED');}};
  await assert.rejects(f.run(),/VALIDATION_BLOCKED/);assert.deepEqual(f.calls.map(c=>c.name),[load]);
});
test('caller mutation during await cannot redirect request or dependencies',async()=>{
  const f=fixture();let redirected=0;
  f.input.generator={async generate(){
    f.input.requestOperationId=other;
    f.input.gatewayClient={async rpc(){redirected++;throw Error('redirected');}};
    f.input.validator={async validate(){throw Error('substituted');}};
    return {generatedWeekPlanCanonicalHex:'7b7d'};
  }};
  assert.equal((await f.run()).status,'ACTIVE');assert.equal(redirected,0);
  assert.ok(f.calls.every(c=>c.args.p_request_operation_id===request));
});
test('proposal object mutation during validator await cannot change recorded bytes',async()=>{
  const f=fixture();const proposal={generatedWeekPlanCanonicalHex:'7b7d'};
  f.input.generator={async generate(){return proposal;}};
  f.input.validator={async validate(v){proposal.generatedWeekPlanCanonicalHex='5b5d';return {generatedWeekPlanCanonicalHex:v.generatedWeekPlanCanonicalHex};}};
  await f.run();assert.equal(f.calls[1].args.p_generated_week_plan_canonical,'\\x7b7d');
});
for(const status of ['ACTIVE','REJECTED','CONFLICT'])test(`loaded ${status} remains terminal`,async()=>{
  const f=fixture({loadedStatus:status});assert.equal((await f.run()).status,status);
  assert.deepEqual(f.calls.map(c=>c.name),[load]);assert.deepEqual(f.counts(),{generated:0,validated:0});
});
test('record returning ACTIVE does not activate a second time',async()=>{
  const f=fixture({recordStatus:'ACTIVE'});assert.equal((await f.run()).status,'ACTIVE');assert.deepEqual(f.calls.map(c=>c.name),[load,record]);
});
for(const status of ['GENERATED','ACTIVATING'])test(`loaded ${status} resumes without regeneration or record`,async()=>{
  const f=fixture({loadedStatus:status});assert.equal((await f.run()).status,'ACTIVE');
  assert.deepEqual(f.calls.map(c=>c.name),[load,activate]);assert.deepEqual(f.counts(),{generated:0,validated:0});
});
test('unknown record transport outcome triggers no blind activation or retry',async()=>{
  const f=fixture({errorAt:record});await assert.rejects(f.run(),/RPC_FAILED/);
  assert.deepEqual(f.calls.map(c=>c.name),[load,record]);
});
test('status lookup binds the server response to the requested identity',async()=>{
  const f=fixture({wrongAt:'adaptive_nutrition_generation_status_v2'});
  await assert.rejects(lookupGenerationStatusV2(f.input.gatewayClient,{requestOperationId:request}),/REQUEST_BINDING_MISMATCH/);
});
