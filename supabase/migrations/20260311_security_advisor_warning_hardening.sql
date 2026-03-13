-- Remaining Security Advisor warning hardening
-- Production-safe, idempotent, non-destructive
-- Focus:
-- - mutable search_path on public functions
-- - re-assert security_invoker on the known public client view

begin;

-- Re-assert safer view behavior for the client-facing exercises view.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'exercises_full_view'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.exercises_full_view set (security_invoker = true)';
  end if;
end
$$;

-- Blanket-fix mutable search_path for all non-extension functions in public schema.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1
        from pg_depend d
        join pg_extension e
          on e.oid = d.refobjid
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end
$$;

commit;
