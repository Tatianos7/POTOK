-- PREPARED ONLY. Metadata inventory for separately authorized owner review.
-- READ ONLY: no counts, user records, payloads, source bytes or function bodies.
-- Drafts in Git are not proof of what is deployed. Run only on the approved project.
BEGIN READ ONLY;
WITH RECURSIVE edges AS (
  SELECT c.oid,c.conname,c.conrelid AS child,c.confrelid AS parent,
    c.confdeltype,c.confupdtype,c.condeferrable,c.condeferred,c.convalidated
  FROM pg_catalog.pg_constraint c WHERE c.contype='f'
), roots(root) AS (
  SELECT r FROM (VALUES (pg_catalog.to_regclass('auth.users')),
    (pg_catalog.to_regclass('public.foods'))) AS target(r) WHERE r IS NOT NULL
), dependency_walk(root,child,parent,constraint_oid,depth,path) AS (
  SELECT root,e.child,e.parent,e.oid,1,ARRAY[root::oid,e.child]
  FROM roots JOIN edges e ON e.parent=roots.root
  UNION ALL
  SELECT w.root,e.child,e.parent,e.oid,w.depth+1,w.path||e.child
  FROM dependency_walk w JOIN edges e ON e.parent=w.child
  WHERE w.depth<32 AND NOT e.child=ANY(w.path)
)
SELECT w.root::regclass::text AS deletion_root,w.depth,
  w.parent::regclass::text AS referenced_table,w.child::regclass::text AS dependent_table,
  e.conname,e.confdeltype AS delete_action,e.confupdtype AS update_action,
  e.condeferrable,e.condeferred,e.convalidated,
  pg_catalog.pg_get_constraintdef(e.oid,true) AS definition
FROM dependency_walk w JOIN edges e ON e.oid=w.constraint_oid
ORDER BY deletion_root,w.depth,referenced_table,dependent_table,e.conname;

SELECT c.conrelid::regclass::text AS child,c.confrelid::regclass::text AS parent,
  c.conname,c.confdeltype,c.confupdtype,c.condeferrable,c.condeferred,c.convalidated,
  pg_catalog.pg_get_constraintdef(c.oid,true) AS definition
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class r ON r.oid=c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace
WHERE c.contype='f' AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY child,c.conname;

SELECT n.nspname,c.relname,t.tgname,t.tgenabled,pg_catalog.pg_get_triggerdef(t.oid,true) AS definition
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname IN
  ('public','potok_food_evidence','potok_control','potok_nutrition','auth','storage')
ORDER BY n.nspname,c.relname,t.tgname;

SELECT n.nspname,c.relname,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND n.nspname IN
  ('public','potok_food_evidence','potok_control','potok_nutrition','storage')
ORDER BY n.nspname,c.relname;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_catalog.pg_policies WHERE schemaname IN
  ('public','potok_food_evidence','potok_control','potok_nutrition','storage')
ORDER BY schemaname,tablename,policyname;

-- Function signatures/security metadata only; no body or runtime invocation.
-- Names/keyword search cannot prove absence of indirect/dynamic deletion.
SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef,p.proconfig,p.proacl
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE p.prokind='f' AND n.nspname IN
  ('public','potok_food_evidence','potok_control','potok_nutrition')
ORDER BY n.nspname,p.proname,arguments;

SELECT table_schema,table_name,column_name,data_type,is_nullable
FROM information_schema.columns WHERE table_schema IN
  ('public','potok_food_evidence','potok_control','potok_nutrition','storage')
ORDER BY table_schema,table_name,ordinal_position;

SELECT table_schema,table_name,grantee,privilege_type
FROM information_schema.role_table_grants WHERE grantee IN
  ('PUBLIC','anon','authenticated','service_role') AND table_schema IN
  ('public','potok_food_evidence','potok_control','potok_nutrition','storage')
ORDER BY table_schema,table_name,grantee,privilege_type;
ROLLBACK;
