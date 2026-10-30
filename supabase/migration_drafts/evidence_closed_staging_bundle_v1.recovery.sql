-- INACTIVE recovery candidate. Requires separate explicit Staging authorization.
-- Preserve all account/provenance/evidence data. Suspend only our reviewed hook body.
-- Managed Supabase postgres has TRIGGER but does not own auth.users.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $recovery$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('potok_evidence.recovery_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_RECOVERY_TARGET_OWNER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
  WHERE t.tgrelid='auth.users'::regclass AND t.tgname='potok_closure_register_new_auth_v1'
   AND NOT t.tgisinternal AND t.tgfoid=to_regprocedure('potok_closure.register_new_auth_v1()')
   AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
   AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
   AND encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')='ee7db68b38283366dac7962f6a5c27e72677d265535059da6af05ec9f190dba0') THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_REVIEWED_RECOVERY_HOOK_REQUIRED';
 END IF;
END $recovery$;
CREATE OR REPLACE FUNCTION potok_closure.register_new_auth_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 -- EVIDENCE_BUNDLE_RECOVERY_SUSPENDED: no state creation; missing state fails closed.
 IF TG_TABLE_SCHEMA<>'auth' OR TG_TABLE_NAME<>'users' OR TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'AUTH_INSERT_EVENT_REQUIRED';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION potok_closure.register_new_auth_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.food_evidence_review_v1(text),public.food_evidence_receipt_v1(uuid),public.food_evidence_current_v1(uuid,text),public.nonfood_evidence_review_v1(text),public.nonfood_evidence_receipt_v1(uuid),public.nonfood_evidence_current_v1(uuid),public.account_closure_begin_v1(text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
