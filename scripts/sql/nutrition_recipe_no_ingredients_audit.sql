-- Nutrition recipe no-ingredients audit
-- Read-only
-- Purpose:
-- - inspect recipes that currently have no rows in public.recipe_ingredients
-- - show whether legacy recipes.ingredients JSON still contains shadow data

with recipe_ingredient_counts as (
  select
    r.id as recipe_id,
    count(ri.id) as ingredient_rows
  from public.recipes r
  left join public.recipe_ingredients ri
    on ri.recipe_id = r.id
  group by r.id
)
select
  r.id as recipe_id,
  r.name,
  r.user_id,
  coalesce(r.total_calories, 0) as stored_total_calories,
  coalesce(r.protein, 0) as stored_protein,
  coalesce(r.fat, 0) as stored_fat,
  coalesce(r.carbs, 0) as stored_carbs,
  case
    when r.ingredients is null then 'null'
    when jsonb_typeof(r.ingredients) <> 'array' then jsonb_typeof(r.ingredients)
    else 'array'
  end as ingredients_json_type,
  case
    when r.ingredients is null then 0
    when jsonb_typeof(r.ingredients) = 'array' then jsonb_array_length(r.ingredients)
    else null
  end as ingredients_json_length,
  case
    when r.ingredients is null then false
    when jsonb_typeof(r.ingredients) = 'array' and jsonb_array_length(r.ingredients) > 0 then true
    else false
  end as has_shadow_ingredients_json,
  r.created_at,
  r.updated_at
from public.recipes r
join recipe_ingredient_counts ric
  on ric.recipe_id = r.id
where ric.ingredient_rows = 0
order by r.updated_at desc nulls last, r.created_at desc nulls last, r.name, r.id;
