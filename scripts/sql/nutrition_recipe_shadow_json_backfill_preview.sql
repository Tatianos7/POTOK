-- Nutrition recipe shadow-JSON backfill preview
-- Read-only
-- Purpose:
-- - detect recipes with zero recipe_ingredients but non-empty legacy ingredients JSON
-- - preview which ingredient rows can be safely backfilled

with ingredient_counts as (
  select
    r.id as recipe_id,
    count(ri.id) as ingredient_rows
  from public.recipes r
  left join public.recipe_ingredients ri
    on ri.recipe_id = r.id
  group by r.id
),
candidate_recipes as (
  select
    r.id as recipe_id,
    r.name,
    r.user_id,
    r.ingredients
  from public.recipes r
  join ingredient_counts ic
    on ic.recipe_id = r.id
  where ic.ingredient_rows = 0
    and jsonb_typeof(r.ingredients) = 'array'
    and jsonb_array_length(r.ingredients) > 0
),
parsed as (
  select
    r.recipe_id,
    r.name as recipe_name,
    r.user_id,
    i.ord as ingredient_position,
    i.elem as ingredient_json,
    nullif(trim(i.elem->>'name'), '') as ingredient_name,
    case
      when jsonb_typeof(i.elem->'grams') = 'number' then (i.elem->>'grams')::numeric
      when (i.elem->>'grams') ~ '^[0-9]+(\.[0-9]+)?$' then (i.elem->>'grams')::numeric
      else null
    end as amount_g,
    case
      when (i.elem ? 'canonical_food_id')
       and coalesce(i.elem->>'canonical_food_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (i.elem->>'canonical_food_id')::uuid
      else null
    end as canonical_food_id_from_json
  from candidate_recipes r
  cross join lateral jsonb_array_elements(r.ingredients) with ordinality as i(elem, ord)
),
resolved as (
  select
    p.*,
    coalesce(
      p.canonical_food_id_from_json,
      (
        select f.id
        from public.foods f
        where lower(coalesce(f.name, '')) = lower(coalesce(p.ingredient_name, ''))
        order by f.created_at desc, f.id
        limit 1
      )
    ) as resolved_food_id
  from parsed p
)
select
  recipe_id,
  recipe_name,
  user_id,
  ingredient_position,
  ingredient_name,
  amount_g,
  canonical_food_id_from_json,
  resolved_food_id,
  case
    when amount_g is null or amount_g <= 0 then 'invalid_amount_g'
    when resolved_food_id is null then 'unresolved_food'
    else 'ready_for_backfill'
  end as backfill_status
from resolved
order by recipe_name, recipe_id, ingredient_position;
