-- Nutrition duplicate foods audit
-- Read-only
-- Purpose:
-- - surface potential duplicate foods by normalized key
-- - highlight duplicates that already participate in diary/favorites/recipes

with food_refs as (
  select food_id, sum(ref_count) as total_refs
  from (
    select ri.food_id, count(*) as ref_count
    from public.recipe_ingredients ri
    group by ri.food_id

    union all

    select e.canonical_food_id as food_id, count(*) as ref_count
    from public.food_diary_entries e
    where e.canonical_food_id is not null
    group by e.canonical_food_id

    union all

    select fp.canonical_food_id as food_id, count(*) as ref_count
    from public.favorite_products fp
    where fp.canonical_food_id is not null
    group by fp.canonical_food_id
  ) refs
  group by food_id
),
dupe_groups as (
  select
    normalized_name,
    coalesce(normalized_brand, '') as normalized_brand_key,
    count(*) as food_rows,
    array_agg(id order by id) as food_ids
  from public.foods
  where coalesce(normalized_name, '') <> ''
  group by normalized_name, coalesce(normalized_brand, '')
  having count(*) > 1
)
select
  dg.normalized_name,
  dg.normalized_brand_key,
  dg.food_rows,
  f.id,
  f.name,
  f.source,
  f.created_by_user_id,
  f.canonical_food_id,
  coalesce(fr.total_refs, 0) as inbound_reference_count
from dupe_groups dg
join public.foods f
  on f.normalized_name = dg.normalized_name
 and coalesce(f.normalized_brand, '') = dg.normalized_brand_key
left join food_refs fr
  on fr.food_id = f.id
order by dg.food_rows desc, dg.normalized_name, dg.normalized_brand_key, inbound_reference_count desc, f.id;
