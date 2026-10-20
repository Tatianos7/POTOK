-- READ-ONLY disposable preflight. This does not authorize persistent apply.
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('potok_nonfood.test_target',true) IS DISTINCT FROM 'disposable-postgresql-only'
 OR to_regprocedure('potok_food_evidence.authority_v1()') IS NULL
 OR to_regprocedure('potok_food_evidence.source_v1(jsonb,text,jsonb)') IS NULL
 OR to_regnamespace('potok_nonfood') IS NOT NULL THEN RAISE EXCEPTION 'NONFOOD_DISPOSABLE_PREFLIGHT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='potok_food_evidence.authority_v1()'::regprocedure
  AND (pg_get_userbyid(proowner)<>'postgres' OR NOT coalesce('search_path=pg_catalog'=ANY(proconfig),false))) THEN RAISE EXCEPTION 'TRUSTED_AUTHORITY_SECURITY_REQUIRED'; END IF;
END $$;
