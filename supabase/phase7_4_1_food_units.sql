-- Phase 7.4.1: Food Diary display/base units support
-- Adds display/base unit columns for food_diary_entries

alter table public.food_diary_entries
  add column if not exists base_unit text default 'г';

alter table public.food_diary_entries
  add column if not exists display_unit text default 'г';

alter table public.food_diary_entries
  add column if not exists display_amount numeric;

alter table public.food_diary_entries
  add column if not exists idempotency_key text;

update public.food_diary_entries
set display_amount = weight
where display_amount is null;

create unique index if not exists food_diary_entries_idempotency_unique
  on public.food_diary_entries (user_id, idempotency_key)
  where idempotency_key is not null;
