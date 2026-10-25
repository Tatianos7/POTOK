-- REVIEW ONLY: source-baseline candidate, not an apply migration.
-- Hashes below are derived only from tracked phase7_3_2_monetization.sql.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE t text; f record;
BEGIN
  IF current_user<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'Expected postgres on PostgreSQL 17';
  END IF;
  FOREACH t IN ARRAY ARRAY['entitlements','subscriptions','billing_events'] LOOP
    IF NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relkind='r'
      AND c.relowner='postgres'::regrole AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'Finance table owner/type/RLS drift: %',t;
    END IF;
    IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=to_regclass('public.'||t)
      AND attname='user_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Finance owner column drift: %',t;
    END IF;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=to_regclass('public.'||t))<>1
      OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=to_regclass('public.'||t)
        AND polcmd='*' AND polpermissive
        AND (polroles=ARRAY[0::oid] OR polroles=ARRAY['authenticated'::regrole::oid])
        AND regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]()]','','g')='auth.uid=user_id'
        AND regexp_replace(pg_get_expr(polwithcheck,polrelid),'[[:space:]()]','','g')='auth.uid=user_id') THEN
      RAISE EXCEPTION 'Finance owner policy drift: %',t;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a
    ON a.attrelid=i.indrelid AND a.attname='user_id' AND a.attnum=i.indkey[0]
    WHERE i.indrelid='public.entitlements'::regclass AND i.indisunique
      AND i.indisvalid AND i.indisready AND i.indnkeyatts=1
      AND i.indexprs IS NULL AND i.indpred IS NULL) THEN
    RAISE EXCEPTION 'Expected unique entitlement user index';
  END IF;
  FOR f IN SELECT * FROM (VALUES
    ('public.get_entitlements(uuid)','7bdf53d5c9120c74748815544df9387d'),
    ('public.get_paywall_state(text,uuid)','0ee06a885f411da3e3f5f9382ca82eb7'),
    ('public.start_purchase(uuid,text,text,text)','6a5da0c1dc1c3a1046fd07f51a6934ff'),
    ('public.restore_purchase(uuid,text,text,text)','e3d65717b7e25e5fe06ee59bb9a911d1')
  ) AS expected(signature,body_md5) LOOP
    IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure(f.signature)
      AND proowner='postgres'::regrole AND prosecdef AND prorettype='jsonb'::regtype
      AND md5(prosrc)=f.body_md5) THEN
      RAISE EXCEPTION 'Public source RPC baseline drift: %',f.signature;
    END IF;
  END LOOP;
END
$preflight$;

CREATE TEMP TABLE potok_finance_preserved ON COMMIT DROP AS
SELECT c.oid AS relation, r.role_name,
  has_table_privilege(r.role_name,c.oid,'SELECT') AS can_select,
  has_table_privilege(r.role_name,c.oid,'INSERT') AS can_insert,
  has_table_privilege(r.role_name,c.oid,'UPDATE') AS can_update,
  has_table_privilege(r.role_name,c.oid,'DELETE') AS can_delete
FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'),('service_role')) r(role_name)
WHERE c.oid IN ('public.entitlements'::regclass,'public.subscriptions'::regclass,'public.billing_events'::regclass);
CREATE TEMP TABLE potok_purchase_preserved ON COMMIT DROP AS
SELECT p.oid AS function_oid,has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p WHERE p.oid IN (
  'public.start_purchase(uuid,text,text,text)'::regprocedure,
  'public.restore_purchase(uuid,text,text,text)'::regprocedure);

REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON
  public.entitlements,public.subscriptions,public.billing_events FROM PUBLIC,anon,authenticated;
DO $columns$
DECLARE a record;
BEGIN
  FOR a IN SELECT attrelid,attname FROM pg_attribute
    WHERE attrelid IN ('public.entitlements'::regclass,'public.subscriptions'::regclass,'public.billing_events'::regclass)
    AND attnum>0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE INSERT (%I),UPDATE (%I),REFERENCES (%I) ON %s FROM PUBLIC,anon,authenticated',
      a.attname,a.attname,a.attname,a.attrelid::regclass);
  END LOOP;
END
$columns$;

-- Preserve the existing public endpoint/signature, default argument and JSON DTO.
-- No deprecated auth.role(), user_metadata or profile flags participate in authority.
CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $entitlements$
DECLARE caller uuid := auth.uid(); resolved_user uuid; row_ent public.entitlements;
BEGIN
  IF caller IS NULL OR (auth.jwt()->>'role') IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  resolved_user := coalesce(p_user_id,caller);
  IF resolved_user<>caller THEN
    RAISE EXCEPTION 'cross-account entitlement access denied' USING ERRCODE='42501';
  END IF;
  SELECT * INTO row_ent FROM public.entitlements WHERE user_id=resolved_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('tier','free','flags',jsonb_build_object(
      'can_view_plan',true,'can_adapt',false,'can_explain',false,
      'can_voice',false,'can_spatial',false));
  END IF;
  RETURN jsonb_build_object('tier',row_ent.tier,'flags',row_ent.flags);
END
$entitlements$;
REVOKE ALL ON FUNCTION public.get_entitlements(uuid),public.get_paywall_state(text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid),public.get_paywall_state(text,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_purchase(uuid,text,text,text),public.restore_purchase(uuid,text,text,text)
  FROM PUBLIC,anon,authenticated;
-- No service grant is added. Existing server capability/body is preserved, not
-- promoted into receipt verification or a trusted payment implementation.

DO $verify$
DECLARE t text; r text; f text; saved record;
BEGIN
  FOREACH t IN ARRAY ARRAY['entitlements','subscriptions','billing_events'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(r,'public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(r,'public.'||t,'INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Effective finance writer remains: %.%',r,t;
      END IF;
    END LOOP;
  END LOOP;
  FOR saved IN SELECT * FROM potok_finance_preserved LOOP
    IF has_table_privilege(saved.role_name,saved.relation,'SELECT')<>saved.can_select
      OR (saved.role_name='service_role' AND (
        has_table_privilege(saved.role_name,saved.relation,'INSERT')<>saved.can_insert
        OR has_table_privilege(saved.role_name,saved.relation,'UPDATE')<>saved.can_update
        OR has_table_privilege(saved.role_name,saved.relation,'DELETE')<>saved.can_delete)) THEN
      RAISE EXCEPTION 'Finance read/service capability changed';
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.get_entitlements(uuid)','public.get_paywall_state(text,uuid)'] LOOP
    IF NOT has_function_privilege('authenticated',f,'EXECUTE')
      OR has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE') THEN
      RAISE EXCEPTION 'Entitlement RPC effective grants mismatch';
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.start_purchase(uuid,text,text,text)','public.restore_purchase(uuid,text,text,text)'] LOOP
    IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') THEN
      RAISE EXCEPTION 'Client purchase RPC remains executable';
    END IF;
  END LOOP;
  IF EXISTS(SELECT FROM potok_purchase_preserved
    WHERE has_function_privilege('service_role',function_oid,'EXECUTE')<>service_execute) THEN
    RAISE EXCEPTION 'Existing server purchase capability changed';
  END IF;
END
$verify$;
ROLLBACK;
