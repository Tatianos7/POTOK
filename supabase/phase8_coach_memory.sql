-- Phase 8.1.7 Coach Memory Infrastructure
-- Tables and RLS policies for coach memory persistence.

create extension if not exists "pgcrypto";

-- coach_memory_events
create table if not exists coach_memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_timestamp timestamptz not null default now(),
  signal_type text not null,
  confidence numeric(4,3) default 1.000,
  trust_delta integer default 0,
  emotional_state text,
  memory_layer text,
  source_screen text,
  explainability_ref text,
  safety_class text default 'normal',
  memory_tier text default 'hot',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_memory_events_user_ts_idx
  on coach_memory_events (user_id, event_timestamp desc);
create index if not exists coach_memory_events_tier_idx
  on coach_memory_events (memory_tier, event_timestamp desc);

alter table coach_memory_events enable row level security;

create policy "coach_memory_events_owner_select"
  on coach_memory_events for select
  using (auth.uid() = user_id);

create policy "coach_memory_events_owner_insert"
  on coach_memory_events for insert
  with check (auth.uid() = user_id);

create policy "coach_memory_events_owner_update"
  on coach_memory_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "coach_memory_events_owner_delete"
  on coach_memory_events for delete
  using (auth.uid() = user_id);

create policy "coach_memory_events_service_role"
  on coach_memory_events for select
  using (auth.role() = 'service_role');

-- coach_emotional_state
create table if not exists coach_emotional_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emotional_state text not null,
  fatigue_level numeric(4,2),
  motivation_level numeric(4,2),
  safety_mode boolean default false,
  confidence_level numeric(4,2),
  trust_level numeric(4,2),
  updated_at timestamptz not null default now()
);

alter table coach_emotional_state enable row level security;

create policy "coach_emotional_state_owner"
  on coach_emotional_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "coach_emotional_state_service_role"
  on coach_emotional_state for select
  using (auth.role() = 'service_role');

-- coach_trust_timeline
create table if not exists coach_trust_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_timestamp timestamptz not null default now(),
  trust_delta integer default 0,
  trust_level numeric(4,2),
  reason text,
  source_screen text,
  explainability_ref text,
  created_at timestamptz not null default now()
);

create index if not exists coach_trust_timeline_user_ts_idx
  on coach_trust_timeline (user_id, event_timestamp desc);

alter table coach_trust_timeline enable row level security;

create policy "coach_trust_timeline_owner"
  on coach_trust_timeline for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "coach_trust_timeline_service_role"
  on coach_trust_timeline for select
  using (auth.role() = 'service_role');

-- coach_relationship_profile
create table if not exists coach_relationship_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stage text not null default 'onboarding',
  autonomy numeric(4,2) default 0.00,
  resilience numeric(4,2) default 0.00,
  emotional_state text not null default 'calm',
  safety_mode boolean default false,
  trust_level numeric(4,2) default 0.00,
  confidence_growth numeric(4,2) default 0.00,
  confidence_decay numeric(4,2) default 0.00,
  updated_at timestamptz not null default now()
);

alter table coach_relationship_profile enable row level security;

create policy "coach_relationship_profile_owner"
  on coach_relationship_profile for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "coach_relationship_profile_service_role"
  on coach_relationship_profile for select
  using (auth.role() = 'service_role');

-- coach_goal_history
create table if not exists coach_goal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_timestamp timestamptz not null default now(),
  goal_type text not null,
  goal_payload jsonb not null default '{}'::jsonb,
  reason text,
  explainability_ref text,
  created_at timestamptz not null default now()
);

create index if not exists coach_goal_history_user_ts_idx
  on coach_goal_history (user_id, event_timestamp desc);

alter table coach_goal_history enable row level security;

create policy "coach_goal_history_owner"
  on coach_goal_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "coach_goal_history_service_role"
  on coach_goal_history for select
  using (auth.role() = 'service_role');

-- coach_pattern_summary
create table if not exists coach_pattern_summary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pattern_tags text[] not null default '{}',
  summary text,
  confidence numeric(4,3) default 1.000,
  updated_at timestamptz not null default now()
);

create index if not exists coach_pattern_summary_user_period_idx
  on coach_pattern_summary (user_id, period_start, period_end);

alter table coach_pattern_summary enable row level security;

create policy "coach_pattern_summary_owner"
  on coach_pattern_summary for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "coach_pattern_summary_service_role"
  on coach_pattern_summary for select
  using (auth.role() = 'service_role');

-- Retention policy notes:
-- hot: 0-30 days, warm: 31-180 days, cold: >180 days.
-- Implement tiering via scheduled jobs or server-side aggregation.
