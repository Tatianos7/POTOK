-- ============================================================
-- Phase 4.2 Social Proof & Challenges
-- ============================================================

create table if not exists public.user_cohorts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  age_group text,
  goal_type text,
  activity_level text,
  bmi_range text,
  gender_opt text,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.user_cohorts enable row level security;

drop policy if exists "user_cohorts_select_own" on public.user_cohorts;
create policy "user_cohorts_select_own"
  on public.user_cohorts
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_cohorts_modify_own" on public.user_cohorts;
create policy "user_cohorts_modify_own"
  on public.user_cohorts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.cohort_stats (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.user_cohorts (id) on delete cascade,
  metric text not null,
  p25 numeric(8,2),
  p50 numeric(8,2),
  p75 numeric(8,2),
  p90 numeric(8,2),
  updated_at timestamptz not null default now(),
  unique (cohort_id, metric)
);

alter table public.cohort_stats enable row level security;

drop policy if exists "cohort_stats_select_public" on public.cohort_stats;
create policy "cohort_stats_select_public"
  on public.cohort_stats
  for select
  using (true);

create table if not exists public.user_percentiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cohort_id uuid references public.user_cohorts (id) on delete set null,
  metric text not null,
  percentile numeric(5,2),
  updated_at timestamptz not null default now(),
  unique (user_id, metric)
);

alter table public.user_percentiles enable row level security;

drop policy if exists "user_percentiles_select_own" on public.user_percentiles;
create policy "user_percentiles_select_own"
  on public.user_percentiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_percentiles_modify_own" on public.user_percentiles;
create policy "user_percentiles_modify_own"
  on public.user_percentiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  goal_metric text not null,
  duration_days integer not null,
  difficulty text not null,
  reward_xp integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

drop policy if exists "challenges_select_public" on public.challenges;
create policy "challenges_select_public"
  on public.challenges
  for select
  using (true);

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  progress numeric(8,2) not null default 0,
  status text not null check (status in ('active','completed','abandoned')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;

drop policy if exists "challenge_participants_select_own" on public.challenge_participants;
create policy "challenge_participants_select_own"
  on public.challenge_participants
  for select
  using (auth.uid() = user_id);

drop policy if exists "challenge_participants_modify_own" on public.challenge_participants;
create policy "challenge_participants_modify_own"
  on public.challenge_participants
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.challenge_leaderboards (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  percentile_bucket text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (challenge_id, percentile_bucket)
);

alter table public.challenge_leaderboards enable row level security;

drop policy if exists "challenge_leaderboards_select_public" on public.challenge_leaderboards;
create policy "challenge_leaderboards_select_public"
  on public.challenge_leaderboards
  for select
  using (true);
