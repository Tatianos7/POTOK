-- exercise_categories security audit
-- Read-only

-- =========================================================
-- SECTION A: RLS flags
-- =========================================================
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'exercise_categories'
  and c.relkind in ('r', 'p');

-- =========================================================
-- SECTION B: policies
-- =========================================================
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'exercise_categories'
order by policyname;

-- =========================================================
-- SECTION C: grants
-- =========================================================
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'exercise_categories'
  and grantee in ('public', 'anon', 'authenticated')
order by grantee, privilege_type;
