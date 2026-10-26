-- Review-only client history containment. No plan generation/activation.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE r record; names text[];
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 THEN RAISE EXCEPTION 'Expected reviewed nonsuperuser postgres PG17 actor';END IF;
 FOR r IN SELECT * FROM (VALUES
  ('program_versions',ARRAY['id','program_id','program_type','version','snapshot','reason','created_at']),
  ('program_adaptations',ARRAY['id','program_id','program_type','from_version','to_version','trigger','summary','created_at']),
  ('program_explainability',ARRAY['id','program_id','program_type','version','decision_ref','knowledge_refs','confidence','guard_notes','created_at']),
  ('program_guard_events',ARRAY['id','program_id','program_type','risk_level','flags','blocked_actions','created_at'])
 ) v(name,columns) LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||r.name) AND relkind='r' AND relrowsecurity AND pg_get_userbyid(relowner)='postgres')
  THEN RAISE EXCEPTION 'History table ownership/RLS requires review: %',r.name;END IF;
  SELECT array_agg(attname::text ORDER BY attnum) INTO names FROM pg_attribute
   WHERE attrelid=to_regclass('public.'||r.name) AND attnum>0 AND NOT attisdropped;
  IF names IS DISTINCT FROM r.columns THEN RAISE EXCEPTION 'History shape requires review: %',r.name;END IF;
 END LOOP;
END
$preflight$;

CREATE TEMP TABLE history_preserved_table_caps ON COMMIT DROP AS
 SELECT role_name,table_name,privilege,has_table_privilege(role_name,'public.'||table_name,privilege) AS allowed
 FROM unnest(ARRAY['anon','authenticated','service_role']) role_name,
 unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) table_name,
 unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege
 WHERE role_name='service_role' OR privilege IN('SELECT','INSERT');
CREATE TEMP TABLE history_preserved_column_caps ON COMMIT DROP AS
 SELECT role_name,c.relname AS table_name,a.attname AS col,privilege,
 has_column_privilege(role_name,c.oid,a.attnum,privilege) AS allowed
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
 unnest(ARRAY['anon','authenticated','service_role']) role_name,
 unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) privilege
 WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped AND (role_name='service_role' OR privilege IN('SELECT','INSERT'));

REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON
 public.program_versions,public.program_adaptations,public.program_explainability,public.program_guard_events
 FROM PUBLIC,anon,authenticated;
DO $column_revoke$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.relname,a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped LOOP
  EXECUTE format('REVOKE UPDATE(%I),REFERENCES(%I) ON public.%I FROM PUBLIC,anon,authenticated',r.attname,r.attname,r.relname);
 END LOOP;
END
$column_revoke$;
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,
  unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) table_name,
  unnest(ARRAY['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege
  WHERE has_table_privilege(role_name,'public.'||table_name,privilege))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
  unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['UPDATE','REFERENCES']) privilege
  WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
   AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(role_name,c.oid,a.attnum,privilege))
 THEN RAISE EXCEPTION 'History client mutation boundary requires role/owner review';END IF;
 IF EXISTS(SELECT FROM history_preserved_table_caps c WHERE c.allowed IS DISTINCT FROM has_table_privilege(c.role_name,'public.'||c.table_name,c.privilege))
 OR EXISTS(SELECT FROM history_preserved_column_caps c WHERE c.allowed IS DISTINCT FROM has_column_privilege(c.role_name,'public.'||c.table_name,c.col,c.privilege))
 THEN RAISE EXCEPTION 'History read/insert/service compatibility would change';END IF;
END
$verify$;
ROLLBACK;
