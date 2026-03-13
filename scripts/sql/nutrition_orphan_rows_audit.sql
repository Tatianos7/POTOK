-- Nutrition orphan rows audit
-- Read-only
-- Purpose:
-- - find rows that reference missing parent rows
-- - validate graph integrity across favorite_products, food_diary_entries,
--   recipes, and recipe_ingredients

-- =========================================================
-- SECTION A: Summary counts
-- =========================================================
with favorite_orphans as (
  select count(*) as orphan_count
  from public.favorite_products fp
  left join public.foods f
    on f.id = fp.canonical_food_id
  where fp.canonical_food_id is not null
    and f.id is null
),
diary_orphans as (
  select count(*) as orphan_count
  from public.food_diary_entries e
  left join public.foods f
    on f.id = e.canonical_food_id
  where e.canonical_food_id is not null
    and f.id is null
),
recipe_ingredient_food_orphans as (
  select count(*) as orphan_count
  from public.recipe_ingredients ri
  left join public.foods f
    on f.id = ri.food_id
  where f.id is null
),
recipe_ingredient_recipe_orphans as (
  select count(*) as orphan_count
  from public.recipe_ingredients ri
  left join public.recipes r
    on r.id = ri.recipe_id
  where r.id is null
)
select
  (select orphan_count from favorite_orphans) as favorite_products_missing_food,
  (select orphan_count from diary_orphans) as food_diary_entries_missing_food,
  (select orphan_count from recipe_ingredient_food_orphans) as recipe_ingredients_missing_food,
  (select orphan_count from recipe_ingredient_recipe_orphans) as recipe_ingredients_missing_recipe;

-- =========================================================
-- SECTION B: Detailed orphan rows
-- =========================================================
select
  'favorite_products_missing_food' as orphan_type,
  fp.id::text as row_id,
  fp.user_id::text as owner_user_id,
  fp.canonical_food_id::text as missing_ref_id,
  fp.product_name as display_name,
  fp.created_at
from public.favorite_products fp
left join public.foods f
  on f.id = fp.canonical_food_id
where fp.canonical_food_id is not null
  and f.id is null

union all

select
  'food_diary_entries_missing_food' as orphan_type,
  e.id::text as row_id,
  e.user_id::text as owner_user_id,
  e.canonical_food_id::text as missing_ref_id,
  e.product_name as display_name,
  e.created_at
from public.food_diary_entries e
left join public.foods f
  on f.id = e.canonical_food_id
where e.canonical_food_id is not null
  and f.id is null

union all

select
  'recipe_ingredients_missing_food' as orphan_type,
  ri.id::text as row_id,
  r.user_id::text as owner_user_id,
  ri.food_id::text as missing_ref_id,
  r.name as display_name,
  ri.created_at
from public.recipe_ingredients ri
left join public.foods f
  on f.id = ri.food_id
left join public.recipes r
  on r.id = ri.recipe_id
where f.id is null

union all

select
  'recipe_ingredients_missing_recipe' as orphan_type,
  ri.id::text as row_id,
  null::text as owner_user_id,
  ri.recipe_id::text as missing_ref_id,
  null::text as display_name,
  ri.created_at
from public.recipe_ingredients ri
left join public.recipes r
  on r.id = ri.recipe_id
where r.id is null

order by orphan_type, created_at desc nulls last, row_id;
