-- ============================================================
-- Phase 4.1 Motivation & Gamification Engine
-- ============================================================

create table if not exists public.user_xp (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  rank text,
  updated_at timestamptz not null default now()
);

alter table public.user_xp enable row level security;

drop policy if exists "user_xp_select_own" on public.user_xp;
create policy "user_xp_select_own"
  on public.user_xp
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_xp_modify_own" on public.user_xp;
create policy "user_xp_modify_own"
  on public.user_xp
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  streak_type text not null check (streak_type in ('nutrition','training','habits','sleep')),
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_completed_date date,
  updated_at timestamptz not null default now(),
  unique (user_id, streak_type)
);

create index if not exists user_streaks_user_idx
  on public.user_streaks (user_id, streak_type);

alter table public.user_streaks enable row level security;

drop policy if exists "user_streaks_select_own" on public.user_streaks;
create policy "user_streaks_select_own"
  on public.user_streaks
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_streaks_modify_own" on public.user_streaks;
create policy "user_streaks_modify_own"
  on public.user_streaks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_key text not null,
  title text not null,
  description text,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id, unlocked_at desc);

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
  on public.user_achievements
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_achievements_modify_own" on public.user_achievements;
create policy "user_achievements_modify_own"
  on public.user_achievements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
