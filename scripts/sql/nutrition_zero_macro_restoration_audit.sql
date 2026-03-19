-- Nutrition zero-macro restoration audit
-- Read-only
-- Purpose:
-- - audit the full zero-macro incident scope in public.foods
-- - separate whitelist-valid zero rows from suspicious catalog rows
-- - expose downstream impact on diary/favorites/recipe graph
-- - support restoration batching: autofix candidates vs manual review

-- Assumption:
-- - incident scope is primarily the 2026-03-05 import/seed/backfill wave

-- =========================================================
-- SECTION A: Summary
-- =========================================================
with zero_foods as (
  select *
  from public.foods f
  where coalesce(f.calories, 0) = 0
    and coalesce(f.protein, 0) = 0
    and coalesce(f.fat, 0) = 0
    and coalesce(f.carbs, 0) = 0
),
incident_zero_foods as (
  select *
  from zero_foods
  where created_at::date = date '2026-03-05'
),
whitelist_valid_zero as (
  select *
  from incident_zero_foods
  where lower(coalesce(name, '')) in ('вода', 'water')
),
suspicious_catalog_zero as (
  select *
  from incident_zero_foods
  where source in ('core', 'brand')
    and lower(coalesce(name, '')) not in ('вода', 'water')
),
ref_counts as (
  select
    food_id,
    count(*) as ref_count
  from (
    select canonical_food_id as food_id
    from public.food_diary_entries
    where canonical_food_id is not null

    union all

    select canonical_food_id as food_id
    from public.favorite_products
    where canonical_food_id is not null

    union all

    select food_id
    from public.recipe_ingredients
  ) refs
  group by food_id
),
incident_zero_with_refs as (
  select z.id
  from incident_zero_foods z
  join ref_counts r
    on r.food_id = z.id
),
affected_diary_rows as (
  select fde.id
  from public.food_diary_entries fde
  join incident_zero_foods z
    on z.id = fde.canonical_food_id
)
select
  (select count(*) from zero_foods) as all_zero_food_rows_total,
  (select count(*) from incident_zero_foods) as incident_zero_food_rows,
  (select count(*) from whitelist_valid_zero) as whitelist_valid_zero_rows,
  (select count(*) from suspicious_catalog_zero) as suspicious_catalog_zero_rows,
  (select count(*) from incident_zero_with_refs) as incident_zero_food_rows_with_refs,
  (select count(*) from affected_diary_rows) as affected_diary_rows;

-- =========================================================
-- SECTION B: Incident-scope all-zero foods
-- =========================================================
select
  f.id,
  f.name,
  f.brand,
  f.source,
  f.category,
  f.created_by_user_id,
  f.canonical_food_id,
  f.verified,
  f.suspicious,
  f.auto_filled,
  f.created_at,
  f.updated_at
from public.foods f
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
order by f.source, f.category, f.name, f.id;

-- =========================================================
-- SECTION C: Whitelist-valid zero rows
-- =========================================================
select
  f.id,
  f.name,
  f.brand,
  f.source,
  f.category,
  f.created_at,
  f.updated_at
from public.foods f
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
  and lower(coalesce(f.name, '')) in ('вода', 'water')
order by f.name, f.id;

-- =========================================================
-- SECTION D: Suspicious catalog rows
-- =========================================================
select
  f.id,
  f.name,
  f.brand,
  f.source,
  f.category,
  f.created_at,
  f.updated_at
from public.foods f
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
  and f.source in ('core', 'brand')
  and lower(coalesce(f.name, '')) not in ('вода', 'water')
order by f.source, f.category, f.name, f.id;

-- =========================================================
-- SECTION E: Suspicious meat/fish/basic catalog rows
-- =========================================================
select
  f.id,
  f.name,
  f.brand,
  f.source,
  f.category,
  f.created_at,
  f.updated_at
from public.foods f
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
  and f.source in ('core', 'brand')
  and (
    lower(coalesce(f.name, '')) similar to '%(говядин|свинин|куриц|индейк|баранин|телятин|фарш|антрекот|бефстроганов|рыб|лосос|тун|треск|скумбр|сельд|кревет|мяс)%'
    or lower(coalesce(f.category, '')) in ('meat', 'fish', 'protein', 'seafood')
  )
order by f.name, f.id;

-- =========================================================
-- SECTION F: Downstream references for incident rows
-- =========================================================
with ref_counts as (
  select
    food_id,
    count(*) as ref_count
  from (
    select canonical_food_id as food_id
    from public.food_diary_entries
    where canonical_food_id is not null

    union all

    select canonical_food_id as food_id
    from public.favorite_products
    where canonical_food_id is not null

    union all

    select food_id
    from public.recipe_ingredients
  ) refs
  group by food_id
)
select
  f.id,
  f.name,
  f.brand,
  f.source,
  f.category,
  coalesce(r.ref_count, 0) as ref_count,
  f.created_at,
  f.updated_at
from public.foods f
left join ref_counts r
  on r.food_id = f.id
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
  and coalesce(r.ref_count, 0) > 0
order by r.ref_count desc, f.source, f.name, f.id;

-- =========================================================
-- SECTION G: Confirmed incident names
-- =========================================================
select
  f.id,
  f.name,
  f.brand,
  f.source,
  f.category,
  f.calories,
  f.protein,
  f.fat,
  f.carbs,
  f.created_at,
  f.updated_at
from public.foods f
where lower(coalesce(f.name, '')) in (
  'антрекот',
  'антрекот из говядины',
  'антрекот из свинины',
  'бефстроганов из говядины',
  'говядина'
)
order by f.name, f.id;

-- =========================================================
-- SECTION H: Incident rows grouped by source/category
-- =========================================================
select
  source,
  category,
  count(*) as row_count
from public.foods f
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
group by source, category
order by row_count desc, source, category;

-- =========================================================
-- SECTION I: Affected diary rows tied to incident foods
-- =========================================================
select
  fde.id,
  fde.user_id,
  fde.date,
  fde.meal_type,
  fde.canonical_food_id,
  f.name as canonical_food_name,
  fde.product_name as diary_product_name,
  fde.weight,
  fde.calories,
  fde.protein,
  fde.fat,
  fde.carbs,
  fde.created_at
from public.food_diary_entries fde
join public.foods f
  on f.id = fde.canonical_food_id
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
order by fde.created_at desc, fde.id;

-- =========================================================
-- SECTION J: Candidate diary remediation rows
-- Only rows whose stored snapshot is all-zero
-- =========================================================
select
  fde.id,
  fde.user_id,
  fde.date,
  fde.meal_type,
  fde.canonical_food_id,
  f.name as canonical_food_name,
  fde.weight,
  fde.created_at
from public.food_diary_entries fde
join public.foods f
  on f.id = fde.canonical_food_id
where coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0
  and f.created_at::date = date '2026-03-05'
  and coalesce(fde.calories, 0) = 0
  and coalesce(fde.protein, 0) = 0
  and coalesce(fde.fat, 0) = 0
  and coalesce(fde.carbs, 0) = 0
order by fde.created_at desc, fde.id;
