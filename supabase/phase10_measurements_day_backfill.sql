-- ============================================================
-- Phase 10.1: Backfill canonical day(date) from legacy date(text)
-- Tables:
--   public.measurement_history
--   public.measurement_photo_history
--
-- Rules:
-- - Update only where day is null and date is not null
-- - Do not fail on invalid date strings
-- - Do not delete rows
-- - On duplicates (user_id, day): keep newest row for canonical day,
--   set day = null for older duplicates, and report them
-- ============================================================

create extension if not exists pgcrypto;

-- Reports (session-local)
create temp table if not exists _day_backfill_invalid_report (
  table_name text not null,
  row_id text,
  user_id uuid,
  legacy_date text,
  reason text not null
);

create temp table if not exists _day_backfill_duplicate_report (
  table_name text not null,
  user_id uuid,
  day date,
  kept_row_id text,
  duplicate_row_id text,
  duplicate_rank integer
);

truncate table _day_backfill_invalid_report;
truncate table _day_backfill_duplicate_report;

-- ------------------------------------------------------------
-- 1) measurement_history: backfill day from legacy date
-- ------------------------------------------------------------

-- 1.1 Report invalid legacy date values (no update)
insert into _day_backfill_invalid_report (table_name, row_id, user_id, legacy_date, reason)
select
  'measurement_history' as table_name,
  (to_jsonb(t)->>'id') as row_id,
  t.user_id,
  t.date::text as legacy_date,
  case
    when t.date::text !~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$' then 'format_not_dd.mm.yyyy'
    when to_char(to_date(t.date::text, 'DD.MM.YYYY'), 'DD.MM.YYYY') <> t.date::text then 'invalid_calendar_date'
    else 'unknown'
  end as reason
from public.measurement_history t
where t.day is null
  and t.date is not null
  and (
    t.date::text !~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$'
    or to_char(to_date(t.date::text, 'DD.MM.YYYY'), 'DD.MM.YYYY') <> t.date::text
  );

-- 1.2 Backfill only valid legacy values
update public.measurement_history t
set day = to_date(t.date::text, 'DD.MM.YYYY')
where t.day is null
  and t.date is not null
  and t.date::text ~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$'
  and to_char(to_date(t.date::text, 'DD.MM.YYYY'), 'DD.MM.YYYY') = t.date::text;

-- 1.3 Handle duplicates for canonical (user_id, day)
with ranked as (
  select
    t.ctid,
    t.user_id,
    t.day,
    coalesce((to_jsonb(t)->>'id'), '') as row_id,
    row_number() over (
      partition by t.user_id, t.day
      order by
        coalesce((to_jsonb(t)->>'updated_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'created_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'id'), '') desc
    ) as rn,
    first_value(coalesce((to_jsonb(t)->>'id'), '')) over (
      partition by t.user_id, t.day
      order by
        coalesce((to_jsonb(t)->>'updated_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'created_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'id'), '') desc
    ) as kept_row_id
  from public.measurement_history t
  where t.day is not null
)
insert into _day_backfill_duplicate_report (table_name, user_id, day, kept_row_id, duplicate_row_id, duplicate_rank)
select
  'measurement_history',
  r.user_id,
  r.day,
  r.kept_row_id,
  r.row_id,
  r.rn
from ranked r
where r.rn > 1;

with ranked as (
  select
    t.ctid,
    row_number() over (
      partition by t.user_id, t.day
      order by
        coalesce((to_jsonb(t)->>'updated_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'created_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'id'), '') desc
    ) as rn
  from public.measurement_history t
  where t.day is not null
)
update public.measurement_history t
set day = null
from ranked r
where t.ctid = r.ctid
  and r.rn > 1;

-- ------------------------------------------------------------
-- 2) measurement_photo_history: backfill day from legacy date
-- ------------------------------------------------------------

insert into _day_backfill_invalid_report (table_name, row_id, user_id, legacy_date, reason)
select
  'measurement_photo_history' as table_name,
  (to_jsonb(t)->>'id') as row_id,
  t.user_id,
  t.date::text as legacy_date,
  case
    when t.date::text !~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$' then 'format_not_dd.mm.yyyy'
    when to_char(to_date(t.date::text, 'DD.MM.YYYY'), 'DD.MM.YYYY') <> t.date::text then 'invalid_calendar_date'
    else 'unknown'
  end as reason
from public.measurement_photo_history t
where t.day is null
  and t.date is not null
  and (
    t.date::text !~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$'
    or to_char(to_date(t.date::text, 'DD.MM.YYYY'), 'DD.MM.YYYY') <> t.date::text
  );

update public.measurement_photo_history t
set day = to_date(t.date::text, 'DD.MM.YYYY')
where t.day is null
  and t.date is not null
  and t.date::text ~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}$'
  and to_char(to_date(t.date::text, 'DD.MM.YYYY'), 'DD.MM.YYYY') = t.date::text;

with ranked as (
  select
    t.ctid,
    t.user_id,
    t.day,
    coalesce((to_jsonb(t)->>'id'), '') as row_id,
    row_number() over (
      partition by t.user_id, t.day
      order by
        coalesce((to_jsonb(t)->>'updated_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'created_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'id'), '') desc
    ) as rn,
    first_value(coalesce((to_jsonb(t)->>'id'), '')) over (
      partition by t.user_id, t.day
      order by
        coalesce((to_jsonb(t)->>'updated_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'created_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'id'), '') desc
    ) as kept_row_id
  from public.measurement_photo_history t
  where t.day is not null
)
insert into _day_backfill_duplicate_report (table_name, user_id, day, kept_row_id, duplicate_row_id, duplicate_rank)
select
  'measurement_photo_history',
  r.user_id,
  r.day,
  r.kept_row_id,
  r.row_id,
  r.rn
from ranked r
where r.rn > 1;

with ranked as (
  select
    t.ctid,
    row_number() over (
      partition by t.user_id, t.day
      order by
        coalesce((to_jsonb(t)->>'updated_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'created_at')::timestamptz, '-infinity'::timestamptz) desc,
        coalesce((to_jsonb(t)->>'id'), '') desc
    ) as rn
  from public.measurement_photo_history t
  where t.day is not null
)
update public.measurement_photo_history t
set day = null
from ranked r
where t.ctid = r.ctid
  and r.rn > 1;

-- ------------------------------------------------------------
-- 3) Verification reports
-- ------------------------------------------------------------

-- Summary by table
select
  'measurement_history' as table_name,
  count(*) as total_rows,
  count(*) filter (where day is null) as day_null_rows,
  count(*) filter (where day is not null) as day_filled_rows
from public.measurement_history
union all
select
  'measurement_photo_history' as table_name,
  count(*) as total_rows,
  count(*) filter (where day is null) as day_null_rows,
  count(*) filter (where day is not null) as day_filled_rows
from public.measurement_photo_history;

-- Invalid legacy date rows (non-blocking)
select *
from _day_backfill_invalid_report
order by table_name, user_id, legacy_date;

-- Duplicate rows moved out of canonical day (day set to null)
select *
from _day_backfill_duplicate_report
order by table_name, user_id, day, duplicate_rank;

-- Reload PostgREST schema cache
select pg_notify('pgrst', 'reload schema');
