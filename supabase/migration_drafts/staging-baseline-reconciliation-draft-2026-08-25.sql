-- POTOK staging baseline reconciliation draft
-- DRAFT ONLY. Staging-only. Do not apply without explicit owner approval.
--
-- Purpose:
-- - repair the minimal staging baseline before retrying Premium data model apply
-- - create missing baseline tables that are safe and idempotent
-- - preserve existing staging nutrition/profile tables and rows
--
-- Staging target:
-- - ozidryfvhkcbtpnulakq
--
-- Production exclusion:
-- - do not run against dtsdnhbcwpbfrhcazqkb
--
-- Safety:
-- - does not create Premium tables
-- - does not apply the Premium SQL draft
-- - does not drop existing tables
-- - does not delete or update existing rows
-- - does not alter preserved staging tables:
--   foods, food_aliases, food_diary_entries, favorite_products,
--   recipes, recipe_ingredients, user_profiles
-- - does not create AI runtime records

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- Phase 1: Core app baseline objects missing on staging
-- ============================================================

create table if not exists public.user_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calories integer not null,
  protein numeric(6,2) not null,
  fat numeric(6,2) not null,
  carbs numeric(6,2) not null,
  updated_at timestamptz not null default now(),
  goal_type text,
  current_weight numeric(8,2),
  target_weight numeric(8,2),
  start_date date,
  end_date date,
  months_to_goal integer,
  bmr integer,
  tdee integer,
  training_place text default 'home',
  gender text,
  age integer,
  height numeric(6,2),
  lifestyle text,
  intensity text
);

comment on table public.user_goals is
  'Baseline user goal table. user_id is the primary key and is used by Premium plan selection FK.';
comment on column public.user_goals.user_id is
  'Primary key and owner id. References auth.users(id).';

alter table public.user_goals enable row level security;

drop policy if exists user_goals_select_own on public.user_goals;
create policy user_goals_select_own
  on public.user_goals
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_goals_insert_own on public.user_goals;
create policy user_goals_insert_own
  on public.user_goals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_goals_update_own on public.user_goals;
create policy user_goals_update_own
  on public.user_goals
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Habits baseline from supabase/schema.sql
-- ------------------------------------------------------------

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  frequency text not null check (frequency in ('daily', 'weekly')),
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists habits_user_idx
  on public.habits (user_id, is_active, created_at desc);

alter table public.habits enable row level security;

drop policy if exists habits_select_own on public.habits;
create policy habits_select_own
  on public.habits
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists habits_insert_own on public.habits;
create policy habits_insert_own
  on public.habits
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists habits_update_own on public.habits;
create policy habits_update_own
  on public.habits
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists habits_delete_own on public.habits;
create policy habits_delete_own
  on public.habits
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists habit_logs_user_date_idx
  on public.habit_logs (user_id, date);

alter table public.habit_logs enable row level security;

drop policy if exists habit_logs_select_own on public.habit_logs;
create policy habit_logs_select_own
  on public.habit_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists habit_logs_insert_own on public.habit_logs;
create policy habit_logs_insert_own
  on public.habit_logs
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = auth.uid()
    )
  );

drop policy if exists habit_logs_update_own on public.habit_logs;
create policy habit_logs_update_own
  on public.habit_logs
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = auth.uid()
    )
  );

drop policy if exists habit_logs_delete_own on public.habit_logs;
create policy habit_logs_delete_own
  on public.habit_logs
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = auth.uid()
    )
  );

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_select_own on public.analytics_events;
create policy analytics_events_select_own
  on public.analytics_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists analytics_events_insert_own on public.analytics_events;
create policy analytics_events_insert_own
  on public.analytics_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ============================================================
-- Phase 2: Recipe relation tables missing from current staging
-- ============================================================

create table if not exists public.favorite_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists favorite_recipes_user_idx
  on public.favorite_recipes (user_id, created_at desc);

alter table public.favorite_recipes enable row level security;

drop policy if exists favorite_recipes_select_own on public.favorite_recipes;
create policy favorite_recipes_select_own
  on public.favorite_recipes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists favorite_recipes_modify_own on public.favorite_recipes;
drop policy if exists favorite_recipes_insert_own_recipe on public.favorite_recipes;
create policy favorite_recipes_insert_own_recipe
  on public.favorite_recipes
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists favorite_recipes_update_own_recipe on public.favorite_recipes;
create policy favorite_recipes_update_own_recipe
  on public.favorite_recipes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists favorite_recipes_delete_own on public.favorite_recipes;
