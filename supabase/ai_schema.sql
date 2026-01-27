-- ============================================================
-- AI tables (recommendations, meal plans, training plans)
-- ============================================================

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_version text not null,
  request_type text not null check (request_type in ('recommendation','meal_plan','training_plan')),
  input_context jsonb not null,
  result jsonb,
  status text not null check (status in ('queued','running','completed','failed','outdated')),
  error_message text,
  trace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_recommendations_user_created_idx
  on public.ai_recommendations (user_id, created_at desc);

alter table public.ai_recommendations enable row level security;

drop policy if exists "ai_recommendations_select_own" on public.ai_recommendations;
create policy "ai_recommendations_select_own"
  on public.ai_recommendations
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_recommendations_modify_own" on public.ai_recommendations;
create policy "ai_recommendations_modify_own"
  on public.ai_recommendations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ai_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_version text not null,
  input_context jsonb not null,
  plan jsonb,
  status text not null check (status in ('queued','running','completed','failed','outdated')),
  error_message text,
  trace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_meal_plans_user_created_idx
  on public.ai_meal_plans (user_id, created_at desc);

alter table public.ai_meal_plans enable row level security;

drop policy if exists "ai_meal_plans_select_own" on public.ai_meal_plans;
create policy "ai_meal_plans_select_own"
  on public.ai_meal_plans
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_meal_plans_modify_own" on public.ai_meal_plans;
create policy "ai_meal_plans_modify_own"
  on public.ai_meal_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ai_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_version text not null,
  input_context jsonb not null,
  plan jsonb,
  status text not null check (status in ('queued','running','completed','failed','outdated')),
  error_message text,
  trace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_training_plans_user_created_idx
  on public.ai_training_plans (user_id, created_at desc);

alter table public.ai_training_plans enable row level security;

drop policy if exists "ai_training_plans_select_own" on public.ai_training_plans;
create policy "ai_training_plans_select_own"
  on public.ai_training_plans
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_training_plans_modify_own" on public.ai_training_plans;
create policy "ai_training_plans_modify_own"
  on public.ai_training_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ai_type text not null check (ai_type in ('ai_recommendations','ai_meal_plans','ai_training_plans')),
  ai_id uuid not null,
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, ai_type, ai_id)
);

create index if not exists ai_feedback_user_idx
  on public.ai_feedback (user_id, created_at desc);

alter table public.ai_feedback enable row level security;

drop policy if exists "ai_feedback_select_own" on public.ai_feedback;
create policy "ai_feedback_select_own"
  on public.ai_feedback
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_feedback_insert_own" on public.ai_feedback;
create policy "ai_feedback_insert_own"
  on public.ai_feedback
  for insert
  with check (auth.uid() = user_id);
