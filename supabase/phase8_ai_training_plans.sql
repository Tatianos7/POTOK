-- ============================================================
-- Phase 8: Ensure ai_training_plans has input_context and helper columns
-- ============================================================

-- Add input_context if missing
alter table public.ai_training_plans
  add column if not exists input_context jsonb;

-- Optional lifecycle columns
alter table public.ai_training_plans
  add column if not exists outdated_at timestamptz,
  add column if not exists is_outdated boolean default false;

-- Index to help queries that filter by input_context->>date
create index if not exists ai_training_plans_input_context_date_idx
  on public.ai_training_plans ((input_context->>'date'));

-- Safety: ensure there is a status and input_hash indexes (idempotent)
create index if not exists ai_training_plans_status_idx
  on public.ai_training_plans (status);
create index if not exists ai_training_plans_input_hash_idx
  on public.ai_training_plans (user_id, input_hash);

-- RLS: ensure owner policies are present (recreate to be safe)
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

-- Sanity: touch updated_at of existing rows (no-op if none)
update public.ai_training_plans set updated_at = updated_at where false;
