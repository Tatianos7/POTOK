-- food_diary_entries canonical_food_id apply backfill
-- Run only after reviewing food_diary_entries_canonical_backfill_audit.sql
-- Writes only rows with canonical_food_id is null and exactly one matched foods.id
-- Fix note:
-- PostgreSQL does not support min(uuid), so the stable unique-match reducer uses
-- min(food_id::text)::uuid instead of min(food_id).

with diary_scope as (
  select
    e.id,
    e.product_name,
    e.canonical_food_id,
    trim(regexp_replace(lower(coalesce(e.product_name, '')), '[^a-z0-9а-яё]+', ' ', 'gi')) as normalized_product_name
  from public.food_diary_entries e
  where e.canonical_food_id is null
    and coalesce(e.product_name, '') <> ''
), candidate_matches as (
  select
    u.id as entry_id,
    f.id as food_id
  from diary_scope u
  join public.foods f
    on f.normalized_name = u.normalized_product_name

  union

  select
    u.id as entry_id,
    f.id as food_id
  from diary_scope u
  join public.foods f
    on lower(coalesce(f.name, '')) = lower(coalesce(u.product_name, ''))

  union

  select
    u.id as entry_id,
    a.canonical_food_id as food_id
  from diary_scope u
  join public.food_aliases a
    on a.normalized_alias = u.normalized_product_name
), unique_matches as (
  select
    entry_id,
    min(food_id::text)::uuid as food_id
  from candidate_matches
  group by entry_id
  having count(distinct food_id) = 1
)
update public.food_diary_entries e
set canonical_food_id = um.food_id
from unique_matches um
where e.id = um.entry_id
  and e.canonical_food_id is null;
