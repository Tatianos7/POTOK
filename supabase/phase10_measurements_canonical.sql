-- ============================================================
-- Phase 10: Canonical measurements schema hardening (non-breaking)
-- Tables:
--   public.user_measurements
--   public.measurement_history
--   public.measurement_photo_history
--
-- Goals:
-- - Keep legacy columns intact (including legacy text "date")
-- - Add canonical "day" date column for history tables
-- - Ensure UUID identity is available (without breaking legacy front)
-- - Enforce per-user access via RLS policies
-- ============================================================

-- 0) Extensions required for UUID defaults
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) user_measurements: ensure one row per user_id
-- ------------------------------------------------------------
alter table if exists public.user_measurements
  add column if not exists user_id uuid;

-- Keep current one-row-per-user behavior.
create unique index if not exists user_measurements_user_id_unique
  on public.user_measurements (user_id);

-- ------------------------------------------------------------
-- 2) measurement_history: canonical day + UUID identity
-- ------------------------------------------------------------

-- Canonical day column (do not remove legacy "date" text/date)
alter table if exists public.measurement_history
  add column if not exists day date;

-- Backfill canonical day from legacy text format DD.MM.YYYY (if present)
update public.measurement_history
set day = to_date(date, 'DD.MM.YYYY')
where day is null
  and date is not null
  and date::text ~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$';

-- If legacy "date" is already typed as date, copy directly.
update public.measurement_history
set day = date::date
where day is null
  and date is not null
  and pg_typeof(date)::text = 'date';

-- Ensure UUID identity exists without breaking legacy "id" types.
do $$
declare
  id_type text;
begin
  select data_type
  into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'measurement_history'
    and column_name = 'id';

  -- If no "id" column, add canonical uuid id.
  if id_type is null then
    execute 'alter table public.measurement_history add column id uuid default gen_random_uuid()';
  -- If "id" exists but is not uuid (legacy), add non-breaking uuid companion.
  elsif id_type <> 'uuid' then
    execute 'alter table public.measurement_history add column if not exists id_uuid uuid default gen_random_uuid()';
  end if;
end $$;

-- Deduplicate before unique index creation: keep newest row per (user_id, day).
with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, day
      order by created_at desc nulls last, ctid desc
    ) as rn
  from public.measurement_history
  where day is not null
)
delete from public.measurement_history t
using ranked r
where t.ctid = r.ctid
  and r.rn > 1;

-- Canonical uniqueness
create unique index if not exists measurement_history_user_day_unique
  on public.measurement_history (user_id, day);

-- ------------------------------------------------------------
-- 3) measurement_photo_history: canonical day + UUID identity
-- ------------------------------------------------------------

alter table if exists public.measurement_photo_history
  add column if not exists day date;

-- Backfill from legacy text DD.MM.YYYY if present
update public.measurement_photo_history
set day = to_date(date, 'DD.MM.YYYY')
where day is null
  and date is not null
  and date::text ~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$';

-- If legacy "date" already typed as date, copy directly.
update public.measurement_photo_history
set day = date::date
where day is null
  and date is not null
  and pg_typeof(date)::text = 'date';

do $$
declare
  id_type text;
begin
  select data_type
  into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'measurement_photo_history'
    and column_name = 'id';

  if id_type is null then
    execute 'alter table public.measurement_photo_history add column id uuid default gen_random_uuid()';
  elsif id_type <> 'uuid' then
    execute 'alter table public.measurement_photo_history add column if not exists id_uuid uuid default gen_random_uuid()';
  end if;
end $$;

with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, day
      order by created_at desc nulls last, ctid desc
    ) as rn
  from public.measurement_photo_history
  where day is not null
)
delete from public.measurement_photo_history t
using ranked r
where t.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists measurement_photo_history_user_day_unique
  on public.measurement_photo_history (user_id, day);

-- ------------------------------------------------------------
-- 4) RLS hardening for all 3 tables
-- ------------------------------------------------------------

alter table if exists public.user_measurements enable row level security;
alter table if exists public.measurement_history enable row level security;
alter table if exists public.measurement_photo_history enable row level security;

-- user_measurements
drop policy if exists "user_measurements_select_own_v2" on public.user_measurements;
create policy "user_measurements_select_own_v2"
  on public.user_measurements
  for select
  using (user_id = auth.uid());

drop policy if exists "user_measurements_insert_own_v2" on public.user_measurements;
create policy "user_measurements_insert_own_v2"
  on public.user_measurements
  for insert
  with check (user_id = auth.uid());

drop policy if exists "user_measurements_update_own_v2" on public.user_measurements;
create policy "user_measurements_update_own_v2"
  on public.user_measurements
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_measurements_delete_own_v2" on public.user_measurements;
create policy "user_measurements_delete_own_v2"
  on public.user_measurements
  for delete
  using (user_id = auth.uid());

-- measurement_history
drop policy if exists "measurement_history_select_own_v2" on public.measurement_history;
create policy "measurement_history_select_own_v2"
  on public.measurement_history
  for select
  using (user_id = auth.uid());

drop policy if exists "measurement_history_insert_own_v2" on public.measurement_history;
create policy "measurement_history_insert_own_v2"
  on public.measurement_history
  for insert
  with check (user_id = auth.uid());

drop policy if exists "measurement_history_update_own_v2" on public.measurement_history;
create policy "measurement_history_update_own_v2"
  on public.measurement_history
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "measurement_history_delete_own_v2" on public.measurement_history;
create policy "measurement_history_delete_own_v2"
  on public.measurement_history
  for delete
  using (user_id = auth.uid());

-- measurement_photo_history
drop policy if exists "measurement_photo_history_select_own_v2" on public.measurement_photo_history;
create policy "measurement_photo_history_select_own_v2"
  on public.measurement_photo_history
  for select
  using (user_id = auth.uid());

drop policy if exists "measurement_photo_history_insert_own_v2" on public.measurement_photo_history;
create policy "measurement_photo_history_insert_own_v2"
  on public.measurement_photo_history
  for insert
  with check (user_id = auth.uid());

drop policy if exists "measurement_photo_history_update_own_v2" on public.measurement_photo_history;
create policy "measurement_photo_history_update_own_v2"
  on public.measurement_photo_history
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "measurement_photo_history_delete_own_v2" on public.measurement_photo_history;
create policy "measurement_photo_history_delete_own_v2"
  on public.measurement_photo_history
  for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 5) Reload PostgREST schema cache
-- ------------------------------------------------------------
select pg_notify('pgrst', 'reload schema');
