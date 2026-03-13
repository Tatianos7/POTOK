-- security public access audit
-- Read-only

-- =========================================================
-- SECTION A: table/view grants to anon/authenticated/public
-- =========================================================
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;

-- =========================================================
-- SECTION B: functions executable by anon/authenticated/public
-- =========================================================
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
order by routine_name, grantee, privilege_type;

-- =========================================================
-- SECTION C: view security posture
-- =========================================================
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
order by c.relname;
