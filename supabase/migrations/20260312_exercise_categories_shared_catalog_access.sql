-- exercise_categories shared catalog hardening
-- Production-safe, idempotent, non-destructive
-- Final posture:
-- - shared read-only catalog
-- - no client writes
-- - no anon/public access
-- - no permissive USING (true) RLS policy shape

begin;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'exercise_categories'
      and c.relkind in ('r', 'p')
  ) then
    execute 'revoke all on public.exercise_categories from public, anon, authenticated';

    execute 'drop policy if exists "Anyone can read exercise categories" on public.exercise_categories';
    execute 'drop policy if exists "Anyone can insert exercise categories" on public.exercise_categories';
    execute 'drop policy if exists exercise_categories_select_authenticated on public.exercise_categories';

    -- Shared catalogs do not benefit from RLS when access is the same for every
    -- allowed caller. Narrow grants are simpler and avoid Security Advisor
    -- warnings about always-true policies.
    execute 'alter table public.exercise_categories no force row level security';
    execute 'alter table public.exercise_categories disable row level security';

    execute 'grant select on public.exercise_categories to authenticated';
  else
    raise notice 'public.exercise_categories not found, skipping shared catalog hardening';
  end if;
end
$$;

commit;
