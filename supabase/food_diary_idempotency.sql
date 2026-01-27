-- ============================================================
-- Food diary idempotency (Sprint 1)
-- ============================================================

alter table public.food_diary_entries
  add column if not exists idempotency_key text;

create unique index if not exists food_diary_entries_idempotency_unique
  on public.food_diary_entries (user_id, idempotency_key)
  where idempotency_key is not null;
