-- Nutrition zero-macro incident audit
-- Read-only
-- Purpose:
-- - audit all-zero macro rows in public.foods
-- - isolate suspicious catalog rows involved in the incident
-- - show downstream references and corrupted diary rows

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
zero_with_refs as (
  select z.id
  from zero_foods z
  join ref_counts r
    on r.food_id = z.id
),
suspicious_catalog_zero as (
  select z.id
  from zero_foods z
  where z.source in ('core', 'brand')
    and lower(coalesce(z.name, '')) not in ('вода', 'water')
),
confirmed_incident_names as (
  select z.id
  from zero_foods z
  where lower(coalesce(z.name, '')) in (
    'антрекот',
    'антрекот из говядины',
    'антрекот из свинины',
    'бефстроганов из говядины',
    'говядина'
  )
),
affected_diary_rows as (
  select fde.id
  from public.food_diary_entries fde
  join zero_foods z
    on z.id = fde.canonical_food_id
)
select
  (select count(*) from zero_foods) as all_zero_food_rows,
  (select count(*) from zero_with_refs) as all_zero_food_rows_with_refs,
  (select count(*) from suspicious_catalog_zero) as suspicious_catalog_zero_rows,
  (select count(*) from confirmed_incident_names) as confirmed_incident_rows,
  (select count(*) from affected_diary_rows) as affected_diary_rows;

-- =========================================================
-- SECTION B: All all-zero foods
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
order by f.source, f.category, f.name, f.id;

-- =========================================================
-- SECTION C: All-zero foods with downstream refs
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
  and coalesce(r.ref_count, 0) > 0
order by ref_count desc, f.source, f.name, f.id;

-- =========================================================
-- SECTION D: Suspicious catalog meat/fish/basic rows
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
  and f.source in ('core', 'brand')
  and lower(coalesce(f.name, '')) not in ('вода', 'water')
  and (
    lower(coalesce(f.name, '')) similar to '%(говядин|свинин|куриц|индейк|баранин|телятин|фарш|антрекот|бефстроганов|рыб|лосос|тун|треск|скумбр|сельд|кревет|мяс)%'
    or lower(coalesce(f.category, '')) in ('meat', 'fish', 'protein', 'seafood')
  )
order by f.name, f.id;

-- =========================================================
-- SECTION E: Confirmed incident rows by exact names
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
-- SECTION F: Affected diary rows for all-zero foods
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
order by fde.created_at desc, fde.id;

-- =========================================================
-- SECTION G: Affected diary rows for confirmed incident names
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
where lower(coalesce(f.name, '')) in (
  'антрекот',
  'антрекот из говядины',
  'антрекот из свинины',
  'бефстроганов из говядины',
  'говядина'
)
order by fde.created_at desc, fde.id;
