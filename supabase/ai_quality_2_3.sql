-- ============================================================
-- Phase 2.3 AI Quality & Trust Tuning
-- ============================================================

-- Extend AI tables with deterministic generation metadata and scoring
alter table public.ai_recommendations
  add column if not exists generation_params jsonb,
  add column if not exists prompt_version text,
  add column if not exists confidence_score numeric(5,2),
  add column if not exists relevance_score numeric(5,2),
  add column if not exists guard_status text;

alter table public.ai_meal_plans
  add column if not exists generation_params jsonb,
  add column if not exists prompt_version text,
  add column if not exists confidence_score numeric(5,2),
  add column if not exists relevance_score numeric(5,2),
  add column if not exists guard_status text;

alter table public.ai_training_plans
  add column if not exists generation_params jsonb,
  add column if not exists prompt_version text,
  add column if not exists confidence_score numeric(5,2),
  add column if not exists relevance_score numeric(5,2),
  add column if not exists guard_status text;

-- Replace status constraints to include validating/suppressed/requires_review
alter table public.ai_recommendations drop constraint if exists ai_recommendations_status_check;
alter table public.ai_recommendations
  add constraint ai_recommendations_status_check
  check (status in ('queued','running','validating','completed','failed','outdated','suppressed','requires_review'));

alter table public.ai_meal_plans drop constraint if exists ai_meal_plans_status_check;
alter table public.ai_meal_plans
  add constraint ai_meal_plans_status_check
  check (status in ('queued','running','validating','completed','failed','outdated','suppressed','requires_review'));

alter table public.ai_training_plans drop constraint if exists ai_training_plans_status_check;
alter table public.ai_training_plans
  add constraint ai_training_plans_status_check
  check (status in ('queued','running','validating','completed','failed','outdated','suppressed','requires_review'));

-- Canonical generation params catalog
create table if not exists public.ai_generation_params (
  id uuid primary key default gen_random_uuid(),
  model_version text not null,
  prompt_version text not null,
  params jsonb not null,
  created_at timestamptz not null default now(),
  unique (model_version, prompt_version)
);

alter table public.ai_generation_params enable row level security;

drop policy if exists "ai_generation_params_select_public" on public.ai_generation_params;
create policy "ai_generation_params_select_public"
  on public.ai_generation_params
  for select
  using (true);

drop policy if exists "ai_generation_params_modify_own" on public.ai_generation_params;
create policy "ai_generation_params_modify_own"
  on public.ai_generation_params
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- AI quality metrics
create table if not exists public.ai_quality_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ai_type text not null check (ai_type in ('ai_recommendations','ai_meal_plans','ai_training_plans')),
  ai_id uuid not null,
  confidence_score numeric(5,2),
  relevance_score numeric(5,2),
  notes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_quality_metrics_user_idx
  on public.ai_quality_metrics (user_id, created_at desc);

alter table public.ai_quality_metrics enable row level security;

drop policy if exists "ai_quality_metrics_select_own" on public.ai_quality_metrics;
create policy "ai_quality_metrics_select_own"
  on public.ai_quality_metrics
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_quality_metrics_modify_own" on public.ai_quality_metrics;
create policy "ai_quality_metrics_modify_own"
  on public.ai_quality_metrics
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- AI trust scores per user
create table if not exists public.ai_trust_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  trust_score numeric(5,2) not null default 50,
  updated_at timestamptz not null default now()
);

alter table public.ai_trust_scores enable row level security;

drop policy if exists "ai_trust_scores_select_own" on public.ai_trust_scores;
create policy "ai_trust_scores_select_own"
  on public.ai_trust_scores
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_trust_scores_modify_own" on public.ai_trust_scores;
create policy "ai_trust_scores_modify_own"
  on public.ai_trust_scores
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- AI guard logs
create table if not exists public.ai_guard_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ai_type text not null check (ai_type in ('ai_recommendations','ai_meal_plans','ai_training_plans')),
  ai_id uuid not null,
  status text not null check (status in ('validating','suppressed','requires_review','passed')),
  reasons jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_guard_logs_user_idx
  on public.ai_guard_logs (user_id, created_at desc);

alter table public.ai_guard_logs enable row level security;

drop policy if exists "ai_guard_logs_select_own" on public.ai_guard_logs;
create policy "ai_guard_logs_select_own"
  on public.ai_guard_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_guard_logs_modify_own" on public.ai_guard_logs;
create policy "ai_guard_logs_modify_own"
  on public.ai_guard_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
