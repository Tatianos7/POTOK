import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Pool} from 'pg';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
import {ok,denied,literal,binary,hex,hash} from './generation-validation-fixture-v1';
import {generationPreparationMetadataFixtureV1} from '../../src/server/__tests__/generationPreparationSqlFixturesV1';
import {id} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';
import {encodeAdaptiveNutritionGraphCanonicalV2} from '../../src/utils/adaptiveNutritionGraphV2';
import {decodeGenerationPlanReadbackV2} from '../../src/services/generationPlanReadbackV2';
import {adaptGenerationNodePgPoolV1} from '../../src/server/generationNodePgPoolV1';
import {createGenerationTransactionClientV1,type GenerationTransactionPoolV1} from '../../src/server/generationTransactionClientV1';
import {createRestrictedGenerationSqlGatewayV1,restrictedGenerationRecordSqlV1,restrictedGenerationActivateSqlV1} from '../../src/server/generationSqlGatewayV1';

const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const read=(name:string)=>readFileSync(new URL('../../docs/premium/drafts/'+name,import.meta.url),'utf8');
const persistence=read('20260921_adaptive_nutrition_persistence_v1.sql');
const graph=read('20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql');
const protectedSql=read('20260930_adaptive_nutrition_protected_execution_binding_v1.sql');
function section(source:string,start:string,end:string){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`missing retained SQL section: ${start}`);return source.slice(a,b);
}
function definition(source:string,name:string){
  const match=new RegExp('CREATE (?:OR REPLACE )?FUNCTION '+name.replaceAll('.','\\.')+'\\(').exec(source);
  assert.ok(match,`missing retained function: ${name}`);
  const end=source.indexOf('$function$;',match.index);assert.ok(end>match.index);
  return source.slice(match.index,end+12);
}
const innerNames=['potok_nutrition.record_generated_week_v2','potok_nutrition.activate_generated_week_v2'];
test('roundtrip fixture extracts retained writers and full operation/graph constraints without marker writers',()=>{
  for(const name of innerNames){
    const body=definition(protectedSql,name);
    assert.match(body,/SECURITY INVOKER/);assert.match(body,/CURRENT_USER <> 'postgres'/);
    assert.match(body,/INSERT INTO public.adaptive_nutrition_operations/);
    assert.doesNotMatch(body,/\$stub\$|fence_activation_fixture/);
  }
  assert.match(section(persistence,'CREATE TABLE public.adaptive_nutrition_operations (','CREATE TABLE public.adaptive_nutrition_events ('),/DEFERRABLE INITIALLY DEFERRED/);
  assert.match(section(graph,'ALTER TABLE public.adaptive_nutrition_operations\n','CREATE FUNCTION potok_nutrition.reject_immutable_change_v2()'),/adaptive_nutrition_graph_revisions_v2_activation_operation_fk/);
});

