-- REVIEW ONLY. Integrates the existing verified-entitlement contract; installs
-- no attestation store, issuer, grants to users, generator or background jobs.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE t text; f record;
BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
   OR to_regprocedure('public.has_catalog_admin_access_v1()') IS NOT NULL THEN
   RAISE EXCEPTION 'Expected unmodified PostgreSQL 17 owner baseline';
 END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN
   RAISE EXCEPTION 'Client CREATE on public must be closed first';
 END IF;
 FOREACH t IN ARRAY ARRAY['foods','food_aliases','food_search_events','food_search_review_queue','food_alias_apply_audit','food_missing_review_queue','food_missing_food_drafts','food_diary_entries'] LOOP
   IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||t)
     AND relowner='postgres'::regrole AND relkind='r' AND relrowsecurity) THEN
     RAISE EXCEPTION 'Catalog owner/type/RLS drift: %',t;
   END IF;
 END LOOP;
 FOR f IN SELECT * FROM (VALUES
   ('public.apply_admin_approved_food_alias(uuid,text,text)','18ec8da84a796d29ffd3f3988af35a6b'),
   ('public.apply_owner_approved_missing_food_draft(uuid)','ee21ab1332bf40b467a33bd5c42600e3'),
   ('public.recompute_food_entries_for_food_ids(uuid[])','2f7f4343e9d22dac706f6d3494568f1a')
 ) x(signature,source_md5) LOOP
   IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure(f.signature)
     AND proowner='postgres'::regrole AND prosecdef AND md5(prosrc)=f.source_md5) THEN
     RAISE EXCEPTION 'Public source function drift: %',f.signature;
   END IF;
 END LOOP;
END
$preflight$;

-- Invoker wrapper: neither it nor user-editable profile/JWT metadata can issue
-- authority. An absent/failed verified predicate denies access until separately
-- reviewed attestation infrastructure and owner decisions are available.
CREATE FUNCTION public.has_catalog_admin_access_v1() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $gate$
DECLARE target oid; allowed boolean;
BEGIN
 IF auth.uid() IS NULL OR (auth.jwt()->>'role') IS DISTINCT FROM 'authenticated' THEN RETURN false; END IF;
 target:=to_regprocedure('public.has_verified_entitlement_v1(text)');
 IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.oid=target AND p.prorettype='boolean'::regtype
     AND r.rolname IN ('postgres','potok_entitlement_owner')) THEN RETURN false; END IF;
 EXECUTE 'SELECT public.has_verified_entitlement_v1($1)' INTO allowed USING 'admin';
 RETURN allowed IS TRUE;
EXCEPTION WHEN OTHERS THEN RETURN false;
END
$gate$;
REVOKE ALL ON FUNCTION public.has_catalog_admin_access_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.has_catalog_admin_access_v1() TO authenticated;

DO $rpc_guard$
DECLARE f text; original text; definition text; legacy text := $legacy$if v_admin_id is null or not exists (
    select 1
    from public.user_profiles
    where id_user = v_admin_id
      and is_admin = true
  ) then$legacy$;
BEGIN
 FOREACH f IN ARRAY ARRAY['public.apply_admin_approved_food_alias(uuid,text,text)','public.apply_owner_approved_missing_food_draft(uuid)'] LOOP
   SELECT prosrc,pg_get_functiondef(oid) INTO original,definition FROM pg_proc WHERE oid=f::regprocedure;
   IF (length(original)-length(replace(original,legacy,'')))/length(legacy)<>1 THEN
     RAISE EXCEPTION 'Expected single legacy admin guard: %',f;
   END IF;
   EXECUTE replace(definition,legacy,'if not public.has_catalog_admin_access_v1() then');
   IF (SELECT prosrc FROM pg_proc WHERE oid=f::regprocedure)
     <>replace(original,legacy,'if not public.has_catalog_admin_access_v1() then') THEN
     RAISE EXCEPTION 'Unexpected admin body modification';
   END IF;
 END LOOP;
