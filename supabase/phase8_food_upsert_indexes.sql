-- ============================================================
-- Phase 8: Ensure unique index for food_diary_entries upserts and cleanup duplicates
-- ============================================================

-- 1) Optional: remove duplicates for idempotency_key (keep latest by updated_at/created_at)
-- This makes creating a unique index safe even if duplicates exist in production.
with duplicates as (
  select id,
         row_number() over (partition by user_id, idempotency_key order by coalesce(updated_at, created_at) desc) as rn
  from public.food_diary_entries
  where idempotency_key is not null
)
delete from public.food_diary_entries
where id in (select id from duplicates where rn > 1);

-- 2) Create unique index used by ON CONFLICT (user_id, idempotency_key)
create unique index if not exists food_diary_entries_idempotency_unique
  on public.food_diary_entries (user_id, idempotency_key)
  where idempotency_key is not null;

-- 3) As a safety, also ensure the common access index exists
create index if not exists food_diary_entries_user_date_idx
  on public.food_diary_entries (user_id, date, meal_type);

-- 4) Sanity: vacuum analyze to help planner after cleanup
vacuum analyze public.food_diary_entries;
