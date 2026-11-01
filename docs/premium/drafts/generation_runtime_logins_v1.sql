-- REVIEW CANDIDATE ONLY. Requires the installed PR278 source/readback package.
-- No password, source row, policy, connection, Edge deployment or activation is supplied.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$
DECLARE expected record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'GENERATION_LOGIN_OWNER_REQUIRED'; END IF;
 IF to_regrole('potok_generation_gateway_v1') IS NOT NULL THEN RAISE EXCEPTION 'GENERATION_LOGIN_ALREADY_OR_PARTIALLY_INSTALLED'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='potok_generation_reader_v1' AND NOT rolcanlogin AND NOT rolsuper
   AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN
   RAISE EXCEPTION 'GENERATION_LOGIN_READER_BASELINE_MISMATCH'; END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member='potok_generation_reader_v1'::regrole)
   OR EXISTS(SELECT FROM pg_auth_members WHERE roleid='potok_generation_reader_v1'::regrole
     AND member NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres','supabase_admin'))) THEN
   RAISE EXCEPTION 'GENERATION_LOGIN_MEMBERSHIP_MISMATCH'; END IF;
 FOR expected IN SELECT * FROM (VALUES
   ('potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)','c12b5e1198160e7b3b9df7eeb8a6661f'),
   ('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)','c230a35cb30a71eb04f89bf4f7adf1fa'),
   ('potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)','82e8a69a30af5802c740196eb04d7fbe'),
   ('potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)','c19406ab4fb50da92ecc2728d2d0050f'),
   ('potok_nutrition.load_generation_request_v2(uuid)','c376df51e77e396f60da49c4903bd035'),
   ('potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)','bc354a26e7b84becdc7711f39f646a9d'),
   ('potok_nutrition.activate_generated_week_gateway_v2(uuid)','6e9cf35c74c3c301b4ad86e3425ca05a')
 ) e(signature,body_md5) LOOP
   IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure(expected.signature) AND md5(prosrc)=expected.body_md5
     AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog'] AND prosecdef AND provolatile='v') THEN
     RAISE EXCEPTION 'GENERATION_LOGIN_FUNCTION_BASELINE_DRIFT'; END IF;
   IF expected.signature LIKE 'potok_nutrition.read_admitted_generation_%' AND NOT has_function_privilege('potok_generation_reader_v1',expected.signature,'EXECUTE') THEN
     RAISE EXCEPTION 'GENERATION_LOGIN_READER_ALLOWLIST_MISMATCH'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition'
   AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE'))<>4 THEN RAISE EXCEPTION 'GENERATION_LOGIN_READER_ALLOWLIST_MISMATCH'; END IF;
END $preflight$;
CREATE ROLE potok_generation_gateway_v1 NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION CONNECTION LIMIT 2 PASSWORD NULL;
GRANT USAGE ON SCHEMA potok_nutrition TO potok_generation_gateway_v1;
GRANT EXECUTE ON FUNCTION potok_nutrition.load_generation_request_v2(uuid),
 potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),potok_nutrition.activate_generated_week_gateway_v2(uuid) TO potok_generation_gateway_v1;
ALTER ROLE potok_generation_gateway_v1 SET search_path=pg_catalog;
ALTER ROLE potok_generation_gateway_v1 SET statement_timeout='30s';
ALTER ROLE potok_generation_gateway_v1 SET lock_timeout='5s';
ALTER ROLE potok_generation_gateway_v1 SET idle_in_transaction_session_timeout='10s';
ALTER ROLE potok_generation_reader_v1 SET search_path=pg_catalog;
ALTER ROLE potok_generation_reader_v1 SET statement_timeout='30s';
ALTER ROLE potok_generation_reader_v1 SET lock_timeout='5s';
ALTER ROLE potok_generation_reader_v1 SET idle_in_transaction_session_timeout='10s';
DO $connect$ BEGIN
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO potok_generation_reader_v1,potok_generation_gateway_v1',current_database());
END $connect$;
ALTER ROLE potok_generation_reader_v1 LOGIN CONNECTION LIMIT 2;
ALTER ROLE potok_generation_gateway_v1 LOGIN;
DO $postcheck$
DECLARE who text; expected_count integer;
BEGIN
 FOREACH who IN ARRAY ARRAY['potok_generation_reader_v1','potok_generation_gateway_v1'] LOOP
   expected_count:=CASE who WHEN 'potok_generation_reader_v1' THEN 4 ELSE 3 END;
   IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=who AND rolcanlogin AND rolconnlimit=2 AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN RAISE EXCEPTION 'GENERATION_LOGIN_ROLE_POSTCHECK_FAILED'; END IF;
   IF EXISTS(SELECT FROM pg_auth_members WHERE member=to_regrole(who)) OR EXISTS(SELECT FROM pg_auth_members WHERE roleid=to_regrole(who)
     AND member NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('postgres','supabase_admin'))) THEN RAISE EXCEPTION 'GENERATION_LOGIN_MEMBERSHIP_POSTCHECK_FAILED'; END IF;
   IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition'
     AND has_function_privilege(who,p.oid,'EXECUTE'))<>expected_count THEN RAISE EXCEPTION 'GENERATION_LOGIN_ALLOWLIST_POSTCHECK_FAILED'; END IF;
   IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN('public','potok_nutrition','potok_control','potok_food_evidence','potok_nonfood','potok_delivery')
     AND c.relkind IN('r','p','v','m','S','f') AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(who,c.oid,'USAGE,SELECT,UPDATE')
       ELSE has_table_privilege(who,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END) THEN RAISE EXCEPTION 'GENERATION_LOGIN_TABLE_ACCESS_POSTCHECK_FAILED'; END IF;
   IF EXISTS(SELECT FROM pg_class WHERE relowner=to_regrole(who)) THEN RAISE EXCEPTION 'GENERATION_LOGIN_OWNERSHIP_POSTCHECK_FAILED'; END IF;
 END LOOP;
END $postcheck$;
COMMIT;
