-- ============================================================
-- Phase 3 Personalization & Coaching Engine
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

drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
  on public.user_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_state_modify_own" on public.user_state;
create policy "user_state_modify_own"
  on public.user_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.goal_trajectory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text not null,
  expected_weight_curve jsonb,
  expected_strength_curve jsonb,
  expected_fat_loss_curve jsonb,
  status text not null check (status in ('on_track','behind','ahead')),
  deviation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goal_trajectory_user_idx
  on public.goal_trajectory (user_id, created_at desc);

alter table public.goal_trajectory enable row level security;

drop policy if exists "goal_trajectory_select_own" on public.goal_trajectory;
create policy "goal_trajectory_select_own"
  on public.goal_trajectory
  for select
  using (auth.uid() = user_id);

drop policy if exists "goal_trajectory_modify_own" on public.goal_trajectory;
create policy "goal_trajectory_modify_own"
  on public.goal_trajectory
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ai_coaching_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('motivation','correction','warning','celebration','habit_nudge','recovery_alert')),
  trigger text not null,
  confidence numeric(5,2),
  trust_score_used numeric(5,2),
  state_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_coaching_events_user_idx
  on public.ai_coaching_events (user_id, created_at desc);

alter table public.ai_coaching_events enable row level security;

drop policy if exists "ai_coaching_events_select_own" on public.ai_coaching_events;
create policy "ai_coaching_events_select_own"
  on public.ai_coaching_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_coaching_events_modify_own" on public.ai_coaching_events;
create policy "ai_coaching_events_modify_own"
  on public.ai_coaching_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ai_long_term_memory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  user_preferences jsonb,
  rejected_patterns jsonb,
  success_patterns jsonb,
  injury_history jsonb,
  food_intolerances jsonb,
  psychological_triggers jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ai_long_term_memory enable row level security;

drop policy if exists "ai_long_term_memory_select_own" on public.ai_long_term_memory;
create policy "ai_long_term_memory_select_own"
  on public.ai_long_term_memory
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_long_term_memory_modify_own" on public.ai_long_term_memory;
create policy "ai_long_term_memory_modify_own"
  on public.ai_long_term_memory
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.ai_training_plans
  add column if not exists dynamic_version integer not null default 1;

alter table public.ai_meal_plans
  add column if not exists dynamic_version integer not null default 1;
