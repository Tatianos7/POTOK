-- Nutrition recipe macro consistency audit
-- Read-only
-- Purpose:
-- - compare stored recipe totals vs live totals from recipe_ingredients + foods
-- - highlight recipes where saved totals drifted from actual ingredient nutrition

with computed as (
  select
    r.id as recipe_id,
    r.user_id as recipe_user_id,
    r.name,
    count(ri.id) as ingredient_rows,
    coalesce(sum(coalesce(f.calories, 0) * coalesce(ri.amount_g, 0) / 100.0), 0) as computed_total_calories,
    coalesce(sum(coalesce(f.protein, 0) * coalesce(ri.amount_g, 0) / 100.0), 0) as computed_protein,
    coalesce(sum(coalesce(f.fat, 0) * coalesce(ri.amount_g, 0) / 100.0), 0) as computed_fat,
    coalesce(sum(coalesce(f.carbs, 0) * coalesce(ri.amount_g, 0) / 100.0), 0) as computed_carbs,
    count(*) filter (
      where coalesce(f.calories, 0) = 0
        and coalesce(f.protein, 0) = 0
        and coalesce(f.fat, 0) = 0
        and coalesce(f.carbs, 0) = 0
    ) as zero_macro_food_rows,
    coalesce(r.total_calories, 0) as stored_total_calories,
    coalesce(r.protein, 0) as stored_protein,
    coalesce(r.fat, 0) as stored_fat,
    coalesce(r.carbs, 0) as stored_carbs
  from public.recipes r
  left join public.recipe_ingredients ri
    on ri.recipe_id = r.id
  left join public.foods f
    on f.id = ri.food_id
  group by
    r.id,
    r.user_id,
    r.name,
    r.total_calories,
    r.protein,
    r.fat,
    r.carbs
)

select
  recipe_id,
  recipe_user_id as user_id,
  name,
  ingredient_rows,
  round(stored_total_calories::numeric, 2) as stored_total_calories,
  round(computed_total_calories::numeric, 2) as computed_total_calories,
  round(stored_protein::numeric, 2) as stored_protein,
  round(computed_protein::numeric, 2) as computed_protein,
  round(stored_fat::numeric, 2) as stored_fat,
  round(computed_fat::numeric, 2) as computed_fat,
  round(stored_carbs::numeric, 2) as stored_carbs,
  round(computed_carbs::numeric, 2) as computed_carbs,
  zero_macro_food_rows,
  case
    when ingredient_rows = 0 then 'no_ingredients'
    when abs(stored_total_calories - computed_total_calories) > 0.01
      or abs(stored_protein - computed_protein) > 0.01
      or abs(stored_fat - computed_fat) > 0.01
      or abs(stored_carbs - computed_carbs) > 0.01
    then 'mismatch'
    else 'ok'
  end as audit_status
from computed
order by
  case
    when ingredient_rows = 0 then 1
    when abs(stored_total_calories - computed_total_calories) > 0.01
      or abs(stored_protein - computed_protein) > 0.01
      or abs(stored_fat - computed_fat) > 0.01
      or abs(stored_carbs - computed_carbs) > 0.01
    then 2
    else 3
  end,
  name,
  recipe_id;