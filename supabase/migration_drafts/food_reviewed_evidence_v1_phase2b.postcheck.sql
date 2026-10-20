-- PREPARED ONLY. READ-ONLY metadata postcheck after a separately authorized STAGING apply.
-- No user payloads, tokens, source documents or request data are selected.
BEGIN READ ONLY;
SELECT n.nspname,c.relname,pg_catalog.pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='potok_food_evidence' AND c.relkind='r' ORDER BY c.relname;

SELECT r.rolname,c.relname,
  pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
  pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT') OR pg_catalog.has_any_column_privilege(r.oid,c.oid,'INSERT') AS can_insert,
  pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE') OR pg_catalog.has_any_column_privilege(r.oid,c.oid,'UPDATE') AS can_update,
  pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
  pg_catalog.has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname='potok_food_evidence' AND c.relkind='r'
ORDER BY r.rolname,c.relname;

SELECT n.nspname,p.oid::regprocedure,pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,
  pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='potok_food_evidence'
  OR (n.nspname='public' AND p.proname IN ('food_evidence_review_v1','food_evidence_receipt_v1','food_evidence_current_v1'))
ORDER BY n.nspname,p.proname;

SELECT c.relname,t.tgname,t.tgenabled,pg_catalog.pg_get_triggerdef(t.oid)
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='potok_food_evidence' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
ROLLBACK;
