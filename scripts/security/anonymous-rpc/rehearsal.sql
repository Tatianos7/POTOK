-- LOCAL RESTORED DATABASE ONLY. Checks existing RPC grants and ALWAYS ROLLS BACK.
-- Does not repair authenticated authorization or billing authority.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, pg_temp;
DO $actor$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected effective role postgres'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    RAISE EXCEPTION 'Required API roles missing';
  END IF;
END
$actor$;
CREATE TEMP TABLE potok_rpc_targets (signature text PRIMARY KEY, oid oid,
  authenticated_allowed boolean, service_allowed boolean, definition_hash text) ON COMMIT DROP;
INSERT INTO potok_rpc_targets(signature) VALUES
  ('public.apply_admin_approved_food_alias(uuid,text,text)'),
  ('public.apply_owner_approved_missing_food_draft(uuid)'),
  ('public.get_entitlements(uuid)'),
  ('public.get_paywall_state(text,uuid)'),
  ('public.recompute_food_entries_for_food_ids(uuid[])'),
  ('public.restore_purchase(uuid,text,text,text)'),
  ('public.rls_auto_enable()'),
  ('public.start_purchase(uuid,text,text,text)');
UPDATE potok_rpc_targets SET oid=to_regprocedure(signature);
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM potok_rpc_targets t LEFT JOIN pg_proc p ON p.oid=t.oid
    WHERE p.oid IS NULL OR p.proowner <> 'postgres'::regrole
      OR p.prokind <> 'f' OR NOT p.prosecdef) THEN
    RAISE EXCEPTION 'RPC inventory, ownership or SECURITY DEFINER drift requires review';
  END IF;
END
$preflight$;
UPDATE potok_rpc_targets t SET
  authenticated_allowed=has_function_privilege('authenticated',t.oid,'EXECUTE'),
  service_allowed=has_function_privilege('service_role',t.oid,'EXECUTE'),
  definition_hash=md5(pg_get_functiondef(t.oid));
DO $revoke$
DECLARE t record;
BEGIN
  FOR t IN SELECT oid FROM potok_rpc_targets ORDER BY oid LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',t.oid::regprocedure);
  END LOOP;
END
$revoke$;
DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM potok_rpc_targets t
    WHERE has_function_privilege('anon',t.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Effective anonymous EXECUTE remains; transaction will roll back';
  END IF;
  IF EXISTS (SELECT 1 FROM potok_rpc_targets t
    WHERE has_function_privilege('authenticated',t.oid,'EXECUTE') IS DISTINCT FROM t.authenticated_allowed
      OR has_function_privilege('service_role',t.oid,'EXECUTE') IS DISTINCT FROM t.service_allowed
      OR md5(pg_get_functiondef(t.oid)) <> t.definition_hash) THEN
    RAISE EXCEPTION 'Required role access or RPC definition changed; transaction will roll back';
  END IF;
END
$verify$;
SELECT 'ANON_RPC_REHEARSAL_OK' AS result;
SELECT signature,
       has_function_privilege('anon',oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',oid,'EXECUTE') AS service_execute
FROM potok_rpc_targets ORDER BY signature;
ROLLBACK;
