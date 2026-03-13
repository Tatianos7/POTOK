-- Nutrition recipe mismatch remediation plan
-- Manual / operator-assisted SQL
-- Non-destructive by default
-- Purpose:
-- - preview mismatch recipes
-- - provide safe per-recipe recompute steps
-- - provide safe no-ingredients inspection steps

-- =========================================================
-- SECTION A: Preview current mismatch recipe state
-- Replace the UUID if needed.
-- =========================================================
select
  r.id as recipe_id,
  r.name,
  r.user_id,
  r.total_calories,
  r.protein,
  r.fat,
  r.carbs,
  r.created_at,
  r.updated_at
from public.recipes r
where r.id = '72656369-7065-45f6-8d65-616c5f313736'::uuid;

select
  ri.id as recipe_ingredient_id,
  ri.recipe_id,
  ri.food_id,
  f.name as food_name,
  ri.amount_g,
  f.calories,
  f.protein,
  f.fat,
  f.carbs
from public.recipe_ingredients ri
join public.foods f
  on f.id = ri.food_id
where ri.recipe_id = '72656369-7065-45f6-8d65-616c5f313736'::uuid
order by ri.created_at, ri.id;

-- =========================================================
-- SECTION B: Dry-run recompute for mismatch recipe
-- Expected operator flow:
-- 1) BEGIN
-- 2) run recompute_recipe_totals for the exact recipe
-- 3) inspect updated totals
-- 4) ROLLBACK first
-- 5) if the values are correct, repeat with COMMIT
-- =========================================================
begin;

select *
from public.recompute_recipe_totals('72656369-7065-45f6-8d65-616c5f313736'::uuid);

select
  r.id as recipe_id,
  r.name,
  r.total_calories,
  r.protein,
  r.fat,
  r.carbs,
  r.updated_at
from public.recipes r
where r.id = '72656369-7065-45f6-8d65-616c5f313736'::uuid;

rollback;

-- =========================================================
-- SECTION C: Safe commit template for mismatch recipe
-- Run manually only after verifying the dry-run result above.
-- =========================================================
-- begin;
-- select * from public.recompute_recipe_totals('72656369-7065-45f6-8d65-616c5f313736'::uuid);
-- select r.id, r.name, r.total_calories, r.protein, r.fat, r.carbs, r.updated_at
-- from public.recipes r
-- where r.id = '72656369-7065-45f6-8d65-616c5f313736'::uuid;
-- commit;

-- =========================================================
-- SECTION D: Safe no-ingredients inspection
-- These rows should not be recomputed blindly unless the operator confirms
-- whether ingredients JSON is only legacy shadow data or the recipe is
-- intentionally empty.
-- =========================================================
select
  r.id as recipe_id,
  r.name,
  r.user_id,
  r.total_calories,
  r.protein,
  r.fat,
  r.carbs,
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
  r.created_at,
  r.updated_at
from public.recipes r
where r.id in (
  '72656369-7065-45f3-b137-363733353137'::uuid,
  '72656369-7065-45f3-9137-363732373731'::uuid,
  '72656369-7065-45f3-9137-363733353132'::uuid
)
order by r.name, r.id;

-- Safe operator rule:
-- - if recipe_ingredients has 0 rows and ingredients_json_length > 0:
--   treat this as a migration/backfill candidate, not as a recompute candidate
-- - if recipe_ingredients has 0 rows and ingredients_json_length = 0:
--   recipe may be intentionally empty; keep totals at zero unless product
--   requirements say otherwise
