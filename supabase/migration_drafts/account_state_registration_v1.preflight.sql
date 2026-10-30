-- SELECT-only preparation. Run only in an independently authorized target/session.
BEGIN READ ONLY;
SELECT current_database() AS database_name,current_user AS sql_actor,current_setting('server_version_num') AS postgres_version,
 to_regclass('potok_closure.accounts_v1') IS NOT NULL AS closure_state_present,
 to_regclass('potok_closure.registration_records_v1') IS NOT NULL AS registration_present;
SELECT t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS trigger_definition,p.oid::regprocedure AS function_signature,
 pg_get_userbyid(p.proowner) AS function_owner,p.prosecdef,p.proconfig,
 encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') AS function_sha256
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal ORDER BY t.tgname;
SELECT encode(extensions.digest(convert_to(coalesce(string_agg(pg_get_triggerdef(t.oid)||':'||t.tgenabled::text||':'||pg_get_userbyid(p.proowner)::text||':'||p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,','),'')||':'||
 encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),E'\n' ORDER BY t.tgname),''),'UTF8'),'sha256'),'hex')
 AS auth_trigger_inventory_sha256
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS field_type,a.attnotnull
FROM pg_attribute a WHERE a.attrelid='auth.users'::regclass AND a.attnum>0 AND NOT a.attisdropped
 AND a.attname IN ('id','created_at','is_anonymous') ORDER BY a.attname;
SELECT r.rolname,r.rolsuper,r.rolbypassrls,
 has_table_privilege(r.oid,'auth.users','INSERT') AS can_insert_auth_users
FROM pg_roles r WHERE r.rolname IN (current_user,'supabase_auth_admin','anon','authenticated','service_role') ORDER BY r.rolname;
-- Aggregate readiness is not an ACTIVE approval. No names, emails, raw identities or source rows.
SELECT count(*) AS auth_total,count(*) FILTER(WHERE is_anonymous IS false) AS nonanonymous_total,
 count(*) FILTER(WHERE created_at IS NULL) AS missing_creation_binding FROM auth.users;
ROLLBACK;
