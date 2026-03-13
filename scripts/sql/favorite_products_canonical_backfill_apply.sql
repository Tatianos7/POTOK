-- favorite_products canonical_food_id apply backfill
-- Run only after reviewing favorite_products_canonical_backfill_audit.sql
-- Writes only rows with canonical_food_id is null and exactly one matched foods.id
-- Fix note:
-- PostgreSQL does not support min(uuid), so the stable unique-match reducer uses
-- min(food_id::text)::uuid instead of min(food_id).

with fav_scope as (
  select
    fp.id,
    fp.product_name,
    fp.canonical_food_id,
    trim(regexp_replace(lower(coalesce(fp.product_name, '')), '[^a-z0-9а-яё]+', ' ', 'gi')) as normalized_product_name
  from public.favorite_products fp
  where fp.canonical_food_id is null
    and coalesce(fp.product_name, '') <> ''
), candidate_matches as (
  select
    u.id as favorite_id,
    f.id as food_id
  from fav_scope u
  join public.foods f
    on f.normalized_name = u.normalized_product_name

  union

  select
    u.id as favorite_id,
    f.id as food_id
  from fav_scope u
  join public.foods f
    on lower(coalesce(f.name, '')) = lower(coalesce(u.product_name, ''))

  union

  select
    u.id as favorite_id,
    a.canonical_food_id as food_id
  from fav_scope u
  join public.food_aliases a
    on a.normalized_alias = u.normalized_product_name
), unique_matches as (
  select
    favorite_id,
    min(food_id::text)::uuid as food_id
  from candidate_matches
  group by favorite_id
  having count(distinct food_id) = 1
)
update public.favorite_products fp
set canonical_food_id = um.food_id
from unique_matches um
where fp.id = um.favorite_id
  and fp.canonical_food_id is null;
