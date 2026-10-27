-- Metadata only. No user rows, files, role changes, functions or application writes.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
WITH relation_state AS (
 SELECT c.oid,c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relkind
 FROM pg_class c WHERE c.relnamespace='public'::regnamespace
), canonical_metadata AS (
 SELECT jsonb_build_object(
  'relations',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relkind,c.owner,c.relrowsecurity) ORDER BY c.relname) FROM relation_state c),
  'columns',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text) ORDER BY c.relname,a.attnum) FROM relation_state c JOIN pg_attribute a ON a.attrelid=c.oid WHERE a.attnum>0 AND NOT a.attisdropped),
  'table_acl',(SELECT jsonb_agg(jsonb_build_array(c.relname,p.relacl::text) ORDER BY c.relname) FROM relation_state c JOIN pg_class p ON p.oid=c.oid),
  'routines',(SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text,md5(p.prosrc)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
  'policies',(SELECT jsonb_agg(jsonb_build_array(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check) ORDER BY tablename,policyname) FROM pg_policies WHERE schemaname='public'),
  'defaults',(SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype,d.defaclacl::text) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN('public','extensions'))
 ) AS document
)
SELECT jsonb_build_object(
 'protocol','potok-release-preflight-v1',
 'observed_at',clock_timestamp(),
 'actor',current_user,'session_actor',session_user,
 'actor_super',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
 'actor_bypass',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user),
 'server_version_num',current_setting('server_version_num')::integer,
 'replication_role',current_setting('session_replication_role'),
 'public_metadata_sha256',encode(sha256(convert_to(document::text,'UTF8')),'hex'),
 'public_tables',(SELECT count(*) FROM relation_state WHERE relkind IN('r','p')),
 'plan_tables_reviewed',(SELECT count(*) FROM relation_state WHERE relname=ANY(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) AND owner='postgres' AND relrowsecurity AND relkind='r'),
 'candidate_namespaces',(SELECT coalesce(jsonb_agg(nspname ORDER BY nspname),'[]'::jsonb) FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery')),
 'execution_reason_present',EXISTS(SELECT FROM pg_attribute WHERE attrelid=to_regclass('public.program_sessions') AND attname='execution_reason' AND NOT attisdropped),
 'session_columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) ORDER BY attnum),'[]'::jsonb) FROM pg_attribute WHERE attrelid=to_regclass('public.program_sessions') AND attnum>0 AND NOT attisdropped),
 'client_truncate_tables',(SELECT count(*) FROM relation_state c WHERE relkind IN('r','p') AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))),
 'protected_profile_write_columns',(SELECT count(*) FROM unnest(ARRAY['is_admin','has_premium','created_at','updated_at']) col WHERE has_column_privilege('authenticated','public.user_profiles',col,'INSERT') OR has_column_privilege('authenticated','public.user_profiles',col,'UPDATE')),
 'trgm',(SELECT jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(e.extowner),'relocatable',e.extrelocatable,'ordinary_actor_owner_access',pg_has_role(current_user,e.extowner,'USAGE')) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'),
 'rest_schema_settings',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',CASE WHEN s.setrole=0 THEN 'ALL' ELSE pg_get_userbyid(s.setrole) END,'database_scope',CASE WHEN s.setdatabase=0 THEN 'ALL' ELSE 'DATABASE' END,'value',substring(x FROM length('pgrst.db_schemas=')+1)) ORDER BY s.setrole,s.setdatabase),'[]'::jsonb) FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) x WHERE x LIKE 'pgrst.db_schemas=%')
) AS preflight
FROM canonical_metadata;
ROLLBACK;
