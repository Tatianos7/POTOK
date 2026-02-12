-- ============================================================
-- Phase 9: Goal state extensions (training place + metadata)
-- ============================================================

alter table public.user_goals
  add column if not exists goal_type text,
  add column if not exists current_weight numeric(8,2),
  add column if not exists target_weight numeric(8,2),
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists months_to_goal integer,
  add column if not exists bmr integer,
  add column if not exists tdee integer,
  add column if not exists training_place text,
  add column if not exists gender text,
  add column if not exists age integer,
  add column if not exists height numeric(6,2),
  add column if not exists lifestyle text,
  add column if not exists intensity text;

update public.user_goals
set training_place = 'home'
where training_place is null;

alter table public.user_goals
  alter column training_place set default 'home';

-- Reload PostgREST schema cache after migration.
select pg_notify('pgrst', 'reload schema');
