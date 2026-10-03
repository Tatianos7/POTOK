-- POTOK protected execution binding v1 — minimal service gateway schema-USAGE repair.
-- Target: STAGING ozidryfvhkcbtpnulakq only. Prepared for owner review; NOT APPLIED.

BEGIN;

DO $schema_usage_guard$
DECLARE
  v_allowed boolean;
BEGIN
  IF CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'POSTGRES_OWNER_SESSION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF pg_catalog.to_regnamespace('potok_nutrition') IS NULL THEN
    RAISE EXCEPTION 'POTOK_NUTRITION_SCHEMA_REQUIRED';
  END IF;
  SELECT pg_catalog.count(*)=3
         AND pg_catalog.bool_and(p.oid IN (
           pg_catalog.to_regprocedure('potok_nutrition.load_generation_request_v2(uuid)'),
           pg_catalog.to_regprocedure(
             'potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)'),
           pg_catalog.to_regprocedure('potok_nutrition.activate_generated_week_gateway_v2(uuid)')
         ))
    INTO v_allowed
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='potok_nutrition'
     AND pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE');
  IF v_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SERVICE_ROLE_FUNCTION_ALLOWLIST_MISMATCH';
  END IF;
  IF pg_catalog.has_schema_privilege('service_role','potok_nutrition','CREATE') THEN
    RAISE EXCEPTION 'SERVICE_ROLE_SCHEMA_CREATE_MUST_REMAIN_DENIED';
  END IF;
END
$schema_usage_guard$;

GRANT USAGE ON SCHEMA potok_nutrition TO service_role;

COMMIT;
