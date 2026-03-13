-- Nutrition diary missing food refs audit
-- Read-only
-- Purpose:
-- - find diary rows with broken canonical_food_id
-- - show legacy rows that still have no canonical linkage

select
  e.id,
  e.user_id,
  e.date,
  e.meal_type,
  e.product_name,
  e.canonical_food_id,
  f.name as linked_food_name,
  case
    when e.canonical_food_id is null then 'missing_canonical_food_id'
    when f.id is null then 'broken_food_reference'
    else 'ok'
  end as linkage_status,
  e.created_at
from public.food_diary_entries e
left join public.foods f
  on f.id = e.canonical_food_id
where e.canonical_food_id is null
   or f.id is null
order by
  case
    when e.canonical_food_id is null then 0
    else 1
  end,
  e.date desc,
  e.created_at desc nulls last,
  e.id;