// Fixed loopback synthetic authorities/accounts/manifest relation; actual retained
// inner writers, outer gateways, storage constraints, immutable guards and reader.
// No hosted connection, real Auth, real recipe admission or generator activation.
test('native restricted gateway writes, activates and reads an actual Graph V2',{skip:!native},async t=>{
  const {f,input,request,account,inputInsert,warningInsert}=await installGenerationRuntimeSourceFixtureV1();
  const planRaw=canonicalJsonV1(f.plan,'SAFE_INTEGER'),planHex=hex(planRaw);
  ok(read('generation_preparation_source_v1.sql'));ok(read('generation_producer_sources_v1.sql'));
  ok(`BEGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES(${account});
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    ALTER TABLE public.user_premium_plan_selections ADD UNIQUE(user_id,id),ADD COLUMN updated_at timestamptz;
    ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2
      ADD COLUMN request_idempotency_key uuid,ADD COLUMN attempt_operation_id uuid,ADD COLUMN attempt_idempotency_key uuid,
      ADD COLUMN record_idempotency_key uuid,ADD COLUMN activation_idempotency_key uuid,ADD COLUMN proposed_plan_revision uuid,
      ADD COLUMN reason_code text,ADD COLUMN generated_operation_id uuid,ADD COLUMN activation_operation_id uuid,
      ADD COLUMN created_at timestamptz,ADD COLUMN updated_at timestamptz;
    UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET
      request_idempotency_key=${literal(id(910))},attempt_operation_id=${literal(id(911))},attempt_idempotency_key=${literal(id(914))},
      record_idempotency_key=${literal(id(912))},activation_idempotency_key=${literal(id(913))},
      proposed_plan_revision=${literal(f.plan.proposedPlanRevision)};
    ${section(persistence,'CREATE TABLE public.adaptive_nutrition_operations (','CREATE TABLE public.adaptive_nutrition_events (')}
    ${section(persistence,'CREATE TABLE public.adaptive_nutrition_events (','ALTER TABLE public.food_diary_entries')}
    ${section(graph,'ALTER TABLE public.adaptive_nutrition_operations\n','CREATE FUNCTION potok_nutrition.reject_immutable_change_v2()')}
    ${section(persistence,'CREATE FUNCTION potok_nutrition.reject_immutable_change_v1()','ALTER TABLE public.adaptive_nutrition_graph_revisions ENABLE ROW LEVEL SECURITY;')}
    ${definition(read('20260921_adaptive_nutrition_runtime_activation_v1.sql'),'potok_nutrition.jsonb_has_exact_keys_v1')}
    CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2(
      manifest_revision uuid NOT NULL REFERENCES potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision),
      recipe_id uuid NOT NULL,recipe_revision_id uuid NOT NULL,portion_revision_id uuid NOT NULL,
      eligibility_revision_id uuid NOT NULL,recipe_snapshot jsonb NOT NULL,
      PRIMARY KEY(manifest_revision,recipe_id,recipe_revision_id,portion_revision_id,eligibility_revision_id));
    ${innerNames.map(name=>definition(protectedSql,name)).join('\n')}
    ${['generation_request_status_json_v2','settle_generation_request_failure_v2','load_generation_request_v2',
      'record_generated_week_gateway_v2','activate_generated_week_gateway_v2'].map(name=>definition(protectedSql,'potok_nutrition.'+name)).join('\n')}
    ${definition(graph,'public.adaptive_nutrition_read_graph_v2')}
    REVOKE ALL ON FUNCTION public.adaptive_nutrition_read_graph_v2(uuid,uuid,text) FROM PUBLIC,anon,service_role;
    GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_read_graph_v2(uuid,uuid,text) TO authenticated;
    CREATE ROLE potok_generation_gateway_v1 LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'graph-disposable-only';
    REVOKE ALL ON ALL TABLES IN SCHEMA public,auth,potok_nutrition,potok_control FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1,potok_generation_gateway_v1;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_nutrition FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1,potok_generation_gateway_v1;
    GRANT USAGE ON SCHEMA potok_nutrition TO potok_generation_gateway_v1;
    GRANT EXECUTE ON FUNCTION potok_nutrition.load_generation_request_v2(uuid),potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),
      potok_nutrition.activate_generated_week_gateway_v2(uuid) TO potok_generation_gateway_v1;
    ALTER TABLE public.adaptive_nutrition_operations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.adaptive_nutrition_graph_revisions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.adaptive_nutrition_events ENABLE ROW LEVEL SECURITY;
    ${inputInsert()}
    ${warningInsert(f.warningRaw,hash(planRaw))}
    INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
      SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1;
    INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,proposal_raw_sha256,source_storage_sha256)
      SELECT source_receipt_ref,request_operation_id,${account},'WARNINGS',proposal_raw_sha256,warning_storage_sha256 FROM potok_nutrition.generation_validation_warnings_v1;
    COMMIT;`);
  // Manifest relation is deliberately reduced to the columns actually queried by
  // retained writers. This does not exercise the full manifest publisher schema.
  for(const e of f.context.manifest.entries)ok(`INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 VALUES(
    ${literal(f.context.manifest.manifestRevision)},${literal(e.recipeId)},${literal(e.recipeRevisionId)},${literal(e.portionRevisionId)},
    ${literal(e.eligibilityRevisionId)},${literal(JSON.stringify(e.recipeSnapshot))}::jsonb);`);
  const source=(ref:string,kind:string,raw:string)=>{
    const b=JSON.parse(raw);
    ok(`INSERT INTO potok_nutrition.generation_preparation_sources_v1(source_ref,request_operation_id,account_id,source_kind,
      generation_input_digest,validation_evidence_digest,validation_policies_digest,slot_id,meal_snapshot_digest,payload_raw)
      VALUES(${literal(ref)},${request},${account},${literal(kind)},${binary(f.evidence.generationInputDigest)},${binary(f.evidence.digest)},
      ${binary(JSON.parse(f.policiesRaw).digest)},${kind==='METADATA'?'NULL':literal(b.slotId)},
      ${kind==='METADATA'?'NULL':binary(b.mealSnapshotDigest)},${literal(raw)});`);
  };
  source('synthetic-only:metadata','METADATA',generationPreparationMetadataFixtureV1(f));
  JSON.parse(f.warningRaw).entries.forEach((e:unknown,i:number)=>source('synthetic-only:meal-'+i,'MEAL_WARNING',JSON.stringify(e)));
  ok(read('generation_source_commit_fence_v1.sql'));ok(read('generation_plan_readback_v2.sql'));
  const role='SET LOCAL ROLE potok_generation_gateway_v1;';
  const load=`SELECT potok_nutrition.load_generation_request_v2(${request});`;
  const record=`SELECT potok_nutrition.record_generated_week_gateway_v2(${request},${binary(planHex)});`;
  const activate=`SELECT potok_nutrition.activate_generated_week_gateway_v2(${request});`;
  const actor=`SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub=${account};`;
  const readMenu=`SELECT public.adaptive_nutrition_read_generation_plan_v2(${request});`;
  const counts=`SELECT (SELECT count(*) FROM public.adaptive_nutrition_operations WHERE action_type='PLAN_GENERATED_V2')||','||
    (SELECT count(*) FROM public.adaptive_nutrition_operations WHERE action_type='PLAN_ACTIVATED_V2')||','||
    (SELECT count(*) FROM public.adaptive_nutrition_graph_revisions)||','||(SELECT count(*) FROM public.adaptive_nutrition_events);`;
  const baseline=ok(counts);assert.equal(baseline,'0,0,0,0');
  await t.test('graph/operation constraints and immutable guards are retained',()=>{
    assert.equal(ok(`SELECT count(*) FROM pg_constraint WHERE conname IN ('adaptive_nutrition_operations_terminal_check',
      'adaptive_nutrition_graph_revisions_v2_shape_check','adaptive_nutrition_graph_revisions_v2_activation_operation_fk',
      'user_premium_plan_selections_graph_head_fk');`),'4');
    assert.equal(ok("SELECT count(*) FROM pg_trigger WHERE tgname IN ('potok_graph_revisions_immutable_v1','potok_operations_update_guard_v1','potok_operations_delete_guard_v1') AND tgenabled='O';"),'3');
  });
  await t.test('actual writer rejects corrupted graph digest without any partial write',()=>{
    const wrong=canonicalJsonV1({...f.plan,graphDigest:'f'.repeat(64)},'SAFE_INTEGER');
    denied(`SELECT potok_nutrition.record_generated_week_v2(${account},${literal(f.plan.selectionId)},${literal(id(912))},
      ${binary(hex(canonicalJsonV1(input,'SAFE_INTEGER')))},${binary(hex(wrong))});`,/generated week binding\/digest mismatch/);
    assert.equal(ok(counts),baseline);
  });
  await t.test('revocation before recording blocks the real writer and leaves graph empty',()=>{
    const lines=ok('BEGIN;'+role+load+'RESET ROLE;'+
      "INSERT INTO potok_nutrition.generation_preparation_source_revocations_v1(source_ref,reason_ref) VALUES('synthetic-only:meal-0','synthetic-only:withdrawal');"+
      role+record+'RESET ROLE;'+counts+'ROLLBACK;').split('\n');
    assert.equal(JSON.parse(lines[1]).status,'REJECTED');assert.equal(lines[2],baseline);
  });
  await t.test('late activation error rolls back operation and graph together, preserving generation receipt',()=>{
    const lines=ok('BEGIN;'+role+load+record+'RESET ROLE;'+`
      CREATE FUNCTION potok_nutrition.fail_graph_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_LATE_GRAPH_FAILURE' USING ERRCODE='22023'; END $$;
      CREATE TRIGGER fail_graph_fixture BEFORE INSERT ON public.adaptive_nutrition_graph_revisions FOR EACH ROW EXECUTE FUNCTION potok_nutrition.fail_graph_fixture();`+
      role+activate+'RESET ROLE;'+counts+"SELECT status FROM public.user_premium_plan_selections;ROLLBACK;").split('\n');
    assert.equal(JSON.parse(lines[1]).status,'GENERATED');assert.equal(JSON.parse(lines[2]).status,'REJECTED');
    assert.equal(lines[3],'1,0,0,0');assert.equal(lines[4],'pending_generation');
  });
  await t.test('revocation after recording prevents activation without altering its settled receipt',()=>{
    const lines=ok('BEGIN;'+role+load+record+'RESET ROLE;'+
      "INSERT INTO potok_nutrition.generation_validation_receipt_revocations_v1(receipt_ref,reason_ref) VALUES('synthetic-only:warnings','synthetic-only:withdrawal');"+
      role+activate+'RESET ROLE;'+counts+'ROLLBACK;').split('\n');
    assert.equal(JSON.parse(lines[2]).status,'REJECTED');assert.equal(lines[3],'1,0,0,0');
  });
  const base={host:'127.0.0.1',port:5432,database:'potok_generation_store_disposable',ssl:false as const,
    connectionTimeoutMillis:3000,statement_timeout:5000,max:2};
  const adapter=adaptGenerationNodePgPoolV1<{result_raw:unknown}>(new Pool({...base,user:'potok_generation_gateway_v1',password:'graph-disposable-only'}),()=>true);
  const tx=createGenerationTransactionClientV1(adapter,()=>true);
  const gateway=createRestrictedGenerationSqlGatewayV1(tx,()=>true);
  // Fault injection follows an actual successful server COMMIT. It does not
  // emulate PostgreSQL's write or manufacture a receipt in TypeScript.
  const lostReplyPool:GenerationTransactionPoolV1<{result_raw:unknown}>={async acquire(){
    const lease=await adapter.acquire();return {release:discard=>lease.release(discard),async query(sql,params){
      const result=await lease.query(sql,params);if(sql==='COMMIT')throw Error('SYNTHETIC_REPLY_DROPPED');return result;
    }};
  }};
  try{
    await t.test('real narrow TCP login loads the request and records one actual generation despite lost COMMIT reply',async()=>{
      const loaded=await gateway.rpc<{status:string}>('load_generation_request_v2',{p_request_operation_id:input.operation.requestId});
      assert.equal(loaded.error,null);assert.equal(loaded.data?.status,'GENERATING');
      await assert.rejects(createGenerationTransactionClientV1(lostReplyPool,()=>true).query(restrictedGenerationRecordSqlV1,[input.operation.requestId,planHex]),/GENERATION_SQL_COMMIT_UNKNOWN/);
      assert.equal(ok(counts),'1,0,0,0');
      const replay=await gateway.rpc<{status:string}>('record_generated_week_gateway_v2',{
        p_request_operation_id:input.operation.requestId,p_generated_week_plan_canonical:'\\x'+planHex});
      assert.equal(replay.error,null);assert.equal(replay.data?.status,'GENERATED');assert.equal(ok(counts),'1,0,0,0');
      assert.equal(JSON.parse(ok('BEGIN;'+actor+readMenu+'ROLLBACK;')).kind,'not_ready');
    });
    await t.test('activation persists canonical Graph V2 and current head despite lost reply; replay is idempotent',async()=>{
      await assert.rejects(createGenerationTransactionClientV1(lostReplyPool,()=>true).query(restrictedGenerationActivateSqlV1,[input.operation.requestId]),/GENERATION_SQL_COMMIT_UNKNOWN/);
      assert.equal(ok(counts),'1,1,1,0');
      const before=ok("SELECT md5(string_agg(row_to_json(o)::text,',' ORDER BY operation_id)) FROM public.adaptive_nutrition_operations o;");
      const replay=await gateway.rpc<{status:string}>('activate_generated_week_gateway_v2',{p_request_operation_id:input.operation.requestId});
      assert.equal(replay.error,null);assert.equal(replay.data?.status,'ACTIVE');assert.equal(ok(counts),'1,1,1,0');
      assert.equal(ok("SELECT md5(string_agg(row_to_json(o)::text,',' ORDER BY operation_id)) FROM public.adaptive_nutrition_operations o;"),before);
      assert.equal(ok('SELECT encode(graph_canonical_bytes,\'hex\') FROM public.adaptive_nutrition_graph_revisions;'),hex(await encodeAdaptiveNutritionGraphCanonicalV2(f.plan.graph)));
    });
    await t.test('authenticated SQL readback passes the real client decoder with identical graph and digest',async()=>{
      const response=JSON.parse(ok('BEGIN READ ONLY;'+actor+readMenu+'ROLLBACK;'));
      const decoded=await decodeGenerationPlanReadbackV2(response,input.accountId,input.operation.requestId);
      assert.equal(decoded.kind,'ready');assert.deepEqual(response.graph,f.plan.graph);assert.equal(response.graph_digest_hex,f.plan.graphDigest);
      assert.equal(ok(counts),'1,1,1,0');
    });
    await t.test('foreign account, revoked entitlement and absent identity do not reveal the stored menu',()=>{
      assert.equal(JSON.parse(ok('BEGIN;SET LOCAL ROLE authenticated;'+readMenu+'ROLLBACK;')).kind,'denied');
      assert.equal(JSON.parse(ok(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub=${literal(id(999))};`+readMenu+'ROLLBACK;')).kind,'denied');
      assert.equal(JSON.parse(ok("BEGIN;UPDATE potok_control.access_attestations SET valid_until=statement_timestamp()-interval '1 minute';"+actor+readMenu+'ROLLBACK;')).kind,'denied');
      assert.equal(JSON.parse(ok(`BEGIN;INSERT INTO potok_control.access_attestations VALUES(${literal(id(995))},${literal(id(999))},'premium','GRANT',NULL,1,statement_timestamp()-interval '1 hour',NULL);
        SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub=${literal(id(999))};`+readMenu+'ROLLBACK;')).kind,'not_found');
    });
    await t.test('retired selection hides the menu and readback changes no stored bytes',()=>{
      const before=ok("SELECT md5(string_agg(row_to_json(g)::text,',' ORDER BY plan_revision)) FROM public.adaptive_nutrition_graph_revisions g;");
      assert.equal(JSON.parse(ok("BEGIN;UPDATE public.user_premium_plan_selections SET status='retired';"+actor+readMenu+'ROLLBACK;')).kind,'unavailable');
      assert.equal(JSON.parse(ok('BEGIN READ ONLY;'+actor+readMenu+'ROLLBACK;')).kind,'ready');
      assert.equal(ok("SELECT md5(string_agg(row_to_json(g)::text,',' ORDER BY plan_revision)) FROM public.adaptive_nutrition_graph_revisions g;"),before);
    });
    await t.test('clients cannot call inner writers or directly read persisted graph; settled history rejects mutation',()=>{
      for(const r of ['anon','authenticated','service_role','potok_generation_reader_v1','potok_generation_gateway_v1']){
        denied(`SET ROLE ${r};SELECT * FROM public.adaptive_nutrition_graph_revisions;`,/permission denied/);
        denied(`SET ROLE ${r};SELECT potok_nutrition.activate_generated_week_v2(${literal(id(1))},${literal(id(2))},NULL);`,/permission denied/);
      }
      denied("UPDATE public.adaptive_nutrition_graph_revisions SET graph_snapshot='{}';",/append-only/);
      denied("UPDATE public.adaptive_nutrition_operations SET result_references='{}' WHERE action_type='PLAN_GENERATED_V2';",/immutable after settlement/);
      assert.equal(ok(counts),'1,1,1,0');
    });
  }finally{await adapter.close();}
});
