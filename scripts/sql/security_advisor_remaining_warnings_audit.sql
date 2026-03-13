-- Security Advisor remaining warnings audit
-- Read-only

-- =========================================================
-- SECTION A: public functions missing explicit search_path
-- =========================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  p.prosecdef as is_security_definer,
  coalesce(
    (
      select regexp_replace(setting, '^search_path=', '')
      from unnest(coalesce(p.proconfig, '{}'::text[])) as setting
      where setting like 'search_path=%'
      limit 1
    ),
    ''
  ) as configured_search_path
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, '{}'::text[])) as setting
    where setting like 'search_path=%'
  )
order by
  case when p.prosecdef then 0 else 1 end,
  p.proname,
  identity_args;

-- =========================================================
-- SECTION B: public views without explicit security_invoker
-- =========================================================
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.reloptions,
  coalesce(
    exists (
      select 1
      from unnest(coalesce(c.reloptions, '{}'::text[])) as opt
      where opt = 'security_invoker=true'
    ),
    false
  ) as has_security_invoker
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
order by c.relname;

-- =========================================================
-- SECTION C: security definer functions in public schema
-- =========================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  coalesce(
    (
      select regexp_replace(setting, '^search_path=', '')
      from unnest(coalesce(p.proconfig, '{}'::text[])) as setting
      where setting like 'search_path=%'
      limit 1
    ),
    ''
  ) as configured_search_path
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
  and p.prokind = 'f'
order by p.proname, identity_args;
