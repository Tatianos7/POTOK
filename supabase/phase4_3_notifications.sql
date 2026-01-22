-- ============================================================
-- Phase 4.3 Smart Notifications & Retention Triggers
-- ============================================================

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  trigger_type text not null,
  priority_weight numeric(6,2) not null default 1,
  cooldown_hours integer not null default 24,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name, trigger_type)
);

alter table public.notification_rules enable row level security;

drop policy if exists "notification_rules_select_own" on public.notification_rules;
create policy "notification_rules_select_own"
  on public.notification_rules
  for select
  using (auth.uid() = user_id);

drop policy if exists "notification_rules_modify_own" on public.notification_rules;
create policy "notification_rules_modify_own"
  on public.notification_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_id uuid references public.notification_rules (id) on delete cascade,
  trigger_type text not null,
  context_ref text,
  urgency_score numeric(8,2) not null default 0,
  relevance_score numeric(8,2) not null default 0,
  trust_weighted_priority numeric(8,2) not null default 0,
  status text not null check (status in ('queued','scored','throttled')),
  score_breakdown jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

alter table public.notification_scores enable row level security;

drop policy if exists "notification_scores_select_own" on public.notification_scores;
create policy "notification_scores_select_own"
  on public.notification_scores
  for select
  using (auth.uid() = user_id);

drop policy if exists "notification_scores_modify_own" on public.notification_scores;
create policy "notification_scores_modify_own"
  on public.notification_scores
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score_id uuid references public.notification_scores (id) on delete set null,
  channel text not null,
  message_id text,
  message text,
  status text not null check (status in ('queued','sent','delivered','opened','ignored','failed','throttled')),
  explainability jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_history enable row level security;

drop policy if exists "notification_history_select_own" on public.notification_history;
create policy "notification_history_select_own"
  on public.notification_history
  for select
  using (auth.uid() = user_id);

drop policy if exists "notification_history_modify_own" on public.notification_history;
create policy "notification_history_modify_own"
  on public.notification_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_attention_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chronotype text,
  preferred_hours text,
  timezone text,
  fatigue_score numeric(6,2),
  updated_at timestamptz not null default now()
);

alter table public.user_attention_state enable row level security;

drop policy if exists "user_attention_state_select_own" on public.user_attention_state;
create policy "user_attention_state_select_own"
  on public.user_attention_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_attention_state_modify_own" on public.user_attention_state;
create policy "user_attention_state_modify_own"
  on public.user_attention_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_suppression (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text,
  until_ts timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.notification_suppression enable row level security;

drop policy if exists "notification_suppression_select_own" on public.notification_suppression;
create policy "notification_suppression_select_own"
  on public.notification_suppression
  for select
  using (auth.uid() = user_id);

drop policy if exists "notification_suppression_modify_own" on public.notification_suppression;
create policy "notification_suppression_modify_own"
  on public.notification_suppression
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  history_id uuid references public.notification_history (id) on delete cascade,
  feedback text not null check (feedback in ('positive','neutral','negative')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.notification_feedback enable row level security;

drop policy if exists "notification_feedback_select_own" on public.notification_feedback;
create policy "notification_feedback_select_own"
  on public.notification_feedback
  for select
  using (auth.uid() = user_id);

drop policy if exists "notification_feedback_modify_own" on public.notification_feedback;
create policy "notification_feedback_modify_own"
  on public.notification_feedback
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists notification_scores_user_status_idx
  on public.notification_scores (user_id, status, created_at desc);

create index if not exists notification_history_user_status_idx
  on public.notification_history (user_id, status, created_at desc);
