import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
import {ok,denied,literal} from './generation-validation-fixture-v1';
import {restrictedGenerationLoadSqlV1} from '../../src/server/generationSqlGatewayV1';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const candidate=readFileSync(new URL('../../docs/premium/drafts/generation_runtime_logins_v1.sql',import.meta.url),'utf8');
const probe=readFileSync(new URL('../security/generation-connection/probe.readonly.sql',import.meta.url),'utf8');
const read=(name:string)=>readFileSync(new URL('../../docs/premium/drafts/'+name,import.meta.url),'utf8');
function definition(name:string){
  const source=read('20260930_adaptive_nutrition_protected_execution_binding_v1.sql');
  const start=source.indexOf('CREATE FUNCTION potok_nutrition.'+name+'('),end=source.indexOf('$function$;',start);
  assert.ok(start>=0&&end>start);return source.slice(start,end+12);
}
// Fixed loopback disposable credentials only; never a hosted secret/login setup.
function login(role:string,sql:string,readOnly=false){
  assert.ok(['potok_generation_reader_v1','potok_generation_gateway_v1'].includes(role));
  return spawnSync('psql',['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5432','-U',role,'-d','potok_generation_store_disposable'],{
    input:sql,encoding:'utf8',maxBuffer:65536,env:{...process.env,PGPASSWORD:'generation-login-disposable-only',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5',PGOPTIONS:readOnly?'-c default_transaction_read_only=on':''},
  });
}
test('runtime login candidate and actual least-privilege TCP authentication',{skip:!native},async t=>{
  const {request}=await installGenerationRuntimeSourceFixtureV1();
  ok(read('generation_preparation_source_v1.sql'));ok(read('generation_producer_sources_v1.sql'));
  ok('ALTER TABLE public.user_goals ADD COLUMN goal_type text;');ok(read('generation_goal_preparation_source_v1.sql'));
  // Real retained gateway bodies; minimal synthetic relation shapes. No real plan is generated.
  ok(`ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 ADD COLUMN request_idempotency_key uuid,ADD COLUMN attempt_operation_id uuid,ADD COLUMN attempt_idempotency_key uuid,ADD COLUMN record_idempotency_key uuid,ADD COLUMN activation_idempotency_key uuid,ADD COLUMN proposed_plan_revision uuid,ADD COLUMN reason_code text,ADD COLUMN generated_operation_id uuid,ADD COLUMN activation_operation_id uuid,ADD COLUMN created_at timestamptz,ADD COLUMN updated_at timestamptz;
    CREATE TABLE public.adaptive_nutrition_operations(operation_id uuid PRIMARY KEY,user_id uuid,selection_id uuid,action_type text,outcome text,
    canonical_request bytea,request_digest bytea,result_canonical bytea,result_digest bytea,result_plan_revision uuid,result_graph_digest bytea,result_references jsonb);
    ${definition('load_generation_request_v2')}
    ${definition('record_generated_week_gateway_v2')}
    ${definition('activate_generated_week_gateway_v2')}
    REVOKE ALL ON FUNCTION potok_nutrition.load_generation_request_v2(uuid),potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),potok_nutrition.activate_generated_week_gateway_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION potok_nutrition.load_generation_request_v2(uuid),potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),potok_nutrition.activate_generated_week_gateway_v2(uuid) TO service_role;`);
  const unchanged=()=>{
    assert.equal(ok("SELECT NOT rolcanlogin FROM pg_roles WHERE rolname='potok_generation_reader_v1';"),'t');
    assert.equal(ok("SELECT to_regrole('potok_generation_gateway_v1') IS NULL;"),'t');
  };
  await t.test('function drift aborts before role creation; a late table-grant failure rolls back LOGIN and new role',()=>{
    denied('BEGIN;ALTER FUNCTION potok_nutrition.load_generation_request_v2(uuid) SET search_path=public;'+candidate,/FUNCTION_BASELINE_DRIFT/);unchanged();
    denied('BEGIN;GRANT SELECT ON public.user_goals TO potok_generation_reader_v1;'+candidate,/TABLE_ACCESS_POSTCHECK_FAILED/);unchanged();
  });
  ok(candidate);
  await t.test('seven existing function grants are partitioned four/three without role inheritance or table privileges',()=>{
    assert.equal(ok("SELECT count(*) FROM pg_roles WHERE rolname IN('potok_generation_reader_v1','potok_generation_gateway_v1') AND rolcanlogin AND rolconnlimit=2 AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication;"),'2');
    assert.equal(ok("SELECT count(*) FROM pg_auth_members WHERE member IN('potok_generation_reader_v1'::regrole,'potok_generation_gateway_v1'::regrole);"),'0');
    denied(candidate,/ALREADY_OR_PARTIALLY_INSTALLED/);
    const notProvisioned=login('potok_generation_gateway_v1','SELECT 1;');assert.notEqual(notProvisioned.status,0);assert.match(notProvisioned.stderr,/password authentication failed/);
  });
  ok("SET password_encryption='scram-sha-256';ALTER ROLE potok_generation_reader_v1 PASSWORD 'generation-login-disposable-only';ALTER ROLE potok_generation_gateway_v1 PASSWORD 'generation-login-disposable-only';");
  await t.test('real TCP passwords produce the exact session identities and all role/ACL probe checks; loopback is not TLS proof',()=>{
    for(const role of ['potok_generation_reader_v1','potok_generation_gateway_v1']){
      const result=login(role,probe,true);assert.equal(result.status,0,result.stderr.slice(0,500));const observation=JSON.parse(result.stdout.trim());
      assert.equal(observation.role,role);assert.equal(observation.connectionChecksPassed,false);assert.equal(observation.mayActivate,false);
      assert.equal(observation.checks.tls,false);
      for(const [label,value] of Object.entries(observation.checks))if(label!=='tls')assert.equal(value,true,label);
    }
  });
  await t.test('reader authentication reaches actual source-provenance gate instead of identity impersonation',()=>{
    const result=login('potok_generation_reader_v1',`SELECT potok_nutrition.read_admitted_generation_preparation_source_v1(${request});`);
    assert.notEqual(result.status,0);assert.match(result.stderr,/SOURCE_PROVENANCE_UNAVAILABLE/);assert.doesNotMatch(result.stderr,/GENERATION_READER_IDENTITY_REQUIRED/);
  });
  await t.test('restricted gateway TCP identity reaches the actual retained gateway; nonexistent request writes nothing',()=>{
    const sql=restrictedGenerationLoadSqlV1.replace('$1',literal('00000000-0000-4000-8000-000000000099'));
    const result=login('potok_generation_gateway_v1',sql);assert.notEqual(result.status,0);assert.match(result.stderr,/query returned no rows/);
    assert.equal(ok('SELECT count(*) FROM public.adaptive_nutrition_operations;'),'0');
  });
  await t.test('cross-channel function and direct table access remain denied after real authentication',()=>{
    for(const [role,signature] of [['potok_generation_reader_v1','potok_nutrition.load_generation_request_v2(uuid)'],
      ['potok_generation_gateway_v1','potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)']]){
      const r=login(role,`SELECT has_function_privilege(current_user,${literal(signature)},'EXECUTE');`);assert.equal(r.status,0);assert.equal(r.stdout.trim(),'f');
      const d=login(role,'SELECT * FROM public.user_goals;');assert.notEqual(d.status,0);assert.match(d.stderr,/permission denied/);
    }
  });
});
