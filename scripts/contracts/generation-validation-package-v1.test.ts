import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
import {ok,denied} from './generation-validation-fixture-v1';
import {buildGenerationStagingPackageV1} from '../security/generation-staging-package/build.mjs';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const preflight=readFileSync(new URL('../security/generation-staging-package/preflight.readonly.sql',import.meta.url),'utf8');
function graphReader(){
  const source=readFileSync(new URL('../../docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql',import.meta.url),'utf8');
  const start=source.indexOf('CREATE OR REPLACE FUNCTION public.adaptive_nutrition_read_graph_v2(');
  const fallback=source.indexOf('CREATE FUNCTION public.adaptive_nutrition_read_graph_v2(');
  const begin=start>=0?start:fallback,end=source.indexOf('$function$;',begin);assert.ok(begin>=0&&end>begin);return source.slice(begin,end+12);
}
test('four pinned source extensions install together, rollback together and preserve least privilege',{skip:!native},async t=>{
  await installGenerationRuntimeSourceFixtureV1();
  // Minimal synthetic readback relation shapes; actual read_graph body is reused.
  ok(`BEGIN;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    ALTER TABLE public.user_goals ADD COLUMN goal_type text;
    ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 ADD COLUMN proposed_plan_revision uuid,
      ADD COLUMN generated_operation_id uuid,ADD COLUMN activation_operation_id uuid;
    CREATE TABLE public.adaptive_nutrition_operations(operation_id uuid PRIMARY KEY,user_id uuid,selection_id uuid,action_type text,outcome text,
      canonical_request bytea,result_canonical bytea,result_digest bytea,result_plan_revision uuid,result_graph_digest bytea,result_references jsonb);
    CREATE TABLE public.adaptive_nutrition_graph_revisions(user_id uuid,selection_id uuid,plan_revision uuid PRIMARY KEY,graph_contract text,graph_contract_version smallint,
      content_digest bytea,graph_snapshot jsonb,graph_canonical_bytes bytea,generated_week_plan_digest bytea,generation_input_digest bytea,generation_operation_id uuid,activation_operation_id uuid);
    ${graphReader()}
    REVOKE ALL ON public.adaptive_nutrition_operations,public.adaptive_nutrition_graph_revisions FROM PUBLIC,anon,authenticated,service_role;
    COMMIT;`);
  const before=JSON.parse(ok(preflight));assert.equal(before.extensionBaselineReady,true);assert.equal(before.mayApply,false);
  const bundle=buildGenerationStagingPackageV1(),inspect=`
    DO $post$ BEGIN
      IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition'
        AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE'))<>4 THEN RAISE EXCEPTION 'BAD_READER_ALLOWLIST'; END IF;
      IF NOT has_function_privilege('authenticated','public.adaptive_nutrition_read_generation_plan_v2(uuid)','EXECUTE')
        OR has_function_privilege('anon','public.adaptive_nutrition_read_generation_plan_v2(uuid)','EXECUTE')
        OR has_function_privilege('service_role','public.adaptive_nutrition_read_generation_plan_v2(uuid)','EXECUTE') THEN RAISE EXCEPTION 'BAD_READBACK_ACL'; END IF;
      IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_nutrition'
        AND c.relname IN('generation_preparation_sources_v1','generation_preparation_source_revocations_v1') AND c.relrowsecurity AND c.relforcerowsecurity)<>2
        THEN RAISE EXCEPTION 'BAD_SOURCE_RLS'; END IF;
    END $post$;
  `;
  await t.test('all four candidates compose without altering any source body and rollback leaves the original baseline',()=>{
    ok(bundle.rollbackSql.replace(/ROLLBACK;\n$/,inspect+'ROLLBACK;\n'));
    assert.deepEqual(JSON.parse(ok(preflight)),before);
  });
  await t.test('a late goal-reader prerequisite failure rolls back earlier preparation and producer objects',()=>{
    const marker='-- Pinned source: docs/premium/drafts/generation_goal_preparation_source_v1.sql';
    const broken=bundle.rollbackSql.replace(marker,'ALTER TABLE public.user_goals DROP COLUMN goal_type;\n'+marker);
    denied(broken,/GOAL_PREPARATION_GOAL_TYPE_COLUMN_REQUIRED/);assert.deepEqual(JSON.parse(ok(preflight)),before);
  });
  await t.test('native-only commit rehearsal creates empty tables and the exact reader and readback grants',()=>{
    // Fixed loopback fixture helper is the only executor; no live apply is exported by build.mjs.
    ok(bundle.rollbackSql.replace(/ROLLBACK;\n$/,inspect+'COMMIT;\n'));
    assert.equal(JSON.parse(ok(preflight)).extensionBaselineReady,false);
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_preparation_sources_v1;'),'0');
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_preparation_source_revocations_v1;'),'0');
    for(const role of ['anon','authenticated','service_role','potok_generation_reader_v1'])
      denied(`SET ROLE ${role}; SELECT * FROM potok_nutrition.generation_preparation_sources_v1;`,/permission denied/);
    denied(bundle.rollbackSql,/PREPARATION_SOURCE_ALREADY_INSTALLED/);
  });
});
