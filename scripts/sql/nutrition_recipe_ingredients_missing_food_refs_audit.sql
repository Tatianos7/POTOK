-- Nutrition recipe ingredients missing food refs audit
-- Read-only
-- Purpose:
-- - find recipe_ingredients rows pointing to missing foods
-- - validate food lookup integrity for recipe analyzer

select
  ri.id as recipe_ingredient_id,
  ri.recipe_id,
  r.user_id,
  r.name as recipe_name,
  ri.food_id,
  ri.amount_g,
  f.name as linked_food_name,
  case
    when f.id is null then 'broken_food_reference'
    else 'ok'
  end as linkage_status,
  ri.created_at
from public.recipe_ingredients ri
left join public.foods f
  on f.id = ri.food_id
left join public.recipes r
  on r.id = ri.recipe_id
where f.id is null
order by ri.created_at desc nulls last, ri.id;
