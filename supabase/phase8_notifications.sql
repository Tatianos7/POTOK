-- ============================================================
-- Phase 8: Ensure notification_history table exists (minimal) + RLS
-- ============================================================

create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score_id uuid,
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

create index if not exists notification_history_user_status_idx
  on public.notification_history (user_id, status, created_at desc);
