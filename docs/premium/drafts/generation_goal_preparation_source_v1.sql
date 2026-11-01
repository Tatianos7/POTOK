-- REVIEW CANDIDATE ONLY. Requires PR267 storage and PR268 request-only reader.
-- Adds one private goal/context reader. No new table, writer, stored metadata seed or activation.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$
DECLARE expected record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'GOAL_PREPARATION_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'GOAL_PREPARATION_ALREADY_INSTALLED'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='potok_generation_reader_v1' AND NOT rolcanlogin
  AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
  OR NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)','EXECUTE')
  OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE')
   AND p.oid NOT IN(SELECT to_regprocedure(signature)::oid FROM (VALUES
    ('potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)'),
    ('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)'),
    ('potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)')) f(signature)
    WHERE to_regprocedure(signature) IS NOT NULL)) THEN
  RAISE EXCEPTION 'GOAL_PREPARATION_READER_BASELINE_MISMATCH';
 END IF;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,'s'),
  ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false,'v'),
  ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'v'),
  ('potok_nutrition.require_canonical_json_v2(bytea)','4453774aeecef9584fb2f0312e30ef83',false,'s'),
  ('potok_nutrition.canonical_jsonb_text_v1(jsonb)','971923fd16799732f89f0f23782f984c',false,'i'),
  ('potok_nutrition.json_has_duplicate_keys_v1(json)','24924ecda9f7d1d0c5284c928c6805af',false,'i')
 ) AS f(signature,body_md5,is_definer,volatility) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
   AND md5(p.prosrc)=expected.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=expected.is_definer AND p.provolatile::text=expected.volatility) THEN
   RAISE EXCEPTION 'GENERATION_ADMISSION_PREREQUISITE_DRIFT';
  END IF;
 END LOOP;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_nutrition.read_generation_validation_source_v1(uuid,bytea)','839a6130293d0e096299aad6ea1814ce',false,'s'),
  ('potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)','c12b5e1198160e7b3b9df7eeb8a6661f',true,'v')
 ) AS f(signature,body_md5,is_definer,volatility) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
   AND md5(p.prosrc)=expected.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=expected.is_definer AND p.provolatile::text=expected.volatility) THEN
   RAISE EXCEPTION 'PREPARATION_SOURCE_STORAGE_BASELINE_DRIFT';
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)')
  AND md5(p.prosrc)='c230a35cb30a71eb04f89bf4f7adf1fa' AND pg_get_userbyid(p.proowner)='postgres'
  AND p.prosecdef AND p.provolatile='v' AND p.proconfig=ARRAY['search_path=pg_catalog']) THEN
  RAISE EXCEPTION 'GOAL_PREPARATION_CONTEXT_READER_DRIFT';
 END IF;
 IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.user_goals'::regclass AND attname='goal_type'
  AND NOT attisdropped AND atttypid IN('text'::regtype,'varchar'::regtype)) THEN
  RAISE EXCEPTION 'GOAL_PREPARATION_GOAL_TYPE_COLUMN_REQUIRED';
 END IF;
END
$preflight$;
CREATE FUNCTION potok_nutrition.read_admitted_generation_goal_preparation_source_v1(request_id uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE context_raw text; context_body jsonb; input_body jsonb; goal_type_value text;
BEGIN
 IF session_user<>'potok_generation_reader_v1' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'GENERATION_READER_IDENTITY_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF request_id IS NULL THEN RAISE EXCEPTION 'INVALID_GOAL_PREPARATION_LOOKUP' USING ERRCODE='22023'; END IF;
 -- Existing admitted reader verifies current Premium, request/selection, input receipt,
 -- manifest/policies/goal heads and revocation, and holds the shared account gate.
 context_raw:=potok_nutrition.read_admitted_generation_preparation_source_v1(request_id);
 IF context_raw IS NULL THEN RAISE EXCEPTION 'SOURCE_PROVENANCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 context_body:=context_raw::jsonb;
 input_body:=convert_from(decode(context_body#>>'{input,canonicalHex}','hex'),'UTF8')::jsonb;
 SELECT g.goal_type INTO STRICT goal_type_value FROM public.user_goals g
  WHERE g.user_id=(context_body->>'accountId')::uuid
   AND g.goal_revision=(input_body#>>'{goalNutritionTarget,goalRevision}')::uuid;
 RETURN jsonb_build_object('contract','potok-generation-goal-preparation-source-v1',
  'contextRaw',context_raw,'goalType',goal_type_value)::text;
END
$fn$;
REVOKE ALL ON FUNCTION potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)
 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1;
GRANT EXECUTE ON FUNCTION potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid) TO potok_generation_reader_v1;
DO $postcheck$
BEGIN
 IF NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)','EXECUTE')
 OR EXISTS(SELECT FROM (VALUES('anon'),('authenticated'),('service_role')) r(name)
  WHERE has_function_privilege(r.name,'potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)','EXECUTE'))
 OR has_table_privilege('potok_generation_reader_v1','public.user_goals','SELECT')
 THEN RAISE EXCEPTION 'GOAL_PREPARATION_GRANT_POSTCHECK_FAILED'; END IF;
END
$postcheck$;
COMMENT ON FUNCTION potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid) IS
 'Current goal type bound to admitted request-only preparation context. Private reader only; no publication, warning assessment or generator activation.';
COMMIT;
