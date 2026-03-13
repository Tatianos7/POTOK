-- Nutrition recipe shadow-JSON backfill apply
-- Non-destructive
-- Purpose:
-- - backfill recipe_ingredients only for recipes that currently have zero rows
-- - use legacy recipes.ingredients JSON as source
-- - skip unresolved rows and invalid grams
-- - do not delete or overwrite existing recipe_ingredients
--
-- Run only after reviewing:
-- - scripts/sql/nutrition_recipe_no_ingredients_audit.sql
-- - scripts/sql/nutrition_recipe_shadow_json_backfill_preview.sql

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
  cross join lateral jsonb_array_elements(r.ingredients) as i(elem)
),
resolved as (
  select
    p.recipe_id,
    coalesce(
      p.canonical_food_id_from_json,
      (
        select f.id
        from public.foods f
        where lower(coalesce(f.name, '')) = lower(coalesce(p.ingredient_name, ''))
        order by f.created_at desc, f.id
        limit 1
      )
    ) as resolved_food_id,
    round(p.amount_g::numeric, 2) as amount_g
  from parsed p
  where p.amount_g is not null
    and p.amount_g > 0
),
eligible as (
  select
    recipe_id,
    resolved_food_id as food_id,
    amount_g
  from resolved
  where resolved_food_id is not null
)
insert into public.recipe_ingredients (recipe_id, food_id, amount_g)
select
  e.recipe_id,
  e.food_id,
  e.amount_g
from eligible e
where not exists (
  select 1
  from public.recipe_ingredients ri
  where ri.recipe_id = e.recipe_id
);
