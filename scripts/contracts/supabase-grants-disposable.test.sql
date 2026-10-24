-- Disposable-only regression: exercise PostgreSQL role and column grants.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE potok_test_authenticated NOLOGIN;
CREATE ROLE potok_test_anon NOLOGIN;
CREATE SCHEMA potok_grants_test;
CREATE TABLE potok_grants_test.user_profiles (
 id_user uuid PRIMARY KEY,
 first_name text,
 coach_settings jsonb DEFAULT '{}'::jsonb,
 has_premium boolean NOT NULL DEFAULT false,
 is_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE potok_grants_test.entitlements (id_user uuid PRIMARY KEY, tier text);
GRANT USAGE ON SCHEMA potok_grants_test TO potok_test_authenticated, potok_test_anon;
GRANT SELECT ON potok_grants_test.user_profiles TO potok_test_authenticated;
GRANT INSERT (id_user,first_name,coach_settings) ON potok_grants_test.user_profiles TO potok_test_authenticated;
GRANT UPDATE (first_name,coach_settings) ON potok_grants_test.user_profiles TO potok_test_authenticated;
GRANT SELECT ON potok_grants_test.entitlements TO potok_test_authenticated;
DO $$
BEGIN
 IF has_column_privilege('potok_test_authenticated','potok_grants_test.user_profiles','has_premium','UPDATE') THEN
  RAISE EXCEPTION 'premium column writable';
 END IF;
 IF has_column_privilege('potok_test_authenticated','potok_grants_test.user_profiles','has_premium','INSERT') THEN
  RAISE EXCEPTION 'premium column insertable';
 END IF;
 IF has_column_privilege('potok_test_authenticated','potok_grants_test.user_profiles','is_admin','UPDATE') THEN
  RAISE EXCEPTION 'admin column writable';
 END IF;
 IF NOT has_column_privilege('potok_test_authenticated','potok_grants_test.user_profiles','first_name','UPDATE') THEN
  RAISE EXCEPTION 'ordinary field blocked';
 END IF;
 IF has_table_privilege('potok_test_authenticated','potok_grants_test.entitlements','INSERT') THEN
  RAISE EXCEPTION 'entitlement writable';
 END IF;
END $$;
SET LOCAL ROLE potok_test_authenticated;
INSERT INTO potok_grants_test.user_profiles(id_user,first_name) VALUES ('00000000-0000-0000-0000-000000000001','Initial');
UPDATE potok_grants_test.user_profiles SET first_name='Changed' WHERE id_user='00000000-0000-0000-0000-000000000001';
RESET ROLE;
ROLLBACK;