END
$rpc_guard$;
REVOKE EXECUTE ON FUNCTION public.apply_admin_approved_food_alias(uuid,text,text),public.apply_owner_approved_missing_food_draft(uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.apply_admin_approved_food_alias(uuid,text,text),public.apply_owner_approved_missing_food_draft(uuid) TO authenticated;
ALTER FUNCTION public.apply_admin_approved_food_alias(uuid,text,text) SET search_path='';
ALTER FUNCTION public.apply_owner_approved_missing_food_draft(uuid) SET search_path='';

-- Replace only reviewed administrative policies. Ordinary own-search-event
-- insertion and reading policies remain intact.
DO $policies$
DECLARE p record; existing record; condition text := 'public.has_catalog_admin_access_v1()';
BEGIN
 FOR p IN SELECT * FROM (VALUES
   ('food_search_events','food_search_events_admin_all','*'),
   ('food_search_review_queue','food_search_review_queue_admin_all','*'),
   ('food_alias_apply_audit','food_alias_apply_audit_admin_select','r'),
   ('food_alias_apply_audit','food_alias_apply_audit_admin_insert','a'),
   ('food_missing_review_queue','food_missing_review_queue_admin_all','*'),
   ('food_missing_food_drafts','food_missing_food_drafts_admin_all','*')
 ) expected(table_name,policy_name,command) LOOP
   SELECT * INTO existing FROM pg_policy WHERE polrelid=to_regclass('public.'||p.table_name) AND polname=p.policy_name;
   IF NOT FOUND OR existing.polcmd::text<>p.command OR NOT existing.polpermissive
      OR existing.polroles<>ARRAY['authenticated'::regrole::oid]
      OR (p.command<>'a' AND coalesce(pg_get_expr(existing.polqual,existing.polrelid),'') !~ 'is_admin')
      OR (p.command<>'r' AND coalesce(pg_get_expr(existing.polwithcheck,existing.polrelid),'') !~ 'is_admin') THEN
     RAISE EXCEPTION 'Reviewed admin policy drift: %.%',p.table_name,p.policy_name;
   END IF;
   EXECUTE format('ALTER POLICY %I ON public.%I%s%s',p.policy_name,p.table_name,
     CASE WHEN p.command<>'a' THEN ' USING ('||condition||')' ELSE '' END,
     CASE WHEN p.command<>'r' THEN ' WITH CHECK ('||condition||')' ELSE '' END);
 END LOOP;
END
$policies$;

-- Restrictive source boundaries cannot be bypassed by an older permissive own
-- policy. They add no new catalog-wide write grants or user-private read access.
CREATE POLICY catalog_food_read_boundary_v1 ON public.foods AS RESTRICTIVE FOR SELECT TO authenticated
 USING(source IN ('core','brand') OR (source='user' AND created_by_user_id=auth.uid()));
CREATE POLICY catalog_food_insert_boundary_v1 ON public.foods AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));
CREATE POLICY catalog_food_update_boundary_v1 ON public.foods AS RESTRICTIVE FOR UPDATE TO authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
 WITH CHECK((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));
CREATE POLICY catalog_food_delete_boundary_v1 ON public.foods AS RESTRICTIVE FOR DELETE TO authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));
CREATE POLICY catalog_alias_read_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR SELECT TO authenticated
 USING((source IN ('core','brand') OR (source='user' AND created_by_user_id=auth.uid()))
   AND EXISTS(SELECT FROM public.foods f WHERE f.id=food_aliases.canonical_food_id));
CREATE POLICY catalog_alias_insert_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
   AND EXISTS(SELECT FROM public.foods f WHERE f.id=food_aliases.canonical_food_id));
CREATE POLICY catalog_alias_update_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR UPDATE TO authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
 WITH CHECK(((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
   AND EXISTS(SELECT FROM public.foods f WHERE f.id=food_aliases.canonical_food_id));
CREATE POLICY catalog_alias_delete_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR DELETE TO authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));

-- Audit rows are written by the reviewed definer RPCs, never forged directly.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.food_alias_apply_audit FROM PUBLIC,anon,authenticated;
DO $audit_columns$ DECLARE a record; BEGIN
 FOR a IN SELECT attname FROM pg_attribute WHERE attrelid='public.food_alias_apply_audit'::regclass AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE INSERT (%I),UPDATE (%I) ON public.food_alias_apply_audit FROM PUBLIC,anon,authenticated',a.attname,a.attname);
 END LOOP;
END $audit_columns$;

-- An ACL-only revoke does not stop owner/definer chains. Keep the legacy
-- signature but retire its body for every caller, including the owner.
CREATE OR REPLACE FUNCTION public.recompute_food_entries_for_food_ids(food_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $retired$
BEGIN
 RAISE EXCEPTION 'Historical nutrition snapshots cannot be recomputed from catalog revisions' USING ERRCODE='42501';
END
$retired$;
REVOKE EXECUTE ON FUNCTION public.recompute_food_entries_for_food_ids(uuid[]) FROM PUBLIC,anon,authenticated,service_role;

DO $verify$
BEGIN
 IF EXISTS(SELECT FROM pg_policies WHERE schemaname='public'
   AND tablename IN ('food_search_events','food_search_review_queue','food_alias_apply_audit','food_missing_review_queue','food_missing_food_drafts')
   AND (coalesce(qual,'') ~ 'is_admin' OR coalesce(with_check,'') ~ 'is_admin')) THEN
   RAISE EXCEPTION 'Unreviewed legacy admin policy remains';
 END IF;
 IF has_table_privilege('authenticated','public.food_alias_apply_audit','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_any_column_privilege('authenticated','public.food_alias_apply_audit','INSERT,UPDATE')
   OR has_function_privilege('anon','public.apply_admin_approved_food_alias(uuid,text,text)','EXECUTE')
   OR has_function_privilege('service_role','public.apply_owner_approved_missing_food_draft(uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.recompute_food_entries_for_food_ids(uuid[])','EXECUTE') THEN
   RAISE EXCEPTION 'Effective catalog authority grant mismatch';
 END IF;
END
$verify$;
ROLLBACK;
