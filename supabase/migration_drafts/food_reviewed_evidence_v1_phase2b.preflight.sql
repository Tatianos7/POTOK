-- PREPARED ONLY. READ-ONLY owner metadata preflight for a separately authorized STAGING rollout.
-- Requires an explicit rollout target acknowledgement in this session; does not establish project identity.
BEGIN READ ONLY;
DO $preflight$
DECLARE v_count integer;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'POSTGRES_OWNER_SESSION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'REVIEWED_FORCE_RLS_OWNER_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role'))<>3
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')
      AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
    OR pg_catalog.pg_has_role('anon','postgres','MEMBER')
    OR pg_catalog.pg_has_role('authenticated','postgres','MEMBER')
    OR pg_catalog.pg_has_role('service_role','postgres','MEMBER') THEN
    RAISE EXCEPTION 'REVIEWED_CLIENT_ROLE_ISOLATION_REQUIRED';
  END IF;
  IF pg_catalog.to_regnamespace('potok_food_evidence') IS NOT NULL THEN
    RAISE EXCEPTION 'FOOD_EVIDENCE_ALREADY_EXISTS_REVIEW_DEPLOYED_STATE';
  END IF;
  IF pg_catalog.to_regclass('potok_control.access_attestations') IS NULL
     OR pg_catalog.to_regprocedure('potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)') IS NULL
     OR pg_catalog.to_regprocedure('auth.uid()') IS NULL OR pg_catalog.to_regprocedure('auth.jwt()') IS NULL
     OR pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.json_has_duplicate_keys_v1(json)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.canonical_jsonb_text_v1(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'STAGING_TRUSTED_INFRASTRUCTURE_REQUIRED_NO_MAIN_FALLBACK';
  END IF;
  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles'
      AND column_name IN ('user_id','admin_provenance_id','admin_valid_until');
  IF v_count<>3 THEN RAISE EXCEPTION 'STAGING_PROFILE_CONTRACT_REQUIRED_NO_MAIN_FALLBACK'; END IF;
  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='public' AND table_name='foods'
      AND column_name IN ('id','canonical_food_id','stable_food_id','source','created_by_user_id',
        'name','name_original','normalized_name','brand','normalized_brand','barcode','aliases');
  IF v_count<>12 THEN RAISE EXCEPTION 'EXISTING_CANONICAL_FOOD_SCHEMA_REQUIRED'; END IF;
  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='auth' AND ((table_name='sessions' AND column_name IN ('id','user_id','not_after'))
      OR (table_name='users' AND column_name IN ('id','is_anonymous')));
  IF v_count<>5 THEN RAISE EXCEPTION 'REVIEWED_AUTH_SESSION_SCHEMA_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
      WHERE oid='potok_control.access_attestations'::regclass AND relrowsecurity AND relforcerowsecurity)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
       AND (pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','INSERT')
         OR pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','UPDATE')
         OR pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','DELETE')
         OR pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','TRUNCATE')
         OR pg_catalog.has_any_column_privilege(r.oid,'potok_control.access_attestations','INSERT')
         OR pg_catalog.has_any_column_privilege(r.oid,'potok_control.access_attestations','UPDATE'))) THEN
    RAISE EXCEPTION 'TRUSTED_ATTESTATION_ACL_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid IN (
      'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'::regprocedure,
      'potok_nutrition.json_has_duplicate_keys_v1(json)'::regprocedure,
      'potok_nutrition.canonical_jsonb_text_v1(jsonb)'::regprocedure)
      AND (pg_catalog.pg_get_userbyid(p.proowner)<>'postgres'
        OR NOT coalesce('search_path=pg_catalog'=ANY(p.proconfig),false))) THEN
    RAISE EXCEPTION 'REVIEWED_PREREQUISITE_FUNCTION_SECURITY_REQUIRED';
  END IF;
  IF current_setting('potok_food_evidence.rollout_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
    RAISE EXCEPTION 'EXPLICIT_STAGING_ROLLOUT_TARGET_REQUIRED';
  END IF;
END $preflight$;
ROLLBACK;
