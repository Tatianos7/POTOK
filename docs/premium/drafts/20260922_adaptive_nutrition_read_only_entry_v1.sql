-- POTOK Adaptive Nutrition authenticated read-only entry discovery v1.
-- RUNNABLE REVIEW DRAFT, NOT APPLIED. STAGING only after separate owner approval.
-- Adds no rows, plan generation, selection creation, mutation path or FACT writer.

BEGIN;

DO $preflight$
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regclass('public.user_premium_plan_selections') IS NULL
     OR pg_catalog.to_regprocedure(
       'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'
     ) IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'trusted entitlement and adaptive persistence read foundation are required';
  END IF;
  IF pg_catalog.to_regprocedure('public.adaptive_nutrition_discover_current_v1(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'read-only discovery v1 already exists; inspect instead of rerunning';
  END IF;
END
$preflight$;

CREATE FUNCTION public.adaptive_nutrition_discover_current_v1(p_timezone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_week_anchor date;
  v_match_count bigint;
  v_selection public.user_premium_plan_selections%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'denied');
  END IF;
  IF p_timezone IS NULL OR p_timezone = '' OR p_timezone <> pg_catalog.btrim(p_timezone)
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_timezone
     ) THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'denied');
  END IF;

  v_week_anchor := pg_catalog.date_trunc('week', v_now AT TIME ZONE p_timezone)::date;
  IF EXTRACT(isodow FROM v_week_anchor) <> 1 THEN
    RAISE EXCEPTION 'derived week anchor is not Monday';
  END IF;
  IF NOT potok_control.is_effective_entitlement_v2(v_actor, 'premium', v_now) THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'denied');
  END IF;

  SELECT pg_catalog.count(*)
    INTO v_match_count
    FROM public.user_premium_plan_selections s
   WHERE s.user_id = v_actor
     AND s.contract_version = 1
     AND s.status = 'active'
     AND s.week_anchor = v_week_anchor
     AND s.timezone = p_timezone
     AND s.origin_lineage ->> 'source' IS DISTINCT FROM 'potok-retained-staging-smoke-v1';

  IF v_match_count = 0 THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'no_active_plan');
  END IF;
  IF v_match_count > 1 THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'ambiguous');
  END IF;

  SELECT s.*
    INTO STRICT v_selection
    FROM public.user_premium_plan_selections s
   WHERE s.user_id = v_actor
     AND s.contract_version = 1
     AND s.status = 'active'
     AND s.week_anchor = v_week_anchor
     AND s.timezone = p_timezone
     AND s.origin_lineage ->> 'source' IS DISTINCT FROM 'potok-retained-staging-smoke-v1';

  RETURN pg_catalog.jsonb_build_object(
    'kind', 'ready',
    'selection_id', v_selection.id,
    'week_anchor', v_selection.week_anchor,
    'timezone', v_selection.timezone,
    'status', v_selection.status,
    'contract_version', v_selection.contract_version
  );
END
$function$;

REVOKE ALL ON FUNCTION public.adaptive_nutrition_discover_current_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_discover_current_v1(text)
  TO authenticated;

COMMENT ON FUNCTION public.adaptive_nutrition_discover_current_v1(text) IS
  'Authenticated read-only discovery of exactly one own active contract-v1 local-week selection; verified Premium required; retained smoke excluded; no writes or auto-create.';

COMMIT;
