// Fixed-loopback extension of the native graph fixture. Not an Auth or catalog publisher.
import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {renderToStaticMarkup} from 'react-dom/server';
import {GenerationRequestFlowV2} from '../../src/services/generationRequestFlowV2';
import {GenerationFlowViewV2} from '../../src/components/GenerationRequestFlowV2';
import type {GenerationPlanReadClientV2} from '../../src/services/generationPlanReadbackV2';
import type {GenerationRpcClientV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {fullFixture,check,id} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import type {TrustedGenerationInputV1} from '../../src/utils/adaptiveNutritionGraphV2';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';
import {nutritionPreferenceSnapshotCanonicalBytesV1,nutritionSafetySnapshotCanonicalBytesV1} from '../../src/utils/adaptiveNutritionAuthoritiesV1';
import {generationPreparationMetadataFixtureV1} from '../../src/server/__tests__/generationPreparationSqlFixturesV1';
import {ok,denied,literal,hex,binary,hash} from './generation-validation-fixture-v1';

const read=(name:string)=>readFileSync(new URL('../../docs/premium/drafts/'+name,import.meta.url),'utf8');
function definition(source:string,name:string){
  const match=new RegExp('CREATE (?:OR REPLACE )?FUNCTION '+name.replaceAll('.','\\.')+'\\(').exec(source);
  assert.ok(match);const end=source.indexOf('$function$;',match.index);assert.ok(end>match.index);
  return source.slice(match.index,end+12);
}
const canonical=(value:unknown)=>canonicalJsonV1(value,'SAFE_INTEGER');

/** Requires the previously admitted disposable graph foundation and installed patch. */
export async function runGenerationRequestRoundtripV1(t:TestContext,gateway:GenerationRpcClientV2){
  assert.equal(ok('SELECT current_database();'),'potok_generation_store_disposable');
  const account=id(9000),selection=id(9001),provision=id(9002),key=id(9003);
  const week=ok("SELECT date_trunc('week',statement_timestamp() AT TIME ZONE 'UTC')::date::text;");
  const date=(offset:number)=>new Date(Date.parse(week+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
  const fixture=(issued?:TrustedGenerationInputV1)=>fullFixture(state=>{
    if(issued)state.context.input=structuredClone(issued);
    else Object.assign(state.context.input,{accountId:account,weekStartLocal:week,
      selection:{...state.context.input.selection,selectionId:selection,planSelectionRevision:provision}});
    state.context.preference.accountId=account;state.context.safety.accountId=account;
    Object.assign(state.evidence,{accountId:account,selectionId:selection,weekStartLocal:week});
    state.evidence.distributionPolicy.days.forEach((day,i)=>{day.date=date(i);});
  });
  const seed=await fixture(),input=seed.context.input;
  const source=read('20260930_adaptive_nutrition_protected_execution_binding_v1.sql');
  const start=source.indexOf('CREATE TABLE potok_nutrition.adaptive_nutrition_goal_targets_v1 (');
  const end=source.indexOf('CREATE TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 (',start);
  assert.ok(start>=0&&end>start);
  ok(`BEGIN;
    ALTER TABLE public.user_premium_plan_selections ADD COLUMN contract_version integer NOT NULL DEFAULT 1;
    ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 ALTER COLUMN created_at SET DEFAULT statement_timestamp(),
      ALTER COLUMN updated_at SET DEFAULT statement_timestamp();
    ${source.slice(start,end)}
    ${definition(read('20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql'),'potok_nutrition.reject_immutable_change_v2')}
    ${definition(source,'potok_nutrition.protect_generation_request_identity_v2')}
    CREATE TRIGGER potok_generation_request_update_guard_v2 BEFORE UPDATE ON potok_nutrition.adaptive_nutrition_generation_requests_v2
      FOR EACH ROW EXECUTE FUNCTION potok_nutrition.protect_generation_request_identity_v2();
    CREATE TRIGGER potok_generation_request_delete_guard_v2 BEFORE DELETE OR TRUNCATE ON potok_nutrition.adaptive_nutrition_generation_requests_v2
      FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();
    CREATE TRIGGER potok_goal_target_immutable_v1 BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_nutrition.adaptive_nutrition_goal_targets_v1
      FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();
    ${definition(source,'public.adaptive_nutrition_request_generation_v2')}
    ${definition(source,'public.adaptive_nutrition_generation_status_v2')}
    REVOKE ALL ON FUNCTION public.adaptive_nutrition_request_generation_v2(text,uuid),public.adaptive_nutrition_generation_status_v2(uuid)
      FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1,potok_generation_gateway_v1;
    GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_request_generation_v2(text,uuid),public.adaptive_nutrition_generation_status_v2(uuid) TO authenticated;
    REVOKE ALL ON FUNCTION potok_nutrition.reject_immutable_change_v2(),potok_nutrition.protect_generation_request_identity_v2() FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1,potok_generation_gateway_v1;
    ALTER TABLE potok_nutrition.adaptive_nutrition_goal_targets_v1 ENABLE ROW LEVEL SECURITY;
    ALTER TABLE potok_nutrition.adaptive_nutrition_goal_targets_v1 FORCE ROW LEVEL SECURITY;
    REVOKE ALL ON potok_nutrition.adaptive_nutrition_goal_targets_v1 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1,potok_generation_gateway_v1;
    CREATE ROLE potok_generation_client_fixture_v1 LOGIN NOINHERIT CONNECTION LIMIT 2 PASSWORD 'client-disposable-only';
    GRANT authenticated TO potok_generation_client_fixture_v1;
    INSERT INTO auth.users VALUES(${literal(account)});
    INSERT INTO public.user_goals(user_id,goal_revision,goal_type) VALUES(${literal(account)},${literal(input.goalNutritionTarget.goalRevision)},'Поддержка формы');
    INSERT INTO public.user_premium_plan_selections(id,user_id,status,plan_revision,week_anchor,timezone,goal_revision,origin_lineage)
      VALUES(${literal(selection)},${literal(account)},'pending_generation',NULL,${literal(week)},'UTC',${literal(input.goalNutritionTarget.goalRevision)},
      jsonb_build_object('provisionOperationId',${literal(provision)}));
    INSERT INTO potok_control.access_attestations VALUES(${literal(input.entitlementEvidenceRevision)},${literal(account)},'premium','GRANT',NULL,1,statement_timestamp()-interval '1 hour',NULL);
    INSERT INTO potok_nutrition.nutrition_authority_heads_v1 VALUES(${literal(account)},${literal(input.preferenceRevision)},${literal(input.safetyRevision)});
    INSERT INTO potok_nutrition.nutrition_preference_snapshots_v1 VALUES(${literal(account)},${literal(input.preferenceRevision)},
      ${binary(hex(await nutritionPreferenceSnapshotCanonicalBytesV1(seed.context.preference)))},${binary(hash(await nutritionPreferenceSnapshotCanonicalBytesV1(seed.context.preference)))});
    INSERT INTO potok_nutrition.nutrition_safety_snapshots_v1 VALUES(${literal(account)},${literal(input.safetyRevision)},
      ${binary(hex(await nutritionSafetySnapshotCanonicalBytesV1(seed.context.safety)))},${binary(hash(await nutritionSafetySnapshotCanonicalBytesV1(seed.context.safety)))});
    INSERT INTO potok_nutrition.adaptive_nutrition_goal_targets_v1(account_id,goal_revision,target_policy_revision,canonical_bytes,canonical_snapshot,canonical_digest,evidence_ref)
      VALUES(${literal(account)},${literal(input.goalNutritionTarget.goalRevision)},${literal(input.goalNutritionTarget.targetPolicyRevision)},
      ${binary(hex(canonical(input.goalNutritionTarget)))},${literal(canonical(input.goalNutritionTarget))}::jsonb,${binary(hash(canonical(input.goalNutritionTarget)))},'synthetic-only:request-target');
    COMMIT;`);
  const pool=new Pool({host:'127.0.0.1',port:5432,database:'potok_generation_store_disposable',user:'potok_generation_client_fixture_v1',
    password:'client-disposable-only',ssl:false,connectionTimeoutMillis:3000,statement_timeout:5000,max:2});
  let actor:string|null=account,dropInitialReply=true;
  const calls:string[]=[];
  const client:GenerationPlanReadClientV2={auth:{async getUser(){return {data:{user:actor?{id:actor}:null},error:null};}},async rpc(name,args){
    const pinned=actor;calls.push(name);
    const lease=await pool.connect();
    try{
      await lease.query('BEGIN');await lease.query('SET LOCAL ROLE authenticated');
      await lease.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[pinned??'']);
      const result=name==='adaptive_nutrition_request_generation_v2'
        ?await lease.query('SELECT public.adaptive_nutrition_request_generation_v2($1::text,$2::uuid) AS result',[args.p_protocol_version,args.p_idempotency_key])
        :name==='adaptive_nutrition_generation_status_v2'
        ?await lease.query('SELECT public.adaptive_nutrition_generation_status_v2($1::uuid) AS result',[args.p_request_operation_id])
        :name==='adaptive_nutrition_read_generation_plan_v2'
        ?await lease.query('SELECT public.adaptive_nutrition_read_generation_plan_v2($1::uuid) AS result',[args.p_request_operation_id])
        :null;
      assert.ok(result,'fixture permits only the three public RPCs');
      await lease.query('COMMIT');
      if(name==='adaptive_nutrition_request_generation_v2'&&dropInitialReply){dropInitialReply=false;return {data:null,error:{code:'SYNTHETIC_COMMITTED_REPLY_LOST'}};}
      return {data:result.rows[0].result,error:null};
    }catch{await lease.query('ROLLBACK');return {data:null,error:{code:'FIXTURE_RPC_DENIED'}};}
    finally{lease.release();}
  }};
  const flow=new GenerationRequestFlowV2(client,()=>true,()=>key);
  const countRequests=()=>ok(`SELECT count(*) FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE account_id=${literal(account)};`);
  let request='';let prepared:Awaited<ReturnType<typeof fullFixture>>;
  flow.attach(account,week,'UTC');
  try{
    await t.test('actual public request COMMIT with lost reply recovers the same SQL-issued request and key',async()=>{
      assert.equal(countRequests(),'0');await flow.start();assert.equal(flow.snapshot().phase,'unknown');assert.equal(countRequests(),'1');
      assert.equal(flow.recovery()?.idempotencyKey,key);
      await flow.refresh();assert.equal(flow.snapshot().phase,'pending');assert.equal(countRequests(),'1');
      request=flow.snapshot().requestOperationId!;assert.ok(request);assert.notEqual(request,id(44));
      const rows=await Promise.all([1,2].map(()=>client.rpc('adaptive_nutrition_request_generation_v2',{
        p_protocol_version:'potok-adaptive-generation-request-v2',p_idempotency_key:key})));
      for(const row of rows){assert.equal(row.error,null);assert.equal((row.data as {requestOperationId:string}).requestOperationId,request);}
      assert.equal(countRequests(),'1');
    });
    await t.test('request identities are immutable and wrong-key protocol replay creates no replacement',async()=>{
      const response=await client.rpc('adaptive_nutrition_request_generation_v2',{p_protocol_version:'wrong-protocol',p_idempotency_key:key});
      assert.ok(response.error);assert.equal(countRequests(),'1');
      denied(`UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET proposed_plan_revision=${literal(id(9999))} WHERE request_operation_id=${literal(request)};`,/identity is immutable/);
    });
    await t.test('synthetic accepted proposal binds exactly to server-issued immutable input',async()=>{
      const issued=JSON.parse(ok(`SELECT convert_from(generation_input_canonical,'UTF8') FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE request_operation_id=${literal(request)};`)) as TrustedGenerationInputV1;
      prepared=await fixture(issued);assert.equal(canonical(prepared.context.input),canonical(issued));
      assert.equal((await check(prepared)).status,'ACCEPTED');
      const ref='synthetic-only:request-roundtrip:';
      ok(`BEGIN;
        INSERT INTO potok_nutrition.generation_validation_inputs_v1(request_operation_id,account_id,generation_input_digest,validation_evidence_raw,policies_raw,source_receipt_ref)
          VALUES(${literal(request)},${literal(account)},${binary(prepared.evidence.generationInputDigest)},${literal(prepared.rawContext.trustedValidationEvidenceRaw)},${literal(prepared.policiesRaw)},${literal(ref+'inputs')});
        INSERT INTO potok_nutrition.generation_validation_warnings_v1(request_operation_id,proposal_raw_sha256,warning_evidence_raw,source_receipt_ref)
          VALUES(${literal(request)},${binary(hash(canonical(prepared.plan)))},${literal(prepared.warningRaw)},${literal(ref+'warnings')});
        INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
          SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1 WHERE request_operation_id=${literal(request)};
        INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,proposal_raw_sha256,source_storage_sha256)
          SELECT source_receipt_ref,request_operation_id,${literal(account)},'WARNINGS',proposal_raw_sha256,warning_storage_sha256 FROM potok_nutrition.generation_validation_warnings_v1 WHERE request_operation_id=${literal(request)};
        COMMIT;`);
      const addSource=(sourceRef:string,kind:string,raw:string)=>{
        const b=JSON.parse(raw);
        ok(`INSERT INTO potok_nutrition.generation_preparation_sources_v1(source_ref,request_operation_id,account_id,source_kind,generation_input_digest,
          validation_evidence_digest,validation_policies_digest,slot_id,meal_snapshot_digest,payload_raw)
          VALUES(${literal(sourceRef)},${literal(request)},${literal(account)},${literal(kind)},${binary(prepared.evidence.generationInputDigest)},
          ${binary(prepared.evidence.digest)},${binary(prepared.policies.digest)},${kind==='METADATA'?'NULL':literal(b.slotId)},
          ${kind==='METADATA'?'NULL':binary(b.mealSnapshotDigest)},${literal(raw)});`);
      };
      addSource(ref+'metadata','METADATA',generationPreparationMetadataFixtureV1(prepared));
      prepared.set.entries.forEach((entry,i)=>addSource(ref+'meal-'+i,'MEAL_WARNING',JSON.stringify(entry)));
    });
    await t.test('real record remains pending until actual activation then controller opens and renders stored seven-day menu',async()=>{
      const loaded=await gateway.rpc<{status:string}>('load_generation_request_v2',{p_request_operation_id:request});
      assert.equal(loaded.error,null);assert.equal(loaded.data?.status,'GENERATING');
      const recorded=await gateway.rpc<{status:string}>('record_generated_week_gateway_v2',{
        p_request_operation_id:request,p_generated_week_plan_canonical:'\\x'+hex(canonical(prepared.plan))});
      assert.equal(recorded.error,null);assert.equal(recorded.data?.status,'GENERATED');
      const reads=calls.filter(x=>x==='adaptive_nutrition_read_generation_plan_v2').length;
      await flow.refresh();assert.equal(flow.snapshot().phase,'pending');
      assert.equal(calls.filter(x=>x==='adaptive_nutrition_read_generation_plan_v2').length,reads);
      const active=await gateway.rpc<{status:string}>('activate_generated_week_gateway_v2',{p_request_operation_id:request});
      assert.equal(active.error,null);assert.equal(active.data?.status,'ACTIVE');
      await flow.refresh();const state=flow.snapshot();assert.equal(state.phase,'ready');assert.deepEqual(state.entry.model?.graph,prepared.plan.graph);
      assert.equal(state.entry.model?.graphDigest,prepared.plan.graphDigest);
      const html=renderToStaticMarkup(GenerationFlowViewV2({state,onStart:()=>undefined,onRefresh:()=>undefined}));
      assert.equal((html.match(/<details/g)??[]).length,7);assert.match(html,/Моё меню на неделю/);assert.match(html,/Приёмы пищи пока не записаны в дневник/);
      const ledger=JSON.parse(ok(`SELECT jsonb_object_agg(action_type,outcome) FROM public.adaptive_nutrition_operations WHERE user_id=${literal(account)};`));
      assert.deepEqual(ledger,{GENERATION_REQUESTED_V2:'accepted',GENERATION_ATTEMPTED_V2:'accepted',PLAN_GENERATED_V2:'accepted',PLAN_ACTIVATED_V2:'accepted'});
      assert.equal(ok(`SELECT count(*) FROM public.adaptive_nutrition_operations WHERE user_id=${literal(account)};`),'4');
      assert.equal(ok('SELECT count(*) FROM public.adaptive_nutrition_events;'),'0');
    });
    await t.test('active replay creates no duplicate and account switch cannot read another account menu',async()=>{
      const replay=await client.rpc('adaptive_nutrition_request_generation_v2',{p_protocol_version:'potok-adaptive-generation-request-v2',p_idempotency_key:key});
      assert.equal((replay.data as {status:string}).status,'ACTIVE');assert.equal(countRequests(),'1');
      actor=id(999);const foreign=await client.rpc('adaptive_nutrition_generation_status_v2',{p_request_operation_id:request});assert.ok(foreign.error);
      flow.attach(actor,week,'UTC');await flow.refresh();assert.notEqual(flow.snapshot().phase,'ready');assert.equal(flow.snapshot().entry.model,null);
      actor=null;const anonymous=await client.rpc('adaptive_nutrition_request_generation_v2',{p_protocol_version:'potok-adaptive-generation-request-v2',p_idempotency_key:id(9998)});assert.ok(anonymous.error);
      assert.equal(countRequests(),'1');
    });
  }finally{flow.stop();await pool.end();}
}
