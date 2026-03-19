-- Food canonical promotion candidates audit
-- Read-only
-- Purpose:
-- - find standalone foods that probably should become aliases or point to an
--   existing canonical root instead of remaining separate foods

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
),
same_key_pairs as (
  select
    child.id as child_food_id,
    child.name as child_food_name,
    child.source as child_source,
    child.created_by_user_id as child_owner,
    child.canonical_food_id as child_canonical_food_id,
    root.id as root_food_id,
    root.name as root_food_name,
    root.source as root_source,
    root.created_by_user_id as root_owner,
    coalesce(rc.ref_count, 0) as child_ref_count
  from public.foods child
  join public.foods root
    on root.normalized_name = child.normalized_name
   and coalesce(root.normalized_brand, '') = coalesce(child.normalized_brand, '')
   and root.id <> child.id
   and root.canonical_food_id = root.id
  left join ref_counts rc
    on rc.food_id = child.id
  where coalesce(child.normalized_name, '') <> ''
)
select
  child_food_id,
  child_food_name,
  child_source,
  child_owner,
  child_canonical_food_id,
  root_food_id,
  root_food_name,
  root_source,
  root_owner,
  child_ref_count,
  case
    when child_canonical_food_id is null then 'missing_canonical_candidate'
    when child_canonical_food_id = child_food_id and root_food_id is not null then 'should_point_to_existing_root'
    when child_canonical_food_id <> child_food_id and child_canonical_food_id <> root_food_id then 'points_to_non_root_candidate'
    else 'review'
  end as promotion_assessment
from same_key_pairs
where child_canonical_food_id is null
   or child_canonical_food_id = child_food_id
   or child_canonical_food_id <> root_food_id
order by promotion_assessment, child_source, child_food_name, child_food_id;
