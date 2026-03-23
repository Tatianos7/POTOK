-- Nutrition zero-macro restoration autofix draft
-- DRAFT ONLY
-- Do not run blindly in production
-- Purpose:
-- - restore exact unique repo-match zero-macro foods rows from the 2026-03-05 incident
-- - keep ambiguous rows out of the autofix batch
-- - prepare incident-scoped diary remediation only for corrected food ids
-- Rules:
-- - exact ids only
-- - exact unique repo match only
-- - target macros must be valid and non-zero
-- - no broad category update
-- - no blanket diary recompute

begin;

-- =========================================================
-- SECTION A: Exact unique repo-match batch
-- Fill ONLY rows that satisfy all of the following:
-- - food row is still all-zero in public.foods
-- - food row is in the 2026-03-05 incident scope
-- - exact name match to a repo nutrition source
-- - unique match only across the selected repo source set
-- - approved for autofix
-- =========================================================
create temporary table tmp_food_zero_macro_repo_autofix (
  food_id uuid primary key,
  food_name text not null,
  repo_source text not null,
  repo_match_name text not null,
  target_calories numeric(8,2) not null,
  target_protein numeric(8,2) not null,
  target_fat numeric(8,2) not null,
  target_carbs numeric(8,2) not null,
  target_fiber numeric(8,2),
  reviewer text not null,
  approved_at timestamptz not null
) on commit drop;

-- Example only. Replace placeholders before any real use.
-- insert into tmp_food_zero_macro_repo_autofix (
--   food_id,
--   food_name,
--   repo_source,
--   repo_match_name,
--   target_calories,
--   target_protein,
--   target_fat,
--   target_carbs,
--   target_fiber,
--   reviewer,
--   approved_at
-- ) values
-- (
--   '00000000-0000-0000-0000-000000000001',
--   'Говядина',
--   'src/data/foodsDatabase.ts',
--   'Говядина',
--   250,
--   26,
--   15,
--   0,
--   null,
--   'reviewer_name',
--   now()
-- );

-- =========================================================
-- SECTION B: Preview exact unique repo-match autofix rows
-- =========================================================
select
  f.id,
  f.name,
  f.brand,
  f.source,
  f.category,
  f.created_at,
  f.calories as current_calories,
  f.protein as current_protein,
  f.fat as current_fat,
  f.carbs as current_carbs,
  a.repo_source,
  a.repo_match_name,
  a.target_calories,
  a.target_protein,
  a.target_fat,
  a.target_carbs,
  a.target_fiber,
  a.reviewer,
  a.approved_at
from tmp_food_zero_macro_repo_autofix a
join public.foods f
  on f.id = a.food_id
order by f.name, f.id;

-- =========================================================
-- SECTION C: Narrow foods autofix
-- Guards:
-- - exact reviewed ids only
-- - incident date only
-- - catalog rows only
-- - row must still be all-zero at execution time
-- =========================================================
update public.foods f
set
  calories = a.target_calories,
  protein = a.target_protein,
  fat = a.target_fat,
  carbs = a.target_carbs,
  fiber = coalesce(a.target_fiber, f.fiber),
  suspicious = false,
  nutrition_version = coalesce(f.nutrition_version, 1) + 1,
  updated_at = now()
from tmp_food_zero_macro_repo_autofix a
where f.id = a.food_id
  and f.created_at::date = date '2026-03-05'
  and f.source in ('core', 'brand')
  and coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0;

-- =========================================================
-- SECTION D: Post-update verification for foods
-- =========================================================
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
join tmp_food_zero_macro_repo_autofix a
  on a.food_id = f.id
order by f.name, f.id;

-- =========================================================
-- SECTION E: Preview affected diary rows for corrected food ids
-- Scope:
-- - only rows tied to corrected food ids
-- - only rows whose stored snapshot is all-zero
-- =========================================================
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
join public.foods f
  on f.id = fde.canonical_food_id
join tmp_food_zero_macro_repo_autofix a
  on a.food_id = f.id
where coalesce(fde.calories, 0) = 0
  and coalesce(fde.protein, 0) = 0
  and coalesce(fde.fat, 0) = 0
  and coalesce(fde.carbs, 0) = 0
order by fde.created_at desc, fde.id;

-- =========================================================
-- SECTION F: Controlled diary remediation draft
-- Use only after preview review and explicit approval.
-- =========================================================
-- update public.food_diary_entries fde
-- set
--   calories = round((f.calories * fde.weight / 100.0)::numeric, 2),
--   protein = round((f.protein * fde.weight / 100.0)::numeric, 2),
--   fat = round((f.fat * fde.weight / 100.0)::numeric, 2),
--   carbs = round((f.carbs * fde.weight / 100.0)::numeric, 2),
--   fiber = round((coalesce(f.fiber, 0) * fde.weight / 100.0)::numeric, 2)
-- from public.foods f
-- join tmp_food_zero_macro_repo_autofix a
--   on a.food_id = f.id
-- where fde.canonical_food_id = f.id
--   and coalesce(fde.calories, 0) = 0
--   and coalesce(fde.protein, 0) = 0
--   and coalesce(fde.fat, 0) = 0
--   and coalesce(fde.carbs, 0) = 0;

rollback;
