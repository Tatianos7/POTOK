-- Supabase Security Advisor hardening baseline
-- Production-safe, idempotent, non-destructive
-- Scope:
-- - user-owned tables: habits, user_goals, habit_logs, user_profiles
-- - insert-only client telemetry: analytics_events
-- - view hardening: exercises_full_view
-- - mutable search_path warnings on actively used public functions

begin;

-- =========================================================
-- habits
-- =========================================================
do $$
declare
  v_owner_col text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'habits'
      and c.relkind in ('r', 'p')
  ) then
    execute 'alter table public.habits enable row level security';
    execute 'alter table public.habits force row level security';
    execute 'revoke all on public.habits from public, anon, authenticated';
    execute 'grant select, insert, update, delete on public.habits to authenticated';

    select c.column_name
    into v_owner_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'habits'
      and c.column_name in ('user_id', 'id_user', 'id')
    order by case c.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
    limit 1;

    if v_owner_col is null then
      raise notice 'Skipping habits policies: no owner column found';
      return;
    end if;

    execute 'drop policy if exists habits_select_own on public.habits';
    execute 'drop policy if exists habits_insert_own on public.habits';
    execute 'drop policy if exists habits_update_own on public.habits';
    execute 'drop policy if exists habits_delete_own on public.habits';

    execute format('
      create policy habits_select_own
      on public.habits
      for select
      to authenticated
      using (auth.uid() = %I)
    ', v_owner_col);
    execute format('
      create policy habits_insert_own
      on public.habits
      for insert
      to authenticated
      with check (auth.uid() = %I)
    ', v_owner_col);
    execute format('
      create policy habits_update_own
      on public.habits
      for update
      to authenticated
      using (auth.uid() = %I)
      with check (auth.uid() = %I)
    ', v_owner_col, v_owner_col);
    execute format('
      create policy habits_delete_own
      on public.habits
      for delete
      to authenticated
      using (auth.uid() = %I)
    ', v_owner_col);
  end if;
end
$$;

-- =========================================================
-- user_goals
-- =========================================================
do $$
declare
  v_owner_col text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_goals'
      and c.relkind in ('r', 'p')
  ) then
    execute 'alter table public.user_goals enable row level security';
    execute 'alter table public.user_goals force row level security';
    execute 'revoke all on public.user_goals from public, anon, authenticated';
    execute 'grant select, insert, update on public.user_goals to authenticated';

    select c.column_name
    into v_owner_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'user_goals'
      and c.column_name in ('user_id', 'id_user', 'id')
    order by case c.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
    limit 1;

    if v_owner_col is null then
      raise notice 'Skipping user_goals policies: no owner column found';
      return;
    end if;

    execute 'drop policy if exists user_goals_select_own on public.user_goals';
    execute 'drop policy if exists user_goals_insert_own on public.user_goals';
    execute 'drop policy if exists user_goals_update_own on public.user_goals';

    execute format('
      create policy user_goals_select_own
      on public.user_goals
      for select
      to authenticated
      using (auth.uid() = %I)
    ', v_owner_col);
    execute format('
      create policy user_goals_insert_own
      on public.user_goals
      for insert
      to authenticated
      with check (auth.uid() = %I)
    ', v_owner_col);
    execute format('
      create policy user_goals_update_own
      on public.user_goals
      for update
      to authenticated
      using (auth.uid() = %I)
      with check (auth.uid() = %I)
    ', v_owner_col, v_owner_col);
  end if;
end
$$;

-- =========================================================
-- habit_logs
-- =========================================================
do $$
declare
  v_logs_owner_col text;
  v_habit_id_col text;
  v_habits_owner_col text;
  v_using_expr text;
  v_check_expr text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'habit_logs'
      and c.relkind in ('r', 'p')
  ) then
    execute 'alter table public.habit_logs enable row level security';
    execute 'alter table public.habit_logs force row level security';
    execute 'revoke all on public.habit_logs from public, anon, authenticated';
    execute 'grant select, insert, update, delete on public.habit_logs to authenticated';

    select c.column_name
    into v_logs_owner_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'habit_logs'
      and c.column_name in ('user_id', 'id_user', 'id')
    order by case c.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
    limit 1;

    select c.column_name
    into v_habit_id_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'habit_logs'
      and c.column_name = 'habit_id'
    limit 1;

    select c.column_name
    into v_habits_owner_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'habits'
      and c.column_name in ('user_id', 'id_user', 'id')
    order by case c.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
    limit 1;

    if v_logs_owner_col is not null and v_habit_id_col is not null and v_habits_owner_col is not null then
      v_using_expr := format(
        'auth.uid() = %1$I and exists (
          select 1 from public.habits h
          where h.id = %2$I and h.%3$I = auth.uid()
        )',
        v_logs_owner_col, v_habit_id_col, v_habits_owner_col
      );
      v_check_expr := v_using_expr;
    elsif v_habit_id_col is not null and v_habits_owner_col is not null then
      v_using_expr := format(
        'exists (
          select 1 from public.habits h
          where h.id = %1$I and h.%2$I = auth.uid()
        )',
        v_habit_id_col, v_habits_owner_col
      );
      v_check_expr := v_using_expr;
    elsif v_logs_owner_col is not null then
      v_using_expr := format('auth.uid() = %I', v_logs_owner_col);
      v_check_expr := v_using_expr;
    else
      raise notice 'Skipping habit_logs policies: no safe owner strategy found';
      return;
    end if;

    execute 'drop policy if exists habit_logs_select_own on public.habit_logs';
    execute 'drop policy if exists habit_logs_insert_own on public.habit_logs';
    execute 'drop policy if exists habit_logs_update_own on public.habit_logs';
    execute 'drop policy if exists habit_logs_delete_own on public.habit_logs';

    execute format('
      create policy habit_logs_select_own
      on public.habit_logs
      for select
      to authenticated
      using (%s)
    ', v_using_expr);
    execute format('
      create policy habit_logs_insert_own
      on public.habit_logs
      for insert
      to authenticated
      with check (%s)
    ', v_check_expr);
    execute format('
      create policy habit_logs_update_own
      on public.habit_logs
      for update
      to authenticated
      using (%s)
      with check (%s)
    ', v_using_expr, v_check_expr);
    execute format('
      create policy habit_logs_delete_own
      on public.habit_logs
      for delete
      to authenticated
      using (%s)
    ', v_using_expr);
  end if;
end
$$;

-- =========================================================
-- analytics_events
-- =========================================================
do $$
declare
  v_owner_col text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'analytics_events'
      and c.relkind in ('r', 'p')
  ) then
    execute 'alter table public.analytics_events enable row level security';
    execute 'alter table public.analytics_events force row level security';
    execute 'revoke all on public.analytics_events from public, anon, authenticated';
    execute 'revoke insert on public.analytics_events from authenticated';

    select c.column_name
    into v_owner_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'analytics_events'
      and c.column_name in ('user_id', 'id_user', 'id')
    order by case c.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
    limit 1;

    if v_owner_col is null then
      raise notice 'Skipping analytics_events client insert policy: no safe owner column found';
      return;
    end if;

    execute 'grant insert on public.analytics_events to authenticated';

    execute 'drop policy if exists analytics_events_insert_own on public.analytics_events';
    execute format('
      create policy analytics_events_insert_own
      on public.analytics_events
      for insert
      to authenticated
      with check (auth.uid() = %I)
    ', v_owner_col);
  end if;
end
$$;

-- =========================================================
-- user_profiles
-- =========================================================
do $$
declare
  v_owner_col text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_profiles'
      and c.relkind in ('r', 'p')
  ) then
    execute 'alter table public.user_profiles enable row level security';
    execute 'alter table public.user_profiles force row level security';
    execute 'revoke all on public.user_profiles from public, anon, authenticated';
    execute 'grant select, insert, update on public.user_profiles to authenticated';

    select c.column_name
    into v_owner_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'user_profiles'
      and c.column_name in ('user_id', 'id_user', 'id')
    order by case c.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
    limit 1;

    if v_owner_col is null then
      raise notice 'Skipping user_profiles policies: no owner column found';
      return;
    end if;

    execute 'drop policy if exists user_profiles_select_own on public.user_profiles';
    execute 'drop policy if exists user_profiles_insert_own on public.user_profiles';
    execute 'drop policy if exists user_profiles_update_own on public.user_profiles';

    execute format('
      create policy user_profiles_select_own
      on public.user_profiles
      for select
      to authenticated
      using (auth.uid() = %I)
    ', v_owner_col);
    execute format('
      create policy user_profiles_insert_own
      on public.user_profiles
      for insert
      to authenticated
      with check (auth.uid() = %I)
    ', v_owner_col);
    execute format('
      create policy user_profiles_update_own
      on public.user_profiles
      for update
      to authenticated
      using (auth.uid() = %I)
      with check (auth.uid() = %I)
    ', v_owner_col, v_owner_col);
  end if;
end
$$;

-- =========================================================
-- exercises_full_view
-- Safer than default view behavior: make it obey invoker permissions/RLS.
-- =========================================================
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
    execute 'revoke all on public.exercises_full_view from public, anon, authenticated';
    execute 'grant select on public.exercises_full_view to authenticated';
  end if;
end
$$;

-- =========================================================
-- Functions: fix mutable search_path on actively used public functions
-- =========================================================
do $$ begin execute 'alter function public.recompute_food_entries_for_food_ids(uuid[]) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.toggle_habit_log(uuid, uuid, date) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.recompute_recipe_totals(uuid) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.replace_recipe_ingredients_atomic(uuid, uuid, jsonb, numeric, numeric) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.recipe_ingredients_recompute_trigger() set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.update_recipe_ingredients_updated_at() set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_entitlements(uuid) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_paywall_state(text, uuid) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.start_purchase(uuid, text, text, text) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.restore_purchase(uuid, text, text, text) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_active_program(text) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_program_phases(uuid) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_program_days(uuid) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_program_day_details(uuid, date) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_program_explainability(uuid, integer) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;
do $$ begin execute 'alter function public.get_program_status(uuid) set search_path = public, pg_temp'; exception when undefined_function then null; end $$;

commit;
