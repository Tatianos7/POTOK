-- Nutrition zero-macro incident fix draft
-- DRAFT ONLY
-- Do not run blindly in production
-- Purpose:
-- - provide a narrow reviewed correction pattern for confirmed bad foods rows
-- - provide a controlled preview/update pattern for affected diary rows
-- Rules:
-- - exact ids only
-- - exact reviewed target macros only
-- - no category-wide or mass updates

begin;

-- =========================================================
-- SECTION A: Reviewed correction sheet temp table
-- Fill ONLY reviewed rows with exact IDs and approved target macros.
-- =========================================================
create temporary table tmp_food_zero_macro_review (
  food_id uuid primary key,
  name text not null,
  current_calories numeric(8,2) not null,
  current_protein numeric(8,2) not null,
  current_fat numeric(8,2) not null,
  current_carbs numeric(8,2) not null,
  target_calories numeric(8,2) not null,
  target_protein numeric(8,2) not null,
  target_fat numeric(8,2) not null,
  target_carbs numeric(8,2) not null,
  authoritative_source text not null,
  reviewer text not null,
  approved_at timestamptz not null
) on commit drop;

-- Example rows. Replace placeholders before any real use.
-- insert into tmp_food_zero_macro_review (
--   food_id, name,
--   current_calories, current_protein, current_fat, current_carbs,
--   target_calories, target_protein, target_fat, target_carbs,
--   authoritative_source, reviewer, approved_at
-- ) values
-- (
--   '00000000-0000-0000-0000-000000000001',
--   'Говядина',
--   0, 0, 0, 0,
--   250, 26, 15, 0,
--   'src/data/foodsDatabaseGenerator.ts:153',
--   'reviewer_name',
--   now()
-- );

-- =========================================================
-- SECTION B: Preview foods corrections
-- =========================================================
select
  f.id,
  f.name,
  f.calories as db_calories,
  f.protein as db_protein,
  f.fat as db_fat,
  f.carbs as db_carbs,
  r.target_calories,
  r.target_protein,
  r.target_fat,
  r.target_carbs,
  r.authoritative_source,
  r.reviewer,
  r.approved_at
from tmp_food_zero_macro_review r
join public.foods f
  on f.id = r.food_id
order by f.name, f.id;

-- =========================================================
-- SECTION C: Narrow foods update
-- Runs only for reviewed exact ids that are still all-zero.
-- =========================================================
update public.foods f
set
  calories = r.target_calories,
  protein = r.target_protein,
  fat = r.target_fat,
  carbs = r.target_carbs,
  suspicious = false,
  nutrition_version = coalesce(f.nutrition_version, 1) + 1,
  updated_at = now()
from tmp_food_zero_macro_review r
where f.id = r.food_id
  and coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0;

-- =========================================================
-- SECTION D: Preview affected diary rows after food correction
-- Scope:
-- - only reviewed foods ids
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
  round((f.carbs * fde.weight / 100.0)::numeric, 2) as target_carbs
from public.food_diary_entries fde
join public.foods f
  on f.id = fde.canonical_food_id
join tmp_food_zero_macro_review r
  on r.food_id = f.id
where coalesce(fde.calories, 0) = 0
  and coalesce(fde.protein, 0) = 0
  and coalesce(fde.fat, 0) = 0
  and coalesce(fde.carbs, 0) = 0
order by fde.created_at desc, fde.id;

-- =========================================================
-- SECTION E: Controlled diary update
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
-- join tmp_food_zero_macro_review r
--   on r.food_id = f.id
-- where fde.canonical_food_id = f.id
--   and coalesce(fde.calories, 0) = 0
--   and coalesce(fde.protein, 0) = 0
--   and coalesce(fde.fat, 0) = 0
--   and coalesce(fde.carbs, 0) = 0;

rollback;
