-- Review-only retirement of unsafe legacy table-by-table generation/replanning.
-- Existing plan reads and bounded execution annotations remain; Graph runtime stays OFF.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE r record;p pg_proc;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attname='execution_reason' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Expected reviewed PG17 actor and original session shape';END IF;
 FOR r IN SELECT unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) AS name LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||r.name) AND relkind='r' AND relrowsecurity AND pg_get_userbyid(relowner)='postgres')
  THEN RAISE EXCEPTION 'Legacy plan table ownership/RLS requires review: %',r.name;END IF;
 END LOOP;
 IF (SELECT array_agg(attname::text ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attnum>0 AND NOT attisdropped)
 IS DISTINCT FROM ARRAY['id','program_id','date','session_type','plan_payload','status','created_at']
 OR EXISTS(SELECT FROM unnest(ARRAY['nutrition_programs','training_programs','program_sessions']) t(name)
  WHERE NOT has_column_privilege('authenticated','public.'||t.name,'status','UPDATE') OR NOT has_table_privilege('authenticated','public.'||t.name,'SELECT'))
 THEN RAISE EXCEPTION 'Expected existing bounded execution capability and session shape';END IF;
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('potok_delivery.program_scope_v1(uuid)');
 IF NOT FOUND OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
 OR md5(p.prosrc)<>'b05c7dd8e77f3c5cba77fd73236e01af' OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'Reviewed scoped program reader from #207 required';END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) grantee(role_name),
  unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) t(name)
  WHERE has_table_privilege(grantee.role_name,'public.'||t.name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) grantee(role_name)
  WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
  AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(grantee.role_name,c.oid,a.attnum,'UPDATE,REFERENCES'))
 THEN RAISE EXCEPTION 'Prior history containment from #208 required';END IF;
END
$preflight$;
CREATE TEMP TABLE legacy_plan_keep_table_caps ON COMMIT DROP AS
 SELECT r.role_name,t.table_name,p.privilege,has_table_privilege(r.role_name,'public.'||t.table_name,p.privilege) AS allowed
 FROM unnest(ARRAY['anon','authenticated','service_role']) r(role_name),
 unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) t(table_name),
 unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
 WHERE r.role_name='service_role' OR p.privilege='SELECT';
CREATE TEMP TABLE legacy_plan_keep_column_caps ON COMMIT DROP AS
 SELECT r.role_name,c.relname AS table_name,a.attname AS col,p.privilege,has_column_privilege(r.role_name,c.oid,a.attnum,p.privilege) AS allowed
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
 unnest(ARRAY['anon','authenticated','service_role']) r(role_name),unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
 WHERE c.oid IN('public.nutrition_programs'::regclass,'public.training_programs'::regclass,'public.program_phases'::regclass,'public.program_blocks'::regclass,'public.program_days'::regclass,'public.program_sessions'::regclass,'public.program_generation_jobs'::regclass,'public.program_versions'::regclass,'public.program_adaptations'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped AND (r.role_name='service_role' OR p.privilege='SELECT');

ALTER TABLE public.program_sessions ADD COLUMN execution_reason text
 CHECK(execution_reason IS NULL OR execution_reason IN('fatigue','pose_risk','user_override'));
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON
 public.nutrition_programs,public.training_programs,public.program_phases,public.program_blocks,public.program_days,public.program_sessions,public.program_generation_jobs
 FROM PUBLIC,anon,authenticated;
REVOKE INSERT ON public.program_versions,public.program_adaptations FROM PUBLIC,anon,authenticated;
DO $columns$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.relname,a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE c.oid IN('public.nutrition_programs'::regclass,'public.training_programs'::regclass,'public.program_phases'::regclass,'public.program_blocks'::regclass,'public.program_days'::regclass,'public.program_sessions'::regclass,'public.program_generation_jobs'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I),UPDATE(%I),REFERENCES(%I) ON public.%I FROM PUBLIC,anon,authenticated',r.attname,r.attname,r.attname,r.relname);
 END LOOP;
 FOR r IN SELECT c.relname,a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass) AND a.attnum>0 AND NOT a.attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I) ON public.%I FROM PUBLIC,anon,authenticated',r.attname,r.relname);
 END LOOP;
END
$columns$;
GRANT UPDATE(status) ON public.nutrition_programs,public.training_programs TO authenticated;
GRANT UPDATE(status,execution_reason) ON public.program_sessions TO authenticated;
CREATE POLICY legacy_session_scope_read_v1 ON public.program_sessions AS RESTRICTIVE FOR SELECT TO authenticated
 USING(potok_delivery.program_scope_v1(program_id)=CASE session_type WHEN 'meal_plan' THEN 'nutrition' WHEN 'workout_plan' THEN 'training' END);
CREATE POLICY legacy_session_scope_update_v1 ON public.program_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(potok_delivery.program_scope_v1(program_id)=CASE session_type WHEN 'meal_plan' THEN 'nutrition' WHEN 'workout_plan' THEN 'training' END)
 WITH CHECK(potok_delivery.program_scope_v1(program_id)=CASE session_type WHEN 'meal_plan' THEN 'nutrition' WHEN 'workout_plan' THEN 'training' END);
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
  unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) t(name)
  WHERE has_table_privilege(r.role_name,'public.'||t.name,'INSERT'))
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
  unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs']) t(name)
  WHERE has_table_privilege(r.role_name,'public.'||t.name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) r(role_name)
  WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass)
  AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.role_name,c.oid,a.attnum,'INSERT'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) r(role_name)
  WHERE c.oid IN('public.nutrition_programs'::regclass,'public.training_programs'::regclass,'public.program_phases'::regclass,'public.program_blocks'::regclass,'public.program_days'::regclass,'public.program_sessions'::regclass,'public.program_generation_jobs'::regclass)
  AND a.attnum>0 AND NOT a.attisdropped AND (
   has_column_privilege(r.role_name,c.oid,a.attnum,'INSERT,REFERENCES') OR
   (has_column_privilege(r.role_name,c.oid,a.attnum,'UPDATE') AND NOT(r.role_name='authenticated' AND ((c.relname IN('nutrition_programs','training_programs') AND a.attname='status') OR (c.relname='program_sessions' AND a.attname IN('status','execution_reason')))))))
 OR EXISTS(SELECT FROM legacy_plan_keep_table_caps c WHERE c.allowed IS DISTINCT FROM has_table_privilege(c.role_name,'public.'||c.table_name,c.privilege))
 OR EXISTS(SELECT FROM legacy_plan_keep_column_caps c WHERE c.allowed IS DISTINCT FROM has_column_privilege(c.role_name,'public.'||c.table_name,c.col,c.privilege))
 OR NOT has_column_privilege('authenticated','public.nutrition_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.training_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','execution_reason','UPDATE')
 THEN RAISE EXCEPTION 'Legacy quarantine effective permission or compatibility verification failed';END IF;
END
$verify$;
ROLLBACK;
