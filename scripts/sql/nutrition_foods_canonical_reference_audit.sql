-- Nutrition foods canonical reference audit
-- Read-only
-- Purpose:
-- - inspect canonical self-link quality in foods
-- - surface foods that are not linked to a canonical row
-- - show foods with no inbound references from diary/favorites/recipes

with inbound_refs as (
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
)
select
  f.id,
  f.name,
  f.source,
  f.created_by_user_id,
  f.canonical_food_id,
  case
    when f.canonical_food_id is null then 'missing_canonical_food_id'
    when f.canonical_food_id = f.id then 'self_canonical'
    else 'points_to_other_food'
  end as canonical_status,
  case
    when cf.id is null and f.canonical_food_id is not null then 'broken_canonical_pointer'
    else 'ok'
  end as canonical_pointer_status,
  coalesce(ir.total_refs, 0) as inbound_reference_count
from public.foods f
left join public.foods cf
  on cf.id = f.canonical_food_id
left join inbound_refs ir
  on ir.food_id = f.id
order by
  case
    when f.canonical_food_id is null then 0
    when cf.id is null and f.canonical_food_id is not null then 1
    when coalesce(ir.total_refs, 0) = 0 then 2
    else 3
  end,
  f.source,
  f.name,
  f.id;
