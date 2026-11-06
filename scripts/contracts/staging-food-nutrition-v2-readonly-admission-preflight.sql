-- POTOK Nutrition V2 · hosted Staging exact-source admission preflight
-- READ-ONLY. Execute only against Supabase Staging ozidryfvhkcbtpnulakq.
-- NEVER call food_nutrition_review_v2 from this file. Never run against Production.
-- This probe deliberately does not claim catalog source validation or approval.
BEGIN TRANSACTION READ ONLY;
DO $potok$
DECLARE
  v_rpcs integer;
  v_private_tables integer;
  v_admin boolean;
  v_unexpected_privs integer;
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'READ_ONLY_TRANSACTION_REQUIRED';
  END IF;
  IF session_user <> 'postgres' THEN
    RAISE EXCEPTION 'POSTGRES_OWNER_SESSION_REQUIRED';
  END IF;
  IF current_database() IS NULL THEN
    RAISE EXCEPTION 'UNEXPECTED_DATABASE';
  END IF;
  SELECT count(*) INTO v_rpcs
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND
    (p.proname,pg_get_function_identity_arguments(p.oid)) IN (
      ('food_nutrition_review_v2','p_request_text text'),
      ('food_nutrition_receipt_v2','p_idempotency_reference uuid'),
      ('food_nutrition_current_v2','p_canonical_food_id uuid, p_food_state text')
    );
  IF v_rpcs <> 3 THEN RAISE EXCEPTION 'NUTRITION_V2_RPC_SIGNATURE_DRIFT'; END IF;
  SELECT count(*) INTO v_private_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='potok_food_evidence'
    AND c.relname IN ('exact_requests_v2','exact_revisions_v2','exact_events_v2','exact_heads_v2','exact_sources_v2')
    AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity;
  IF v_private_tables <> 5 THEN RAISE EXCEPTION 'NUTRITION_V2_PRIVATE_RLS_DRIFT'; END IF;
  SELECT count(*) INTO v_unexpected_privs
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('anon'),('authenticated')) AS r(rol)
  WHERE n.nspname='potok_food_evidence'
    AND c.relname IN ('exact_requests_v2','exact_revisions_v2','exact_events_v2','exact_heads_v2','exact_sources_v2')
    AND (has_schema_privilege(r.rol,n.oid,'USAGE')
      OR has_table_privilege(r.rol,c.oid,'SELECT,INSERT,UPDATE,DELETE'));
  IF v_unexpected_privs <> 0 THEN RAISE EXCEPTION 'PRIVATE_EXACT_TABLE_CLIENT_ACCESS_DRIFT'; END IF;
  SELECT potok_control.is_effective_entitlement_v2(u.id,'admin',now())
  INTO STRICT v_admin FROM auth.users u WHERE u.email='fitnessup@ya.ru';
  IF v_admin THEN RAISE EXCEPTION 'STAGING_SMOKE_ADMIN_GRANT_STILL_ACTIVE'; END IF;
END $potok$;
SELECT
 'STAGING_NUTRITION_V2_READ_ONLY_PREFLIGHT' AS check_name,
 (SELECT count(*) FROM potok_food_evidence.exact_sources_v2) AS sources,
 (SELECT count(*) FROM potok_food_evidence.exact_requests_v2) AS requests,
 (SELECT count(*) FROM potok_food_evidence.exact_revisions_v2) AS revisions,
 (SELECT count(*) FROM potok_food_evidence.exact_events_v2) AS events,
 (SELECT count(*) FROM potok_food_evidence.exact_heads_v2) AS heads,
 (SELECT potok_control.is_effective_entitlement_v2(u.id,'admin',now())
  FROM auth.users u WHERE u.email='fitnessup@ya.ru') AS staging_smoke_admin_active;
ROLLBACK;
