-- Disposable PostgreSQL 17 RLS/JWT-claim simulation, not a real Supabase Auth integration test.
-- Must only run in isolated CI database; transaction rolls back.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE potok_rls_auth NOLOGIN;
CREATE ROLE potok_rls_anon NOLOGIN;
CREATE SCHEMA potok_rls;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA potok_rls,auth TO potok_rls_auth,potok_rls_anon;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO potok_rls_auth,potok_rls_anon;
CREATE TABLE potok_rls.user_profiles (
 id_user uuid PRIMARY KEY, first_name text,
 coach_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 has_premium boolean NOT NULL DEFAULT false,
 is_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE potok_rls.subscriptions (user_id uuid PRIMARY KEY,status text);
CREATE TABLE potok_rls.entitlements (user_id uuid PRIMARY KEY,tier text);
CREATE TABLE potok_rls.billing_events (user_id uuid PRIMARY KEY,description text);
ALTER TABLE potok_rls.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_rls.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_rls.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_rls.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_profile_select ON potok_rls.user_profiles FOR SELECT TO potok_rls_auth USING (auth.uid()=id_user);
CREATE POLICY own_profile_insert ON potok_rls.user_profiles FOR INSERT TO potok_rls_auth WITH CHECK (auth.uid()=id_user);
CREATE POLICY own_profile_update ON potok_rls.user_profiles FOR UPDATE TO potok_rls_auth USING (auth.uid()=id_user) WITH CHECK (auth.uid()=id_user);
CREATE POLICY own_subscription ON potok_rls.subscriptions FOR ALL TO PUBLIC USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY own_entitlement ON potok_rls.entitlements FOR ALL TO PUBLIC USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY own_billing ON potok_rls.billing_events FOR ALL TO PUBLIC USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
GRANT SELECT ON potok_rls.user_profiles TO potok_rls_auth;
GRANT INSERT (id_user,first_name,coach_settings) ON potok_rls.user_profiles TO potok_rls_auth;
GRANT UPDATE (first_name,coach_settings) ON potok_rls.user_profiles TO potok_rls_auth;
GRANT SELECT ON potok_rls.subscriptions,potok_rls.entitlements,potok_rls.billing_events TO potok_rls_auth;
INSERT INTO potok_rls.user_profiles(id_user,first_name) VALUES ('00000000-0000-0000-0000-000000000002','Other');
INSERT INTO potok_rls.subscriptions(user_id,status) VALUES ('00000000-0000-0000-0000-000000000001','free');
SET LOCAL ROLE potok_rls_auth;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
INSERT INTO potok_rls.user_profiles(id_user,first_name) VALUES ('00000000-0000-0000-0000-000000000001','Own');
INSERT INTO potok_rls.user_profiles(id_user,first_name) VALUES ('00000000-0000-0000-0000-000000000001','Updated')
 ON CONFLICT (id_user) DO UPDATE SET first_name=excluded.first_name;
UPDATE potok_rls.user_profiles SET coach_settings='{"mode":"off"}' WHERE id_user='00000000-0000-0000-0000-000000000001';
DO $$
BEGIN
 IF (SELECT count(*) FROM potok_rls.user_profiles) <> 1 THEN RAISE EXCEPTION 'cross-user profile readable'; END IF;
 IF (SELECT first_name FROM potok_rls.user_profiles WHERE id_user=auth.uid()) <> 'Updated' THEN RAISE EXCEPTION 'upsert failed'; END IF;
 IF has_column_privilege(current_user,'potok_rls.user_profiles','has_premium','INSERT')
 OR has_column_privilege(current_user,'potok_rls.user_profiles','has_premium','UPDATE')
 OR has_column_privilege(current_user,'potok_rls.user_profiles','is_admin','INSERT')
 OR has_column_privilege(current_user,'potok_rls.user_profiles','is_admin','UPDATE') THEN
  RAISE EXCEPTION 'privilege column writable';
 END IF;
 IF has_table_privilege(current_user,'potok_rls.subscriptions','UPDATE')
 OR has_table_privilege(current_user,'potok_rls.entitlements','INSERT')
 OR has_table_privilege(current_user,'potok_rls.billing_events','DELETE') THEN
  RAISE EXCEPTION 'financial authority writable';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
