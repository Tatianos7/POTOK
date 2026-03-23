-- Nutrition zero-macro referenced diary remediation draft
-- DRAFT ONLY
-- Do not run blindly in production
-- Purpose:
-- - remediate diary rows corrupted by referenced incident foods after the foods hotfix
-- Rules:
-- - exact corrected food ids only
-- - only rows whose stored snapshot is all-zero
-- - no blanket diary recompute

begin;

create temporary table tmp_corrected_food_ids (
  food_id uuid primary key
) on commit drop;

-- Fill only the exact ids that were actually corrected in the foods hotfix batch.
-- Example:
-- insert into tmp_corrected_food_ids (food_id) values
--   ('7b2f4b6a-049e-4714-81f4-79199b47ab6b');

-- Preview the rows that would be updated.
select
  fde.id,
  fde.user_id,
  fde.date,
  fde.meal_type,
  fde.canonical_food_id,
  f.name as canonical_food_name,
  fde.weight,
  fde.calories as current_calories,
  round((f.calories * fde.weight / 100.0)::numeric, 2) as target_calories,
  fde.protein as current_protein,
  round((f.protein * fde.weight / 100.0)::numeric, 2) as target_protein,
  fde.fat as current_fat,
  round((f.fat * fde.weight / 100.0)::numeric, 2) as target_fat,
  fde.carbs as current_carbs,
  round((f.carbs * fde.weight / 100.0)::numeric, 2) as target_carbs
from public.food_diary_entries fde
join tmp_corrected_food_ids c
  on c.food_id = fde.canonical_food_id
join public.foods f
  on f.id = fde.canonical_food_id
where coalesce(fde.calories, 0) = 0
  and coalesce(fde.protein, 0) = 0
  and coalesce(fde.fat, 0) = 0
  and coalesce(fde.carbs, 0) = 0
order by fde.created_at desc, fde.id;

-- Controlled update.
-- Uncomment only after preview review and explicit approval.
-- update public.food_diary_entries fde
-- set
--   calories = round((f.calories * fde.weight / 100.0)::numeric, 2),
--   protein = round((f.protein * fde.weight / 100.0)::numeric, 2),
--   fat = round((f.fat * fde.weight / 100.0)::numeric, 2),
--   carbs = round((f.carbs * fde.weight / 100.0)::numeric, 2),
--   fiber = round((coalesce(f.fiber, 0) * fde.weight / 100.0)::numeric, 2)
-- from public.foods f
-- join tmp_corrected_food_ids c
--   on c.food_id = f.id
-- where fde.canonical_food_id = f.id
--   and coalesce(fde.calories, 0) = 0
--   and coalesce(fde.protein, 0) = 0
--   and coalesce(fde.fat, 0) = 0
--   and coalesce(fde.carbs, 0) = 0;

rollback;
