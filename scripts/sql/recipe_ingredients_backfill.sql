-- Best-effort backfill: recipes.ingredients JSON -> recipe_ingredients
-- Run manually in Supabase SQL Editor as postgres.
-- Idempotent-ish: skips exact duplicates by (recipe_id, food_id, amount_g).
-- Does not delete or modify existing JSON ingredients.

with parsed as (
  select
    r.id as recipe_id,
    i.elem as ingredient,
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
    end as canonical_food_id
  from public.recipes r
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(r.ingredients) = 'array' then r.ingredients
      else '[]'::jsonb
    end
  ) as i(elem)
), resolved as (
  select
    p.recipe_id,
    coalesce(
      p.canonical_food_id,
      (
        select f.id
        from public.foods f
        where lower(f.name) = lower(p.ingredient_name)
        order by f.created_at desc
        limit 1
      )
    ) as food_id,
    p.amount_g
  from parsed p
  where p.amount_g is not null
    and p.amount_g > 0
)
insert into public.recipe_ingredients (recipe_id, food_id, amount_g)
select
  r.recipe_id,
  r.food_id,
  round(r.amount_g::numeric, 2)
from resolved r
where r.food_id is not null
  and not exists (
    select 1
    from public.recipe_ingredients ri
    where ri.recipe_id = r.recipe_id
      and ri.food_id = r.food_id
      and ri.amount_g = round(r.amount_g::numeric, 2)
  );
