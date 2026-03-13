-- exercise_categories final Security Advisor fix
-- Production-safe, idempotent, non-destructive
-- Goal:
-- - keep RLS enabled so Security Advisor does not flag "RLS Disabled in Public"
-- - remove old permissive policy shapes
-- - allow read-only access only to authenticated users
-- - keep anon/public and client writes blocked

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
    execute 'alter table public.exercise_categories enable row level security';
    execute 'alter table public.exercise_categories force row level security';

    execute 'revoke all on public.exercise_categories from public, anon, authenticated';
    execute 'grant select on public.exercise_categories to authenticated';

    -- Fix note:
    -- Security Advisor flagged the original policy shape because it used
    -- USING (true). Keep the table as shared read-only catalog access, but make
    -- the authenticated-only posture explicit and keep client writes blocked.
    execute 'drop policy if exists "Anyone can read exercise categories" on public.exercise_categories';
    execute 'drop policy if exists "Anyone can insert exercise categories" on public.exercise_categories';
    execute 'drop policy if exists exercise_categories_select_authenticated on public.exercise_categories';

    execute '
      create policy exercise_categories_select_authenticated
      on public.exercise_categories
      for select
      to authenticated
      using (auth.role() = ''authenticated'')
    ';
  else
    raise notice ''public.exercise_categories not found, skipping RLS hardening'';
  end if;
end
$$;

commit;
