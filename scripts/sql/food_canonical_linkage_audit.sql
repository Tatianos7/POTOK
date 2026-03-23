-- Food canonical linkage audit
-- Read-only
-- Purpose:
-- - inspect canonical linkage quality across foods and downstream references
-- - surface rows that are missing canonical links or point to invalid roots

-- =========================================================
-- SECTION A: foods canonical linkage summary
-- =========================================================
with foods_enriched as (
  select
    f.id,
    f.name,
    f.source,
    f.created_by_user_id,
    f.canonical_food_id,
    cf.id as canonical_row_id
  from public.foods f
  left join public.foods cf
    on cf.id = f.canonical_food_id
)
select
  count(*) as total_foods,
  count(*) filter (where canonical_food_id is null) as foods_missing_canonical_food_id,
  count(*) filter (where canonical_food_id = id) as foods_self_canonical,
  count(*) filter (where canonical_food_id is not null and canonical_food_id <> id) as foods_pointing_to_other_canonical,
  count(*) filter (where canonical_food_id is not null and canonical_row_id is null) as foods_with_broken_canonical_pointer
from foods_enriched;

-- =========================================================
-- SECTION B: downstream canonical reference summary
-- =========================================================
select
  count(*) filter (where e.canonical_food_id is null) as diary_without_canonical_food_id,
  count(*) filter (where e.canonical_food_id is not null and f.id is null) as diary_with_missing_food,
  count(*) filter (where fp.canonical_food_id is null) as favorites_without_canonical_food_id,
  count(*) filter (where fp.canonical_food_id is not null and ff.id is null) as favorites_with_missing_food,
  count(*) filter (where ri.food_id is null) as recipe_ingredients_without_food_id,
  count(*) filter (where ri.food_id is not null and rf.id is null) as recipe_ingredients_with_missing_food
from public.food_diary_entries e
left join public.foods f on f.id = e.canonical_food_id
cross join public.favorite_products fp
left join public.foods ff on ff.id = fp.canonical_food_id
cross join public.recipe_ingredients ri
left join public.foods rf on rf.id = ri.food_id;

-- =========================================================
-- SECTION C: foods that should probably be canonical roots
-- =========================================================
with foods_enriched as (
  select
    f.id,
    f.name,
    f.source,
    f.created_by_user_id,
    f.canonical_food_id,
    cf.id as canonical_row_id,
    cf.source as canonical_source,
    cf.created_by_user_id as canonical_created_by_user_id
  from public.foods f
  left join public.foods cf
    on cf.id = f.canonical_food_id
)
select
  id,
  name,
  source,
  created_by_user_id,
  canonical_food_id,
  canonical_source,
  canonical_created_by_user_id,
  case
    when canonical_food_id is null then 'missing_canonical_food_id'
    when canonical_row_id is null then 'broken_canonical_pointer'
    when source = 'user' and canonical_food_id <> id and canonical_created_by_user_id is distinct from created_by_user_id
      then 'user_food_points_to_other_owner'
    when source in ('core', 'brand') and canonical_food_id <> id then 'catalog_row_not_root'
    else 'review'
  end as canonical_issue
from foods_enriched
where canonical_food_id is null
   or canonical_row_id is null
   or (source = 'user' and canonical_food_id <> id and canonical_created_by_user_id is distinct from created_by_user_id)
   or (source in ('core', 'brand') and canonical_food_id <> id)
order by canonical_issue, source, name, id;

-- =========================================================
-- SECTION D: unresolved downstream rows
-- =========================================================
select
  'food_diary_entries' as table_name,
  e.id as row_id,
  e.user_id,
  e.product_name as display_name,
  e.canonical_food_id as referenced_food_id,
  case
    when e.canonical_food_id is null then 'missing_canonical_food_id'
    when f.id is null then 'broken_food_reference'
    else 'ok'
  end as linkage_status
from public.food_diary_entries e
left join public.foods f
  on f.id = e.canonical_food_id
where e.canonical_food_id is null
   or f.id is null

union all

select
  'favorite_products' as table_name,
  fp.id as row_id,
  fp.user_id,
  fp.product_name as display_name,
  fp.canonical_food_id as referenced_food_id,
  case
    when fp.canonical_food_id is null then 'missing_canonical_food_id'
    when f.id is null then 'broken_food_reference'
    else 'ok'
  end as linkage_status
from public.favorite_products fp
left join public.foods f
  on f.id = fp.canonical_food_id
where fp.canonical_food_id is null
   or f.id is null

union all

select
  'recipe_ingredients' as table_name,
  ri.id as row_id,
  r.user_id,
  r.name as display_name,
  ri.food_id as referenced_food_id,
  case
    when ri.food_id is null then 'missing_food_id'
    when f.id is null then 'broken_food_reference'
    else 'ok'
  end as linkage_status
from public.recipe_ingredients ri
left join public.foods f
  on f.id = ri.food_id
left join public.recipes r
  on r.id = ri.recipe_id
where ri.food_id is null
   or f.id is null
order by table_name, linkage_status, display_name, row_id;
