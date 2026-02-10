-- ============================================================
-- AI tables extensions (dedupe, lifecycle, explainability)
-- ============================================================

alter table public.ai_recommendations
  add column if not exists request_type text,
  add column if not exists input_hash text,
  add column if not exists idempotency_key text,
  add column if not exists explainability jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

update public.ai_recommendations
  set request_type = 'recommendation'
  where request_type is null;

create index if not exists ai_recommendations_status_idx
  on public.ai_recommendations (status);
create index if not exists ai_recommendations_input_hash_idx
  on public.ai_recommendations (user_id, input_hash);

create unique index if not exists ai_recommendations_dedupe_unique
  on public.ai_recommendations (user_id, request_type, input_hash)
  where input_hash is not null;

alter table public.ai_meal_plans
  add column if not exists input_hash text,
  add column if not exists idempotency_key text,
  add column if not exists explainability jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists ai_meal_plans_status_idx
  on public.ai_meal_plans (status);
create index if not exists ai_meal_plans_input_hash_idx
  on public.ai_meal_plans (user_id, input_hash);

create unique index if not exists ai_meal_plans_dedupe_unique
  on public.ai_meal_plans (user_id, input_hash)
  where input_hash is not null;

alter table public.ai_training_plans
  add column if not exists input_hash text,
  add column if not exists idempotency_key text,
  add column if not exists explainability jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists ai_training_plans_status_idx
  on public.ai_training_plans (status);
create index if not exists ai_training_plans_input_hash_idx
  on public.ai_training_plans (user_id, input_hash);

create unique index if not exists ai_training_plans_dedupe_unique
  on public.ai_training_plans (user_id, input_hash)
  where input_hash is not null;
