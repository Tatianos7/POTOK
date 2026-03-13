-- security function search_path audit
-- Read-only

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
order by
  case when p.prosecdef then 0 else 1 end,
  p.proname,
  identity_args;
