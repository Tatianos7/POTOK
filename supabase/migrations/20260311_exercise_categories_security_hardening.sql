-- Security Advisor warning hardening: public.exercise_categories
-- Production-safe, idempotent, non-destructive
-- Goal:
-- - remove overly permissive read policy shape
-- - make read-only reference access explicit for authenticated users
-- - keep workout/exercise flows working

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
    -- Security Advisor flags policy shapes that are effectively USING (true).
    -- Keep the table read-only, but make the authenticated-only posture explicit.
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
    raise notice 'public.exercise_categories not found, skipping hardening block';
  end if;
end
$$;

commit;
