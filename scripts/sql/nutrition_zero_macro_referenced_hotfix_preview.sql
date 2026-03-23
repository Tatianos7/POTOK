-- Nutrition zero-macro referenced hotfix preview
-- Read-only
-- Purpose:
-- - preview the first-response hotfix batch for referenced incident foods
-- - show current zero macros, proposed targets, source refs, and downstream refs
-- Rules:
-- - exact row set only
-- - no writes

with hotfix_batch as (
  select
    'b0d56f9f-0e79-432d-9e34-6ac1ae0e9983'::uuid as food_id,
    'Антрекот из говядины'::text as food_name,
    null::numeric as target_calories,
    null::numeric as target_protein,
    null::numeric as target_fat,
    null::numeric as target_carbs,
    null::text as authoritative_source,
    'manual_review_required_no_exact_unique_repo_match_confirmed'::text as target_status

  union all
  select
    null::uuid,
    'Бефстроганов из говядины'::text,
    null::numeric,
    null::numeric,
    null::numeric,
    null::numeric,
    null::text,
    'manual_review_required_no_exact_food_id_in_repo_context'::text

  union all
  select
    '7b2f4b6a-049e-4714-81f4-79199b47ab6b'::uuid,
    'Куриная грудка'::text,
    165::numeric,
    31.0::numeric,
    3.6::numeric,
    0.0::numeric,
    'src/data/foodsDatabaseGenerator.ts:150; src/data/foodsDatabase.ts:97; src/data/baseFoods.ts:13'::text,
    'exact_unique_repo_match_confirmed'::text

  union all
  select
    'e4dbde4f-70b6-4542-b916-0e52b82d5015'::uuid,
    'Тунец в растительном масле'::text,
    null::numeric,
    null::numeric,
    null::numeric,
    null::numeric,
    null::text,
    'manual_review_required_exact_unique_repo_match_not_confirmed'::text
),
ref_counts as (
  select
    food_id,
    count(*) as ref_count
  from (
    select canonical_food_id as food_id
    from public.food_diary_entries
    where canonical_food_id is not null

    union all

    select canonical_food_id as food_id
    from public.favorite_products
    where canonical_food_id is not null

    union all

    select food_id
    from public.recipe_ingredients
  ) refs
  group by food_id
)
select
  hb.food_name,
  hb.food_id,
  f.id as db_food_id,
  f.source,
  f.category,
  f.created_at,
  f.calories as current_calories,
  f.protein as current_protein,
  f.fat as current_fat,
  f.carbs as current_carbs,
  hb.target_calories,
  hb.target_protein,
  hb.target_fat,
  hb.target_carbs,
  hb.authoritative_source,
  hb.target_status,
  coalesce(rc.ref_count, 0) as ref_count
from hotfix_batch hb
left join public.foods f
  on (hb.food_id is not null and f.id = hb.food_id)
  or (hb.food_id is null and lower(f.name) = lower(hb.food_name) and f.created_at::date = date '2026-03-05')
left join ref_counts rc
  on rc.food_id = f.id
order by hb.food_name, f.id;

