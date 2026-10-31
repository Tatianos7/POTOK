import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullFixture,id} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';
import {encodeAdaptiveNutritionGraphCanonicalV2} from '../../src/utils/adaptiveNutritionGraphV2';
import {decodeGenerationPlanReadbackV2} from '../../src/services/generationPlanReadbackV2';
import {ok,denied,literal,binary,hex} from './generation-validation-fixture-v1';
const draft=readFileSync(new URL('../../docs/premium/drafts/generation_plan_readback_v2.sql',import.meta.url),'utf8');
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
function definition(path:string,name:string):string{
  const text=readFileSync(new URL(path,import.meta.url),'utf8');
  let start=text.indexOf('CREATE FUNCTION '+name+'(');
  if(start<0)start=text.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');
  const end=text.indexOf('$function$;',start);assert.ok(start>=0&&end>start);return text.slice(start,end+12);
}
test('native request readback uses actual draft and existing canonical/current-head/Premium readers', {skip:!native},async t=>{
  assert.equal(ok('SELECT current_database();'),'potok_generation_store_disposable');
  const f=await fullFixture(), input=f.context.input, account=literal(input.accountId), request=literal(input.operation.requestId),
    selection=literal(f.plan.selectionId), revision=literal(f.plan.proposedPlanRevision), generated=literal(id(900)),activation=literal(id(901));
  const canonical=(value:unknown)=>canonicalJsonV1(value,'SAFE_INTEGER');
  const planBytes=binary(hex(canonical(f.plan))),inputBytes=binary(hex(canonical(input)));
  const graphBytes=binary(hex(await encodeAdaptiveNutritionGraphCanonicalV2(f.plan.graph)));
  const receipt={kind:'settled',outcome:'accepted',contract:'potok-adaptive-plan-activated-v2',operation_id:id(901),
    selection_id:f.plan.selectionId,plan_revision:f.plan.proposedPlanRevision,graph_digest_hex:f.plan.graphDigest,event_ids:[]};
  const receiptBytes=binary(hex(canonical(receipt)));
  const activationRequest=binary(hex(canonical({contract:'potok-adaptive-activate-generated-week-v2',generationOperationId:id(900),expectedPlanRevision:null})));
  const old='../../docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql',graph='../../docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql';
  ok(`BEGIN;
    CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA potok_control; CREATE SCHEMA potok_nutrition;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE potok_control.access_attestations(attestation_id uuid PRIMARY KEY,account_id uuid NOT NULL,capability text NOT NULL,effect text NOT NULL,previous_attestation_id uuid,lineage_sequence bigint NOT NULL,issued_at timestamptz NOT NULL,valid_until timestamptz);
    CREATE TABLE public.user_premium_plan_selections(id uuid PRIMARY KEY,user_id uuid,status text,plan_revision uuid);
    CREATE TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2(request_operation_id uuid PRIMARY KEY,account_id uuid,selection_id uuid,status text,proposed_plan_revision uuid,generated_operation_id uuid,activation_operation_id uuid,generation_input_canonical bytea,generation_input_digest bytea);
    CREATE TABLE public.adaptive_nutrition_operations(operation_id uuid PRIMARY KEY,user_id uuid,selection_id uuid,action_type text,outcome text,canonical_request bytea,result_canonical bytea,result_digest bytea,result_plan_revision uuid,result_graph_digest bytea,result_references jsonb);
    CREATE TABLE public.adaptive_nutrition_graph_revisions(user_id uuid,selection_id uuid,plan_revision uuid PRIMARY KEY,graph_contract text,graph_contract_version integer,content_digest bytea,graph_snapshot jsonb,graph_canonical_bytes bytea,generated_week_plan_digest bytea,generation_input_digest bytea,generation_operation_id uuid,activation_operation_id uuid);
    ${definition(old,'potok_nutrition.json_has_duplicate_keys_v1')}
    ${definition(old,'potok_nutrition.canonical_jsonb_text_v1')}
    ${definition(graph,'potok_nutrition.require_canonical_json_v2')}
    ${definition(graph,'public.adaptive_nutrition_read_graph_v2')}
    ${definition('./generation-admission-prerequisites-v1.sql','potok_control.is_effective_entitlement_v2')}
    REVOKE ALL ON ALL TABLES IN SCHEMA public,potok_control,potok_nutrition FROM PUBLIC,anon,authenticated,service_role;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_control,potok_nutrition FROM PUBLIC,anon,authenticated,service_role;
    INSERT INTO potok_control.access_attestations VALUES (${literal(id(902))},${account},'premium','GRANT',NULL,1,statement_timestamp()-interval '1 hour',statement_timestamp()+interval '1 day');
    INSERT INTO public.user_premium_plan_selections VALUES (${selection},${account},'active',${revision});
    INSERT INTO potok_nutrition.adaptive_nutrition_generation_requests_v2 VALUES (${request},${account},${selection},'ACTIVE',${revision},${generated},${activation},${inputBytes},${binary(f.evidence.generationInputDigest)});
    INSERT INTO public.adaptive_nutrition_operations VALUES (${generated},${account},${selection},'PLAN_GENERATED_V2','accepted',${inputBytes},${planBytes},extensions.digest(${planBytes},'sha256'),${revision},${binary(f.plan.graphDigest)},'{}');
    INSERT INTO public.adaptive_nutrition_operations VALUES (${activation},${account},${selection},'PLAN_ACTIVATED_V2','accepted',${activationRequest},${receiptBytes},extensions.digest(${receiptBytes},'sha256'),${revision},${binary(f.plan.graphDigest)},${literal(canonical(receipt))}::jsonb);
    INSERT INTO public.adaptive_nutrition_graph_revisions VALUES (${account},${selection},${revision},'adaptive_nutrition_graph_v2',2,${binary(f.plan.graphDigest)},${literal(canonical(f.plan.graph))}::jsonb,${graphBytes},extensions.digest(${planBytes},'sha256'),extensions.digest(${inputBytes},'sha256'),${generated},${activation});
    COMMIT;`);
  ok(draft);
  const actor=`SET ROLE authenticated;SET request.jwt.claim.sub=${account};`;
  const read=`SELECT public.adaptive_nutrition_read_generation_plan_v2(${request});`;
  const result=(prefix='')=>JSON.parse(ok(actor+'BEGIN READ ONLY;'+prefix+read+'ROLLBACK;'));
  await t.test('real PostgreSQL output passes the actual client Graph V2 decoder',async()=>{
    const r=result();assert.equal(r.kind,'ready');assert.equal((await decodeGenerationPlanReadbackV2(r,input.accountId,input.operation.requestId)).kind,'ready');
    assert.equal(r.graph_digest_hex,f.plan.graphDigest);
  });
  await t.test('read-only call changes no request or ledger state',()=>{
    const before=ok('SELECT md5(jsonb_agg(to_jsonb(o))::text) FROM public.adaptive_nutrition_operations o;');result();
    assert.equal(ok('SELECT md5(jsonb_agg(to_jsonb(o))::text) FROM public.adaptive_nutrition_operations o;'),before);
    assert.equal(ok("SELECT provolatile FROM pg_proc WHERE oid='public.adaptive_nutrition_read_generation_plan_v2(uuid)'::regprocedure;"),'s');
  });
  await t.test('anonymous and service roles cannot call; authenticated cannot read private tables',()=>{
    for(const role of ['anon','service_role'])denied(`SET ROLE ${role};`+read,/permission denied/);
    for(const table of ['public.adaptive_nutrition_graph_revisions','public.adaptive_nutrition_operations','potok_nutrition.adaptive_nutrition_generation_requests_v2'])denied(actor+`SELECT * FROM ${table};`,/permission denied/);
  });
  await t.test('other account, missing request and missing Auth reveal no graph',()=>{
    assert.equal(JSON.parse(ok(`SET ROLE authenticated;SET request.jwt.claim.sub=${literal(id(999))};`+read)).kind,'denied');
    assert.deepEqual(JSON.parse(ok(`BEGIN;INSERT INTO potok_control.access_attestations VALUES (${literal(id(903))},${literal(id(999))},'premium','GRANT',NULL,1,statement_timestamp()-interval '1 hour',NULL);SET ROLE authenticated;SET request.jwt.claim.sub=${literal(id(999))};`+read+'ROLLBACK;')),{kind:'not_found'});
    assert.equal(JSON.parse(ok('SET ROLE authenticated;'+read)).kind,'denied');
    assert.equal(JSON.parse(ok(actor+`SELECT public.adaptive_nutrition_read_generation_plan_v2(${literal(id(999))});`)).kind,'not_found');
  });
  const mutations:[string,string,string][]=[
    ['request merely GENERATED',"UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='GENERATED';",'not_ready'],
    ['noncurrent active head',`UPDATE public.user_premium_plan_selections SET plan_revision=${literal(id(999))};`,'unavailable'],
    ['retired selection',"UPDATE public.user_premium_plan_selections SET status='retired';",'unavailable'],
    ['revoked Premium',"UPDATE potok_control.access_attestations SET valid_until=statement_timestamp()-interval '1 minute';",'denied'],
    ['generation rejected',"UPDATE public.adaptive_nutrition_operations SET outcome='rejected' WHERE action_type='PLAN_GENERATED_V2';",'unavailable'],
    ['activation absent',"DELETE FROM public.adaptive_nutrition_operations WHERE action_type='PLAN_ACTIVATED_V2';",'unavailable'],
    ['activation references other generation',`UPDATE public.adaptive_nutrition_operations SET canonical_request=convert_to('{"expectedPlanRevision":null,"generationOperationId":"${id(999)}"}','UTF8') WHERE action_type='PLAN_ACTIVATED_V2';`,'unavailable'],
    ['wrong graph digest',"UPDATE public.adaptive_nutrition_graph_revisions SET content_digest=decode(repeat('ff',32),'hex');",'unavailable'],
    ['wrong stored canonical graph',"UPDATE public.adaptive_nutrition_graph_revisions SET graph_canonical_bytes=convert_to('{}','UTF8');",'unavailable'],
    ['wrong generated plan digest',"UPDATE public.adaptive_nutrition_operations SET result_digest=decode(repeat('ff',32),'hex') WHERE action_type='PLAN_GENERATED_V2';",'unavailable'],
    ['missing activation receipt digest',"UPDATE public.adaptive_nutrition_operations SET result_digest=NULL WHERE action_type='PLAN_ACTIVATED_V2';",'unavailable'],
    ['foreign graph owner',`UPDATE public.adaptive_nutrition_graph_revisions SET user_id=${literal(id(999))};`,'unavailable'],
  ];
  for(const [name,change,kind]of mutations)await t.test(name,()=>{
    const r=JSON.parse(ok('BEGIN;'+change+actor+read+'ROLLBACK;'));assert.deepEqual(r,{kind});
  });
  assert.equal(result().kind,'ready');
});