create policy favorite_recipes_delete_own
  on public.favorite_recipes
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.recipe_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists recipe_collections_user_idx
  on public.recipe_collections (user_id, created_at desc);

alter table public.recipe_collections enable row level security;

drop policy if exists recipe_collections_select_own on public.recipe_collections;
create policy recipe_collections_select_own
  on public.recipe_collections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists recipe_collections_modify_own on public.recipe_collections;
drop policy if exists recipe_collections_insert_own_recipe on public.recipe_collections;
create policy recipe_collections_insert_own_recipe
  on public.recipe_collections
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_collections_update_own_recipe on public.recipe_collections;
create policy recipe_collections_update_own_recipe
  on public.recipe_collections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_collections_delete_own on public.recipe_collections;
create policy recipe_collections_delete_own
  on public.recipe_collections
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- Phase 3: Measurements baseline with canonical day support
-- ============================================================

create table if not exists public.user_measurements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  measurements jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  additional_photos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists user_measurements_user_id_unique
  on public.user_measurements (user_id);

alter table public.user_measurements enable row level security;

drop policy if exists user_measurements_select_own on public.user_measurements;
create policy user_measurements_select_own
  on public.user_measurements
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_measurements_insert_own on public.user_measurements;
create policy user_measurements_insert_own
  on public.user_measurements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_measurements_update_own on public.user_measurements;
create policy user_measurements_update_own
  on public.user_measurements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_measurements_delete_own on public.user_measurements;
create policy user_measurements_delete_own
  on public.user_measurements
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.measurement_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date,
  date date,
  measurements jsonb not null,
  photos jsonb not null default '[]'::jsonb,
  additional_photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists measurement_history_user_day_unique
  on public.measurement_history (user_id, day)
  where day is not null;

create unique index if not exists measurement_history_user_date_unique
  on public.measurement_history (user_id, date)
  where date is not null;

create index if not exists measurement_history_user_day_idx
  on public.measurement_history (user_id, day desc);

alter table public.measurement_history enable row level security;

drop policy if exists measurement_history_select_own on public.measurement_history;
create policy measurement_history_select_own
  on public.measurement_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists measurement_history_insert_own on public.measurement_history;
create policy measurement_history_insert_own
  on public.measurement_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists measurement_history_update_own on public.measurement_history;
create policy measurement_history_update_own
  on public.measurement_history
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists measurement_history_delete_own on public.measurement_history;
create policy measurement_history_delete_own
  on public.measurement_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.measurement_photo_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date,
  date date,
  photos jsonb not null default '[]'::jsonb,
  additional_photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists measurement_photo_history_user_day_unique
  on public.measurement_photo_history (user_id, day)
  where day is not null;

create unique index if not exists measurement_photo_history_user_date_unique
  on public.measurement_photo_history (user_id, date)
  where date is not null;

create index if not exists measurement_photo_history_user_day_idx
  on public.measurement_photo_history (user_id, day desc);

alter table public.measurement_photo_history enable row level security;

drop policy if exists measurement_photo_history_select_own on public.measurement_photo_history;
create policy measurement_photo_history_select_own
  on public.measurement_photo_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists measurement_photo_history_insert_own on public.measurement_photo_history;
create policy measurement_photo_history_insert_own
  on public.measurement_photo_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists measurement_photo_history_update_own on public.measurement_photo_history;
create policy measurement_photo_history_update_own
  on public.measurement_photo_history
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists measurement_photo_history_delete_own on public.measurement_photo_history;
create policy measurement_photo_history_delete_own
  on public.measurement_photo_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- Phase 4: Goal/progress read-model baseline
-- ============================================================

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_weight numeric(6,2),
  trend_weight_7d numeric(6,2),
  trend_weight_30d numeric(6,2),
  avg_calories numeric(8,2),
  avg_protein numeric(8,2),
  training_load_index numeric(8,2),
  fatigue_index numeric(8,2),
  adherence_score numeric(5,2),
  recovery_score numeric(5,2),
  consistency_score numeric(5,2),
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists user_state_select_own on public.user_state;
create policy user_state_select_own
  on public.user_state
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_state_modify_own on public.user_state;
create policy user_state_modify_own
  on public.user_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.goal_trajectory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text not null,
  expected_weight_curve jsonb,
  expected_strength_curve jsonb,
  expected_fat_loss_curve jsonb,
  status text not null check (status in ('on_track', 'behind', 'ahead')),
  deviation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goal_trajectory_user_idx
  on public.goal_trajectory (user_id, created_at desc);

