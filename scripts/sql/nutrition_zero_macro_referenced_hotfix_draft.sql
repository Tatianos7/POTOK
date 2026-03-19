-- Nutrition zero-macro referenced hotfix draft
-- DRAFT ONLY
-- Do not run blindly in production
-- Purpose:
-- - apply a first-response hotfix only for referenced incident foods with approved exact ids
-- - keep unresolved/manual-review rows out of the write batch
-- Rules:
-- - exact ids only
-- - exact approved target macros only
-- - row must still be all-zero
-- - source must be core/brand
-- - no broad name/category updates

begin;

create temporary table tmp_referenced_food_hotfix (
  food_id uuid primary key,
  food_name text not null,
  target_calories numeric(8,2) not null,
  target_protein numeric(8,2) not null,
  target_fat numeric(8,2) not null,
  target_carbs numeric(8,2) not null,
  target_fiber numeric(8,2),
  authoritative_source text not null,
  reviewer text not null,
  approved_at timestamptz not null
) on commit drop;

-- Fill only approved exact-id rows.
-- At the moment, only rows with confirmed exact unique repo match should be inserted here.
-- Example:
-- insert into tmp_referenced_food_hotfix (
--   food_id,
--   food_name,
--   target_calories,
--   target_protein,
--   target_fat,
--   target_carbs,
--   target_fiber,
--   authoritative_source,
--   reviewer,
--   approved_at
-- ) values (
--   '7b2f4b6a-049e-4714-81f4-79199b47ab6b',
--   'Куриная грудка',
--   165,
--   31.0,
--   3.6,
--   0.0,
--   null,
--   'src/data/foodsDatabaseGenerator.ts:150; src/data/foodsDatabase.ts:97; src/data/baseFoods.ts:13',
--   'reviewer_name',
--   now()
-- );

-- Preview target rows before update.
select
  f.id,
  f.name,
  f.source,
  f.category,
  f.calories as current_calories,
  f.protein as current_protein,
  f.fat as current_fat,
  f.carbs as current_carbs,
  h.target_calories,
  h.target_protein,
  h.target_fat,
  h.target_carbs,
  h.authoritative_source,
  h.reviewer,
  h.approved_at
from tmp_referenced_food_hotfix h
join public.foods f
  on f.id = h.food_id
order by f.name, f.id;

update public.foods f
set
  calories = h.target_calories,
  protein = h.target_protein,
  fat = h.target_fat,
  carbs = h.target_carbs,
  fiber = coalesce(h.target_fiber, f.fiber),
  suspicious = false,
  nutrition_version = coalesce(f.nutrition_version, 1) + 1,
  updated_at = now()
from tmp_referenced_food_hotfix h
where f.id = h.food_id
  and f.created_at::date = date '2026-03-05'
  and f.source in ('core', 'brand')
  and coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0;

-- Post-update verification.
select
  f.id,
  f.name,
  f.calories,
  f.protein,
  f.fat,
  f.carbs,
  f.fiber,
  f.updated_at
from public.foods f
join tmp_referenced_food_hotfix h
  on h.food_id = f.id
order by f.name, f.id;

rollback;
