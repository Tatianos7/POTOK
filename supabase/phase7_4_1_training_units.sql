alter table public.workout_entries
  add column if not exists base_unit text default 'кг';

alter table public.workout_entries
  add column if not exists display_unit text default 'кг';

alter table public.workout_entries
  add column if not exists display_amount numeric;

alter table public.workout_entries
  add column if not exists idempotency_key text;

update public.workout_entries
set display_amount = weight
where display_amount is null;

create unique index if not exists workout_entries_day_idempotency_idx
  on public.workout_entries (workout_day_id, idempotency_key);
