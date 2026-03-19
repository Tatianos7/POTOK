-- Food canonical duplicates audit
-- Read-only
-- Purpose:
-- - surface duplicate foods by normalized key
-- - distinguish probable canonical roots from probable alias/duplicate rows

with grouped as (
  select
    normalized_name,
    coalesce(normalized_brand, '') as normalized_brand_key,
    count(*) as row_count,
    array_agg(id order by id) as food_ids
  from public.foods
  where coalesce(normalized_name, '') <> ''
  group by normalized_name, coalesce(normalized_brand, '')
  having count(*) > 1
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
)
select
  g.normalized_name,
  g.normalized_brand_key,
  g.row_count,
  f.id,
  f.name,
  f.brand,
  f.source,
  f.created_by_user_id,
  f.canonical_food_id,
  coalesce(rc.ref_count, 0) as inbound_reference_count,
  case
    when f.canonical_food_id = f.id and coalesce(rc.ref_count, 0) > 0 then 'likely_canonical_root'
    when f.canonical_food_id is null then 'missing_canonical'
    when f.canonical_food_id <> f.id then 'likely_duplicate_or_variant'
    else 'review'
  end as duplicate_assessment
from grouped g
join public.foods f
  on f.normalized_name = g.normalized_name
 and coalesce(f.normalized_brand, '') = g.normalized_brand_key
left join ref_counts rc
  on rc.food_id = f.id
order by g.row_count desc, g.normalized_name, g.normalized_brand_key, duplicate_assessment, f.name, f.id;