alter table public.goal_trajectory enable row level security;

drop policy if exists goal_trajectory_select_own on public.goal_trajectory;
create policy goal_trajectory_select_own
  on public.goal_trajectory
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists goal_trajectory_modify_own on public.goal_trajectory;
create policy goal_trajectory_modify_own
  on public.goal_trajectory
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.progress_trends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start, period_end)
);

create index if not exists progress_trends_user_idx
  on public.progress_trends (user_id, period_start, period_end);

alter table public.progress_trends enable row level security;

drop policy if exists progress_trends_select_own on public.progress_trends;
create policy progress_trends_select_own
  on public.progress_trends
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists progress_trends_modify_own on public.progress_trends;
create policy progress_trends_modify_own
  on public.progress_trends
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Intentionally not included in this phased draft
-- ============================================================
--
-- Workout/catalog/program/AI-heavy baseline objects are intentionally not
-- created here because the repo contains multiple phase files with ordering
-- dependencies and staging currently has no workout catalog baseline.
--
-- Examples requiring separate owner-approved review:
-- - public.exercises, public.muscles, public.exercise_muscles
-- - public.workout_entries and workout note/snapshot tables
-- - public.nutrition_programs and public.training_programs
-- - public.report_snapshots and public.report_aggregates because they can
--   depend on AI recommendation tables
-- - public.ai_* tables/runtime surfaces
--
-- Premium tables are also intentionally excluded:
-- - public.premium_plans
-- - public.premium_plan_days
-- - public.premium_meal_slots
-- - public.premium_recipes
-- - public.premium_recipe_ingredients
-- - public.premium_recipe_steps
-- - public.premium_recipe_hints
-- - public.premium_meal_recipe_options
-- - public.user_premium_plan_selections
-- - public.user_premium_meal_selections

-- ============================================================
-- Suggested validation SQL after owner-approved staging apply
-- ============================================================
--
-- select table_name, to_regclass('public.' || table_name)::text as regclass
-- from (
--   values
--     ('user_goals'),
--     ('habits'),
--     ('habit_logs'),
--     ('analytics_events'),
--     ('favorite_recipes'),
--     ('recipe_collections'),
--     ('user_measurements'),
--     ('measurement_history'),
--     ('measurement_photo_history'),
--     ('user_state'),
--     ('goal_trajectory'),
--     ('progress_trends'),
--     ('premium_plans'),
--     ('premium_shopping_items'),
--     ('user_premium_shopping_checks')
-- ) as t(table_name)
-- order by table_name;
--
-- select
--   tc.constraint_name,
--   tc.constraint_type,
--   kcu.column_name
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu
--   on kcu.constraint_schema = tc.constraint_schema
--  and kcu.constraint_name = tc.constraint_name
--  and kcu.table_schema = tc.table_schema
--  and kcu.table_name = tc.table_name
-- where tc.table_schema = 'public'
--   and tc.table_name = 'user_goals'
--   and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
-- order by tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
--
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in (
--     'user_goals',
--     'habits',
--     'habit_logs',
--     'analytics_events',
--     'favorite_recipes',
--     'recipe_collections',
--     'user_measurements',
--     'measurement_history',
--     'measurement_photo_history',
--     'user_state',
--     'goal_trajectory',
--     'progress_trends'
--   )
-- order by tablename, policyname;
--
-- select 'foods' as table_name, count(*)::bigint as row_count from public.foods
-- union all
-- select 'food_aliases', count(*)::bigint from public.food_aliases
-- union all
-- select 'food_diary_entries', count(*)::bigint from public.food_diary_entries
-- union all
-- select 'favorite_products', count(*)::bigint from public.favorite_products
-- union all
-- select 'recipes', count(*)::bigint from public.recipes
-- union all
-- select 'recipe_ingredients', count(*)::bigint from public.recipe_ingredients
-- union all
-- select 'user_profiles', count(*)::bigint from public.user_profiles
-- order by table_name;

commit;
