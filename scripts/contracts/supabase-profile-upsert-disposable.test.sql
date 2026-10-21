-- POTOK disposable acceptance: representative PostgREST-style upsert privilege gate.
-- DO NOT run against POTOK Supabase projects. This file assumes a disposable PostgreSQL 17 database.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE potok_auth_test NOLOGIN;
CREATE ROLE potok_anon_test NOLOGIN;
CREATE SCHEMA potok_auth_gate;
CREATE TABLE potok_auth_gate.user_profiles (
 id_user uuid PRIMARY KEY,
 first_name text,
 coach_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 has_premium boolean NOT NULL DEFAULT false,
 is_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE potok_auth_gate.subscriptions (user_id uuid PRIMARY KEY, status text);
GRANT USAGE ON SCHEMA potok_auth_gate TO potok_auth_test, potok_anon_test;
GRANT SELECT ON potok_auth_gate.user_profiles TO potok_auth_test;
GRANT INSERT (id_user,first_name,coach_settings) ON potok_auth_gate.user_profiles TO potok_auth_test;
GRANT UPDATE (first_name,coach_settings) ON potok_auth_gate.user_profiles TO potok_auth_test;
GRANT SELECT ON potok_auth_gate.subscriptions TO potok_auth_test;
DO $$
BEGIN
 IF has_column_privilege('potok_auth_test','potok_auth_gate.user_profiles','has_premium','INSERT')
 OR has_column_privilege('potok_auth_test','potok_auth_gate.user_profiles','has_premium','UPDATE')
 OR has_column_privilege('potok_auth_test','potok_auth_gate.user_profiles','is_admin','INSERT')
 OR has_column_privilege('potok_auth_test','potok_auth_gate.user_profiles','is_admin','UPDATE') THEN
  RAISE EXCEPTION 'privileged profile column write exposed';
 END IF;
 IF has_table_privilege('potok_auth_test','potok_auth_gate.subscriptions','UPDATE') THEN
  RAISE EXCEPTION 'subscription mutation exposed';
 END IF;
END $$;
SET LOCAL ROLE potok_auth_test;
INSERT INTO potok_auth_gate.user_profiles(id_user,first_name)
 VALUES ('00000000-0000-0000-0000-000000000001','First');
INSERT INTO potok_auth_gate.user_profiles(id_user,first_name)
 VALUES ('00000000-0000-0000-0000-000000000001','Updated')
 ON CONFLICT (id_user) DO UPDATE SET first_name=excluded.first_name;
UPDATE potok_auth_gate.user_profiles SET coach_settings='{"mode":"off"}'::jsonb
 WHERE id_user='00000000-0000-0000-0000-000000000001';
RESET ROLE;
DO $$
DECLARE v text;
BEGIN
 SELECT first_name INTO v FROM potok_auth_gate.user_profiles
 WHERE id_user='00000000-0000-0000-0000-000000000001';
 IF v <> 'Updated' THEN RAISE EXCEPTION 'ordinary upsert failed'; END IF;
END $$;
ROLLBACK;
