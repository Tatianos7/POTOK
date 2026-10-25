-- LOCAL RESTORED DATABASE ONLY. Profile column permission rehearsal; ALWAYS ROLLS BACK.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, pg_temp;
CREATE TEMP TABLE potok_profile_allowed(name text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO potok_profile_allowed VALUES ('id_user'),('first_name'),('last_name'),('middle_name'),
  ('birth_date'),('age'),('height'),('goal'),('email'),('phone'),('avatar_url'),
  ('coach_settings'),('voice_settings');
CREATE TEMP TABLE potok_profile_protected(name text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO potok_profile_protected VALUES ('is_admin'),('has_premium'),('created_at'),('updated_at');
DO $preflight$
DECLARE t record;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected effective role postgres'; END IF;
  SELECT * INTO t FROM pg_class WHERE oid=to_regclass('public.user_profiles');
  IF NOT FOUND OR t.relkind <> 'r' OR t.relowner <> 'postgres'::regrole OR NOT t.relrowsecurity THEN
    RAISE EXCEPTION 'Profile table ownership or RLS drift requires review';
  END IF;
  IF EXISTS ((SELECT name FROM potok_profile_allowed UNION SELECT name FROM potok_profile_protected)
    EXCEPT SELECT attname FROM pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped)
    OR EXISTS (SELECT attname FROM pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped
    EXCEPT (SELECT name FROM potok_profile_allowed UNION SELECT name FROM potok_profile_protected)) THEN
    RAISE EXCEPTION 'Profile columns changed; review the allowlist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=t.oid AND attname='id_user'
    AND atttypid='uuid'::regtype AND attnotnull) THEN
    RAISE EXCEPTION 'Expected non-null UUID profile key';
  END IF;
  IF (SELECT count(*) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=t.oid AND a.attname IN ('is_admin','has_premium') AND a.atttypid='boolean'::regtype
      AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='false') <> 2 THEN
    RAISE EXCEPTION 'Privilege defaults must be non-null false';
  END IF;
  -- id_user UPDATE is required by PostgREST upsert. Require the exact bounded
  -- ownership policy shape before preserving that column privilege.
  IF (SELECT count(*) FROM pg_policy WHERE polrelid=t.oid) <> 3 OR EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid=t.oid AND (
      NOT p.polpermissive OR p.polroles <> ARRAY['authenticated'::regrole::oid]
      OR p.polcmd NOT IN ('r','a','w')
      OR CASE p.polcmd
        WHEN 'r' THEN p.polwithcheck IS NOT NULL OR regexp_replace(pg_get_expr(p.polqual,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
        WHEN 'a' THEN p.polqual IS NOT NULL OR regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
        WHEN 'w' THEN regexp_replace(pg_get_expr(p.polqual,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
          OR regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
        ELSE true END
    )) OR (SELECT count(DISTINCT polcmd) FROM pg_policy WHERE polrelid=t.oid) <> 3 THEN
    RAISE EXCEPTION 'Profile ownership policy shape requires review';
  END IF;
END
$preflight$;
CREATE TEMP TABLE potok_profile_service ON COMMIT DROP AS
  SELECT a.attname, has_column_privilege('service_role',a.attrelid,a.attname,'INSERT') AS ins,
    has_column_privilege('service_role',a.attrelid,a.attname,'UPDATE') AS upd
  FROM pg_attribute a WHERE a.attrelid='public.user_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped;
CREATE TEMP TABLE potok_profile_baseline ON COMMIT DROP AS
  SELECT md5(string_agg(to_jsonb(p)::text,',' ORDER BY p.oid)) AS policies,
    has_table_privilege('authenticated','public.user_profiles','SELECT') AS authenticated_select
  FROM pg_policy p WHERE polrelid='public.user_profiles'::regclass;
REVOKE INSERT, UPDATE ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;
DO $columns$
DECLARE c record;
BEGIN
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass
    AND attnum>0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated',c.attname,c.attname);
  END LOOP;
END
$columns$;
GRANT INSERT (id_user,first_name,last_name,middle_name,birth_date,age,height,goal,email,phone,avatar_url,coach_settings,voice_settings)
  ON public.user_profiles TO authenticated;
GRANT UPDATE (id_user,first_name,last_name,middle_name,birth_date,age,height,goal,email,phone,avatar_url,coach_settings,voice_settings)
  ON public.user_profiles TO authenticated;
DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM potok_profile_protected c WHERE
    has_column_privilege('authenticated','public.user_profiles',c.name,'INSERT')
    OR has_column_privilege('authenticated','public.user_profiles',c.name,'UPDATE')) THEN
    RAISE EXCEPTION 'Effective protected column write remains; transaction will roll back';
  END IF;
  IF EXISTS (SELECT 1 FROM potok_profile_allowed c WHERE
    NOT has_column_privilege('authenticated','public.user_profiles',c.name,'INSERT')
    OR NOT has_column_privilege('authenticated','public.user_profiles',c.name,'UPDATE'))
    OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.user_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
      AND (has_column_privilege('anon',a.attrelid,a.attname,'INSERT') OR has_column_privilege('anon',a.attrelid,a.attname,'UPDATE')))
    OR EXISTS (SELECT 1 FROM potok_profile_service c WHERE
      has_column_privilege('service_role','public.user_profiles',c.attname,'INSERT') IS DISTINCT FROM c.ins
      OR has_column_privilege('service_role','public.user_profiles',c.attname,'UPDATE') IS DISTINCT FROM c.upd)
    OR (SELECT md5(string_agg(to_jsonb(p)::text,',' ORDER BY p.oid)) FROM pg_policy p WHERE polrelid='public.user_profiles'::regclass)
      IS DISTINCT FROM (SELECT policies FROM potok_profile_baseline)
    OR has_table_privilege('authenticated','public.user_profiles','SELECT') IS DISTINCT FROM
      (SELECT authenticated_select FROM potok_profile_baseline) THEN
    RAISE EXCEPTION 'Required profile access changed; transaction will roll back';
  END IF;
END
$verify$;
SELECT 'PROFILE_WRITE_REHEARSAL_OK' AS result;
SELECT name AS protected_column,
       has_column_privilege('authenticated','public.user_profiles',name,'INSERT') AS client_insert,
       has_column_privilege('authenticated','public.user_profiles',name,'UPDATE') AS client_update
FROM potok_profile_protected ORDER BY name;
ROLLBACK;
