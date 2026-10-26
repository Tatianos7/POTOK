-- Review-only follow-up to #196/#201/#205. Never apply this wrapper to hosted.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE r record; p pg_proc;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 THEN RAISE EXCEPTION 'Expected reviewed nonsuperuser postgres PG17 actor';END IF;
 FOR r IN SELECT * FROM (VALUES
  ('public.get_paywall_state(text,uuid)','0ee06a885f411da3e3f5f9382ca82eb7','jsonb'::regtype,false),
  ('public.get_entitlements(uuid)','2173a704a6e15eaba9a85e138537780b','jsonb'::regtype,false),
  ('public.has_verified_entitlement_v1(text)','a5b600b1f2306b6bb95015c0aeee77a3','boolean'::regtype,true),
  ('public.has_verified_entitlement_v2(text)','0228404d5b3f9b8e00d36ea12a00922a','boolean'::regtype,true),
  ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d','boolean'::regtype,true)
 ) v(signature,source_md5,result_type,pinned_path) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.signature);
  IF NOT FOUND OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
   OR p.prorettype<>r.result_type OR p.proretset OR md5(p.prosrc)<>r.source_md5
   OR (r.pinned_path AND p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog'])
   OR (r.signature='public.get_paywall_state(text,uuid)' AND p.proconfig IS NOT NULL AND p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp'])
   OR (r.signature='public.get_entitlements(uuid)' AND p.proconfig IS DISTINCT FROM ARRAY['search_path=""'])
  THEN RAISE EXCEPTION 'Server Premium source contract requires review: %',r.signature;END IF;
 END LOOP;
 IF NOT has_function_privilege('authenticated','public.get_paywall_state(text,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.get_entitlements(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.has_verified_entitlement_v1(text)','EXECUTE')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','service_role']) role_name
  WHERE has_function_privilege(role_name,'public.get_paywall_state(text,uuid)','EXECUTE')
     OR has_function_privilege(role_name,'public.get_entitlements(uuid)','EXECUTE')
     OR has_function_privilege(role_name,'public.has_verified_entitlement_v1(text)','EXECUTE'))
 THEN RAISE EXCEPTION 'Expected existing authenticated-only reader boundary';END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('potok_control.access_attestations')
  AND relrowsecurity AND relforcerowsecurity AND pg_get_userbyid(relowner)='postgres')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated','service_role']) role_name
  WHERE has_schema_privilege(role_name,'potok_control','USAGE,CREATE')
   OR has_table_privilege(role_name,'potok_control.access_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
   OR has_function_privilege(role_name,'potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','EXECUTE')
   OR has_function_privilege(role_name,'potok_control.revoke_entitlement_v2(uuid,text,text,text)','EXECUTE'))
 THEN RAISE EXCEPTION 'Private authority boundary requires review';END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.get_paywall_state(p_feature text,p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $paywall$
DECLARE ent jsonb; flag_name text; required_tier text;
BEGIN
 -- Existing guarded reader enforces signed identity and exact own-account ID.
 ent := public.get_entitlements(p_user_id);
 flag_name := CASE p_feature WHEN 'adaptation' THEN 'can_adapt'
   WHEN 'explainability' THEN 'can_explain' WHEN 'spatial' THEN 'can_spatial' END;
 required_tier := CASE WHEN p_feature='spatial' THEN 'vision_pro' ELSE 'pro' END;
 IF flag_name IS NULL THEN
  RETURN pg_catalog.jsonb_build_object('locked',true,'required_tier',required_tier,'reason','unsupported_feature');
 END IF;
 IF NOT coalesce(public.has_verified_entitlement_v1('premium'),false)
 OR (ent->'flags'->flag_name) IS DISTINCT FROM 'true'::jsonb THEN
  RETURN pg_catalog.jsonb_build_object('locked',true,'required_tier',required_tier,'reason',p_feature||'_locked');
 END IF;
 RETURN pg_catalog.jsonb_build_object('locked',false,'tier',ent->>'tier');
END
$paywall$;
REVOKE ALL ON FUNCTION public.get_paywall_state(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_paywall_state(text,uuid) TO authenticated;
DO $verify$
BEGIN
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.get_paywall_state(text,uuid)'::regprocedure)
 OR NOT has_function_privilege('authenticated','public.get_paywall_state(text,uuid)','EXECUTE')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','service_role']) role_name
  WHERE has_function_privilege(role_name,'public.get_paywall_state(text,uuid)','EXECUTE'))
 THEN RAISE EXCEPTION 'Paywall final boundary verification failed';END IF;
END
$verify$;
ROLLBACK;
