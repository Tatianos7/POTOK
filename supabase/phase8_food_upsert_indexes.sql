-- ============================================================
-- Phase 8: Ensure unique index for food_diary_entries upserts and cleanup duplicates
-- ============================================================

-- 1) Optional: remove duplicates for idempotency_key (keep latest by created_at)
-- This makes creating a unique index safe even if duplicates exist in production.
with duplicates as (
  select id,
         row_number() over (partition by user_id, idempotency_key order by created_at desc nulls last) as rn
  from public.food_diary_entries
  where idempotency_key is not null
)
delete from public.food_diary_entries
where id in (select id from duplicates where rn > 1);

-- 2) Create unique index used by ON CONFLICT (user_id, idempotency_key)
-- NOTE: use non-partial unique index so PostgREST can infer ON CONFLICT target.
drop index if exists public.food_diary_entries_idempotency_idx;
drop index if exists public.food_diary_entries_idempotency_unique;
create unique index if not exists food_diary_entries_idempotency_unique
  on public.food_diary_entries (user_id, idempotency_key);

-- 3) As a safety, also ensure the common access index exists
create index if not exists food_diary_entries_user_date_idx
  on public.food_diary_entries (user_id, date, meal_type);

-- 4) Intentionally no VACUUM/ANALYZE here (Supabase SQL editor runs in a transaction).
