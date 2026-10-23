-- Isolated PostgreSQL acceptance for the reviewed get_entitlements authority contract.
-- No cloud connection. All fixtures and roles rolled back at the end.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA potok_rpc_test;
GRANT USAGE ON SCHEMA auth,potok_rpc_test TO authenticated,anon;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.role',true),'')
$$;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO authenticated,anon;
CREATE TABLE potok_rpc_test.entitlements(user_id uuid PRIMARY KEY,tier text NOT NULL,flags jsonb NOT NULL);
INSERT INTO potok_rpc_test.entitlements VALUES
 ('00000000-0000-0000-0000-000000000001','free','{"can_adapt":false}'),
 ('00000000-0000-0000-0000-000000000002','pro','{"can_adapt":true}');
CREATE FUNCTION potok_rpc_test.get_entitlements(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'potok_rpc_test','pg_temp'
AS $$
DECLARE
 caller uuid := auth.uid();
 resolved_user uuid;
 row_ent potok_rpc_test.entitlements;
BEGIN
 IF auth.role() <> 'authenticated' OR caller IS NULL THEN
  RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
 END IF;
 resolved_user := coalesce(p_user_id,caller);
 IF resolved_user <> caller THEN
  RAISE EXCEPTION 'cross-account entitlement access denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO row_ent FROM potok_rpc_test.entitlements WHERE user_id=resolved_user;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('tier','free','flags',jsonb_build_object('can_adapt',false));
 END IF;
 RETURN jsonb_build_object('tier',row_ent.tier,'flags',row_ent.flags);
END $$;
REVOKE ALL ON FUNCTION potok_rpc_test.get_entitlements(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION potok_rpc_test.get_entitlements(uuid) TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$
DECLARE v jsonb;
BEGIN
 v := potok_rpc_test.get_entitlements(NULL);
 IF v->>'tier' <> 'free' THEN RAISE EXCEPTION 'default self read failed'; END IF;
 v := potok_rpc_test.get_entitlements('00000000-0000-0000-0000-000000000001');
 IF v->>'tier' <> 'free' THEN RAISE EXCEPTION 'explicit self read failed'; END IF;
 BEGIN
  PERFORM potok_rpc_test.get_entitlements('00000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'cross-account read unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role','anon',true);
SELECT set_config('request.jwt.claim.sub','',true);
DO $$
BEGIN
 IF has_function_privilege(current_user,'potok_rpc_test.get_entitlements(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'anon can execute entitlement RPC';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
