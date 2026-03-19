-- Nutrition zero-macro referenced diary remediation preview
-- Read-only
-- Purpose:
-- - preview affected diary rows tied to corrected incident food ids
-- - show current all-zero snapshot and recomputed target snapshot
-- Rules:
-- - exact corrected food ids only
-- - only rows whose stored snapshot is all-zero
-- - no writes

with corrected_food_ids as (
  -- Replace with the exact ids that were actually corrected in the foods hotfix batch.
  select '7b2f4b6a-049e-4714-81f4-79199b47ab6b'::uuid as food_id
)
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
  round((f.carbs * fde.weight / 100.0)::numeric, 2) as target_carbs,
  fde.fiber as current_fiber,
  round((coalesce(f.fiber, 0) * fde.weight / 100.0)::numeric, 2) as target_fiber,
  fde.created_at
from public.food_diary_entries fde
join corrected_food_ids c
  on c.food_id = fde.canonical_food_id
join public.foods f
  on f.id = fde.canonical_food_id
where coalesce(fde.calories, 0) = 0
  and coalesce(fde.protein, 0) = 0
  and coalesce(fde.fat, 0) = 0
  and coalesce(fde.carbs, 0) = 0
order by fde.created_at desc, fde.id;

