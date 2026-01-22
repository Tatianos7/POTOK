-- ============================================================
-- Reports & Progress schema (Sprint 4)
-- ============================================================

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('requested','generating','ready','outdated','failed')),
  aggregates jsonb,
  ai_summary_id uuid references public.ai_recommendations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start, period_end)
);

create index if not exists report_snapshots_user_period_idx
  on public.report_snapshots (user_id, period_start, period_end);

alter table public.report_snapshots enable row level security;

drop policy if exists "report_snapshots_select_own" on public.report_snapshots;
create policy "report_snapshots_select_own"
  on public.report_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "report_snapshots_modify_own" on public.report_snapshots;
create policy "report_snapshots_modify_own"
  on public.report_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.report_aggregates (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.report_snapshots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id)
);

create index if not exists report_aggregates_user_idx
  on public.report_aggregates (user_id, created_at desc);

alter table public.report_aggregates enable row level security;

drop policy if exists "report_aggregates_select_own" on public.report_aggregates;
create policy "report_aggregates_select_own"
  on public.report_aggregates
  for select
  using (auth.uid() = user_id);

drop policy if exists "report_aggregates_modify_own" on public.report_aggregates;
create policy "report_aggregates_modify_own"
  on public.report_aggregates
  for all
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

drop policy if exists "progress_trends_select_own" on public.progress_trends;
create policy "progress_trends_select_own"
  on public.progress_trends
  for select
  using (auth.uid() = user_id);

drop policy if exists "progress_trends_modify_own" on public.progress_trends;
create policy "progress_trends_modify_own"
  on public.progress_trends
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
