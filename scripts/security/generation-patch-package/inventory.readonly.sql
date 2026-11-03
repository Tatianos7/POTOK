-- SELECT-only phase check. Metadata only; no business records or credentials.
WITH expected(signature,before_md5,after_md5,is_definer) AS (VALUES
 ('potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)','4003e0d14be85823416df7f13434578e','98b5935bf836a156c238d4d33c4bfc9c',false),
 ('potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)','ab2c111ce26a57c96cdd92902d578632','d129cca519547879f971e6b35e4250d2',false),
 ('potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)','bc354a26e7b84becdc7711f39f646a9d','bfcafea20b1cdc01593862d318b40c46',true),
 ('potok_nutrition.activate_generated_week_gateway_v2(uuid)','6e9cf35c74c3c301b4ad86e3425ca05a','281296964de33b965445dee62a6a23f8',true),
 ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98','d47092345fb1a684eae62bd457ce8a98',false),
 ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387','0a7fc0c24f7bc22f6792781636ac2387',false),
 ('potok_nutrition.guard_generation_receipt_revocation_v1()','67e93b80c68506c16e2ca8386bc5c10a','67e93b80c68506c16e2ca8386bc5c10a',false),
 ('potok_nutrition.guard_generation_producer_revocation_v1()','66bcd181904a69fe3bd33c657a273fce','66bcd181904a69fe3bd33c657a273fce',false)
),allowlist(role_name,signature) AS (VALUES
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)'),
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)'),
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)'),
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)'),
 ('potok_generation_gateway_v1','potok_nutrition.load_generation_request_v2(uuid)'),
 ('potok_generation_gateway_v1','potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)'),
 ('potok_generation_gateway_v1','potok_nutrition.activate_generated_week_gateway_v2(uuid)')
),functions AS (
 SELECT e.*,p.oid,p.prosrc,COALESCE(pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef=e.is_definer
   AND p.provolatile='v' AND p.proconfig=ARRAY['search_path=pg_catalog'],false) AS attributes
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
),checks(label,ok) AS (
 SELECT 'owner_utf8',current_user='postgres' AND session_user='postgres' AND current_setting('server_encoding')='UTF8'
 UNION ALL SELECT 'function_attributes',COALESCE((SELECT bool_and(attributes) FROM functions),false)
 UNION ALL SELECT 'restricted_roles',count(*)=2 AND bool_and(rolcanlogin AND rolconnlimit=2 AND NOT rolsuper AND NOT rolbypassrls
   AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
   AND NOT EXISTS(SELECT FROM pg_auth_members m WHERE m.member=r.oid))
 FROM pg_roles r WHERE rolname IN('potok_generation_reader_v1','potok_generation_gateway_v1')
 UNION ALL SELECT 'exact_worker_function_allowlists',COALESCE(bool_and(
   EXISTS(SELECT FROM pg_roles WHERE rolname=a.role_name) AND to_regprocedure(a.signature) IS NOT NULL
   AND has_function_privilege(to_regrole(a.role_name),to_regprocedure(a.signature),'EXECUTE')
   AND (SELECT count(*) FROM allowlist x WHERE x.role_name=a.role_name)=
     (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='potok_nutrition' AND has_function_privilege(to_regrole(a.role_name),p.oid,'EXECUTE'))),false) FROM allowlist a
 UNION ALL SELECT 'inner_writers_private',COALESCE(bool_and(NOT EXISTS(
   SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner)),false)
 FROM functions f JOIN pg_proc p ON p.oid=f.oid WHERE f.signature IN(
   'potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)','potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)')
 UNION ALL SELECT 'gateway_client_denials',COALESCE(bool_and(NOT has_function_privilege(to_regrole(r.role_name),f.oid,'EXECUTE')),false)
 FROM functions f CROSS JOIN (VALUES ('anon'),('authenticated'),('potok_generation_reader_v1')) r(role_name)
 WHERE f.signature IN('potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)','potok_nutrition.activate_generated_week_gateway_v2(uuid)')
 UNION ALL SELECT 'worker_table_sequence_denials',NOT EXISTS(
   SELECT FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE r.rolname IN('potok_generation_reader_v1','potok_generation_gateway_v1')
   AND n.nspname IN('public','potok_nutrition','potok_control','potok_food_evidence','potok_nonfood','potok_delivery')
   AND c.relkind IN('r','p','v','m','S','f') AND CASE WHEN c.relkind='S'
   THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE')
   ELSE has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END)
 UNION ALL SELECT 'private_source_rls',count(*)=6 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='postgres')
 FROM (VALUES ('generation_validation_inputs_v1'),('generation_validation_warnings_v1'),('generation_validation_receipt_bindings_v1'),
   ('generation_validation_receipt_revocations_v1'),('generation_preparation_sources_v1'),('generation_preparation_source_revocations_v1')) e(name)
 JOIN pg_namespace n ON n.nspname='potok_nutrition' JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name AND c.relkind='r'
 UNION ALL SELECT 'revocation_insert_guards',count(*)=2 AND bool_and(t.tgtype=7 AND t.tgenabled='O'
   AND t.tgfoid=to_regprocedure(e.signature))
 FROM (VALUES
   ('potok_nutrition.generation_validation_receipt_revocations_v1','receipt_revocation_insert','potok_nutrition.guard_generation_receipt_revocation_v1()'),
   ('potok_nutrition.generation_preparation_source_revocations_v1','preparation_revocation_insert','potok_nutrition.guard_generation_producer_revocation_v1()')
 ) e(relation,name,signature) JOIN pg_trigger t ON t.tgrelid=to_regclass(e.relation) AND t.tgname=e.name
 UNION ALL SELECT 'graph_operation_constraints',count(*)=6 AND bool_and(c.convalidated)
 FROM (VALUES
   ('public.adaptive_nutrition_graph_revisions','adaptive_nutrition_graph_revisions_v2_shape_check'),
   ('public.adaptive_nutrition_graph_revisions','adaptive_nutrition_graph_revisions_v2_activation_operation_fk'),
   ('public.adaptive_nutrition_graph_revisions','adaptive_nutrition_graph_revisions_v2_generation_operation_fk'),
   ('public.adaptive_nutrition_operations','adaptive_nutrition_operations_terminal_check'),
   ('public.adaptive_nutrition_operations','adaptive_nutrition_operations_v2_result_check'),
   ('public.user_premium_plan_selections','user_premium_plan_selections_graph_head_fk')
 ) e(relation,name) JOIN pg_constraint c ON c.conrelid=to_regclass(e.relation) AND c.conname=e.name
 UNION ALL SELECT 'immutable_storage_guards',count(*)=3 AND bool_and(t.tgenabled='O' AND t.tgfoid=to_regprocedure(e.signature) AND t.tgtype=e.type)
 FROM (VALUES
   ('public.adaptive_nutrition_graph_revisions','potok_graph_revisions_immutable_v1','potok_nutrition.reject_immutable_change_v1()',58),
   ('public.adaptive_nutrition_operations','potok_operations_update_guard_v1','potok_nutrition.protect_operation_receipt_v1()',19),
   ('public.adaptive_nutrition_operations','potok_operations_delete_guard_v1','potok_nutrition.reject_immutable_change_v1()',42)
 ) e(relation,name,signature,type) JOIN pg_trigger t ON t.tgrelid=to_regclass(e.relation) AND t.tgname=e.name
),summary AS (
 SELECT COALESCE(bool_and(ok),false) AS common_ok,jsonb_object_agg(label,COALESCE(ok,false)) AS checks FROM checks
),phase AS (
 SELECT COALESCE(bool_and(attributes AND md5(prosrc)=before_md5),false) AS baseline_functions,
   COALESCE(bool_and(attributes AND md5(prosrc)=after_md5),false) AS installed_functions FROM functions
),helper AS (
 SELECT to_regprocedure('potok_nutrition.assert_generation_source_current_v1(uuid,bytea)') IS NULL AS absent,
 EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('potok_nutrition.assert_generation_source_current_v1(uuid,bytea)')
   AND md5(p.prosrc)='8f21e4dee280189a349a37b868b90eb9' AND NOT p.prosecdef AND p.provolatile='v'
   AND pg_get_userbyid(p.proowner)='postgres' AND p.proconfig=ARRAY['search_path=pg_catalog']
   AND NOT EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner)) AS valid
)
SELECT jsonb_build_object('contract','potok-generation-patch-inventory-v1','scope','METADATA_ONLY',
 'baselineReady',common_ok AND baseline_functions AND absent,'installedReady',common_ok AND installed_functions AND valid,
 'checks',checks,'baselineFunctions',baseline_functions,'installedFunctions',installed_functions,
 'helperAbsent',absent,'helperValid',valid,'mayApply',false,'mayActivate',false) AS readiness FROM summary,phase,helper;
