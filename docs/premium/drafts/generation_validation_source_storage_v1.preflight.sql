-- Read-only readiness for generation_validation_source_storage_v1.sql. No DDL or data access.
WITH expected(signature,body_md5,is_definer,volatility) AS (VALUES
 ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,'s'),
 ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false,'v'),
 ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'v'),
 ('potok_nutrition.require_canonical_json_v2(bytea)','4453774aeecef9584fb2f0312e30ef83',false,'s'),
 ('potok_nutrition.canonical_jsonb_text_v1(jsonb)','971923fd16799732f89f0f23782f984c',false,'i'),
 ('potok_nutrition.json_has_duplicate_keys_v1(json)','24924ecda9f7d1d0c5284c928c6805af',false,'i')
), checks(label,ok) AS (
 SELECT 'owner_utf8',current_user='postgres' AND session_user='postgres' AND current_setting('server_encoding')='UTF8'
 UNION ALL
 SELECT signature,COALESCE(md5(p.prosrc)=e.body_md5 AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=e.is_definer AND p.provolatile::text=e.volatility,false)
 FROM expected e LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(e.signature)
 UNION ALL
 SELECT 'source_objects_absent',pg_catalog.to_regrole('potok_generation_reader_v1') IS NULL
   AND NOT EXISTS(SELECT FROM (VALUES ('potok_nutrition.generation_validation_inputs_v1'),('potok_nutrition.generation_validation_warnings_v1'),('potok_nutrition.generation_validation_receipt_bindings_v1'),('potok_nutrition.generation_validation_receipt_revocations_v1')) t(name) WHERE pg_catalog.to_regclass(t.name) IS NOT NULL)
   AND NOT EXISTS(SELECT FROM (VALUES
    ('potok_nutrition.validation_store_json_has_duplicates_v1(json)'),
    ('potok_nutrition.validation_store_insert_binding_v1()'),
    ('potok_nutrition.validation_store_immutable_v1()'),
    ('potok_nutrition.read_generation_validation_source_v1(uuid,bytea)'),
    ('potok_nutrition.guard_generation_receipt_insert_v1()'),
    ('potok_nutrition.guard_generation_receipt_revocation_v1()'),
    ('potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)')
   ) f(signature) WHERE pg_catalog.to_regprocedure(f.signature) IS NOT NULL)
 UNION ALL
 SELECT 'source_foundation_tables_present',NOT EXISTS(SELECT FROM (VALUES
  ('potok_nutrition.adaptive_nutrition_generation_requests_v2'),
  ('potok_nutrition.adaptive_nutrition_candidate_manifests_v2'),
  ('potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2'),
  ('potok_nutrition.nutrition_authority_heads_v1'),('potok_nutrition.nutrition_preference_snapshots_v1'),
  ('potok_nutrition.nutrition_safety_snapshots_v1'),('potok_nutrition.adaptive_nutrition_generation_policy_head_v2'),
  ('potok_control.access_attestations'),('public.user_goals'),('public.user_premium_plan_selections')
 ) t(name) WHERE pg_catalog.to_regclass(t.name) IS NULL)
 UNION ALL
 SELECT 'no_public_internal_execute',NOT EXISTS(SELECT FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  WHERE n.nspname='potok_nutrition' AND a.grantee=0 AND a.privilege_type='EXECUTE')
)
SELECT pg_catalog.jsonb_build_object('ready_for_install',pg_catalog.bool_and(ok),
 'checks',pg_catalog.jsonb_object_agg(label,ok)) AS readiness FROM checks;
