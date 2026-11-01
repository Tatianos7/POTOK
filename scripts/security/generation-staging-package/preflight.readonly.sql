-- SELECT-only installation baseline. No application records or credentials are returned.
WITH expected(signature,body_md5,is_definer,volatility) AS (VALUES
 ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,'s'),
 ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false,'v'),
 ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'v'),
 ('potok_nutrition.require_canonical_json_v2(bytea)','4453774aeecef9584fb2f0312e30ef83',false,'s'),
 ('potok_nutrition.canonical_jsonb_text_v1(jsonb)','971923fd16799732f89f0f23782f984c',false,'i'),
 ('potok_nutrition.json_has_duplicate_keys_v1(json)','24924ecda9f7d1d0c5284c928c6805af',false,'i'),
 ('potok_nutrition.read_generation_validation_source_v1(uuid,bytea)','839a6130293d0e096299aad6ea1814ce',false,'s'),
 ('potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)','c12b5e1198160e7b3b9df7eeb8a6661f',true,'v'),
 ('public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)','5ba06a9f830157f70f406f78f7e63a76',true,'s')
), checks(label,ok) AS (
 SELECT 'owner_utf8',current_user='postgres' AND session_user='postgres' AND current_setting('server_encoding')='UTF8'
 UNION ALL
 SELECT signature,COALESCE(md5(p.prosrc)=e.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=e.is_definer AND p.provolatile::text=e.volatility,false)
 FROM expected e LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(e.signature)
 UNION ALL
 SELECT 'reader_role',EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname='potok_generation_reader_v1'
   AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
 UNION ALL
 SELECT 'reader_allowlist',COALESCE((SELECT array_agg(p.oid ORDER BY p.oid)=ARRAY[to_regprocedure('potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)')::oid]
   FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='potok_nutrition' AND EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname='potok_generation_reader_v1')
     AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE')),false)
 UNION ALL
 SELECT 'new_functions_absent',NOT EXISTS(SELECT FROM (VALUES
   ('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)'),
   ('potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)'),
   ('potok_nutrition.generation_producer_context_v1(uuid)'),('potok_nutrition.guard_generation_producer_source_v1()'),
   ('potok_nutrition.guard_generation_producer_revocation_v1()'),
   ('potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)'),
   ('public.adaptive_nutrition_read_generation_plan_v2(uuid)')) f(signature) WHERE to_regprocedure(f.signature) IS NOT NULL)
 UNION ALL
 SELECT 'new_tables_absent',to_regclass('potok_nutrition.generation_preparation_sources_v1') IS NULL
   AND to_regclass('potok_nutrition.generation_preparation_source_revocations_v1') IS NULL
 UNION ALL
 SELECT 'source_storage_rls',count(*)=4 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='postgres')
 FROM (VALUES ('generation_validation_inputs_v1'),('generation_validation_warnings_v1'),('generation_validation_receipt_bindings_v1'),('generation_validation_receipt_revocations_v1')) t(name)
 JOIN pg_catalog.pg_namespace n ON n.nspname='potok_nutrition' JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=t.name AND c.relkind='r'
 UNION ALL
 SELECT 'goal_columns',count(*)=3 FROM pg_catalog.pg_attribute a JOIN (VALUES ('user_id','uuid'),('goal_revision','uuid'),('goal_type','text')) e(name,type)
 ON a.attname=e.name AND pg_catalog.format_type(a.atttypid,a.atttypmod)=e.type
 WHERE a.attrelid=to_regclass('public.user_goals') AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL
 SELECT 'readback_columns',bool_and(EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid=to_regclass(e.relation)
   AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped AND pg_catalog.format_type(a.atttypid,a.atttypmod)=e.type))
 FROM (VALUES
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','request_operation_id','uuid'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','account_id','uuid'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','selection_id','uuid'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','status','text'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','proposed_plan_revision','uuid'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','generated_operation_id','uuid'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','activation_operation_id','uuid'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','generation_input_canonical','bytea'),
   ('potok_nutrition.adaptive_nutrition_generation_requests_v2','generation_input_digest','bytea'),
   ('public.adaptive_nutrition_operations','operation_id','uuid'),
   ('public.adaptive_nutrition_operations','user_id','uuid'),
   ('public.adaptive_nutrition_operations','selection_id','uuid'),
   ('public.adaptive_nutrition_operations','action_type','text'),
   ('public.adaptive_nutrition_operations','outcome','text'),
   ('public.adaptive_nutrition_operations','canonical_request','bytea'),
   ('public.adaptive_nutrition_operations','result_canonical','bytea'),
   ('public.adaptive_nutrition_operations','result_digest','bytea'),
   ('public.adaptive_nutrition_operations','result_plan_revision','uuid'),
   ('public.adaptive_nutrition_operations','result_graph_digest','bytea'),
   ('public.adaptive_nutrition_operations','result_references','jsonb'),
   ('public.adaptive_nutrition_graph_revisions','user_id','uuid'),
   ('public.adaptive_nutrition_graph_revisions','selection_id','uuid'),
   ('public.adaptive_nutrition_graph_revisions','plan_revision','uuid'),
   ('public.adaptive_nutrition_graph_revisions','graph_contract','text'),
   ('public.adaptive_nutrition_graph_revisions','graph_contract_version','smallint'),
   ('public.adaptive_nutrition_graph_revisions','content_digest','bytea'),
   ('public.adaptive_nutrition_graph_revisions','graph_snapshot','jsonb'),
   ('public.adaptive_nutrition_graph_revisions','graph_canonical_bytes','bytea'),
   ('public.adaptive_nutrition_graph_revisions','generated_week_plan_digest','bytea'),
   ('public.adaptive_nutrition_graph_revisions','generation_input_digest','bytea'),
   ('public.adaptive_nutrition_graph_revisions','generation_operation_id','uuid'),
   ('public.adaptive_nutrition_graph_revisions','activation_operation_id','uuid')
 ) e(relation,name,type)
 UNION ALL
 SELECT 'readback_tables',to_regclass('public.adaptive_nutrition_operations') IS NOT NULL
   AND to_regclass('public.adaptive_nutrition_graph_revisions') IS NOT NULL
   AND to_regclass('public.user_premium_plan_selections') IS NOT NULL
   AND to_regclass('potok_nutrition.adaptive_nutrition_generation_requests_v2') IS NOT NULL
)
SELECT jsonb_build_object('contract','potok-generation-staging-baseline-v1','scope','INSTALLATION_BASELINE_ONLY',
 'extensionBaselineReady',bool_and(ok),'mayApply',false,'activationReady',false,'checks',jsonb_object_agg(label,ok)) AS readiness FROM checks;
