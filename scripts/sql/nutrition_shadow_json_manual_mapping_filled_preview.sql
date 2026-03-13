-- Nutrition shadow JSON manual mapping filled preview
-- Read-only
-- Purpose:
-- - provide a partially filled operator-reviewed mapping CTE
-- - prefill only rows with an obvious safe food choice
-- - keep ambiguous food choices and non-gram semantics unresolved
-- - no writes are performed by this script

with manual_mapping as (
  select
    '72656369-7065-45f3-b137-363733353137'::uuid as recipe_id,
    'Салат Весна'::text as recipe_name,
    1::bigint as ingredient_position,
    'помидора'::text as raw_ingredient_name,
    null::uuid as chosen_food_id,
    null::text as chosen_food_name,
    360::numeric as chosen_amount_g,
    'operator_choice_required_amount_defaulted_3x120g'::text as mapping_note

  union all
  select
    '72656369-7065-45f3-b137-363733353137'::uuid,
    'Салат Весна'::text,
    2::bigint,
    'огурец'::text,
    null::uuid,
    null::text,
    200::numeric,
    'operator_choice_required_amount_defaulted_2x100g'::text

  union all
  select
    '72656369-7065-45f3-b137-363733353137'::uuid,
    'Салат Весна'::text,
    3::bigint,
    'масло растительное'::text,
    null::uuid,
    null::text,
    10::numeric,
    'operator_choice_required'::text

  union all
  select
    '72656369-7065-45f3-9137-363732373731'::uuid,
    'Салат Мемоза 2'::text,
    1::bigint,
    'тунца'::text,
    'e4dbde4f-70b6-4542-b916-0e52b82d5015'::uuid,
    'Тунец в растительном масле'::text,
    250::numeric,
    'safe_food_match_raw_amount_used_as_grams'::text

  union all
  select
    '72656369-7065-45f3-9137-363732373731'::uuid,
    'Салат Мемоза 2'::text,
    2::bigint,
    'куриного яйца'::text,
    'f4022e2a-9cf3-42c2-8a1c-6c873c866524'::uuid,
    'яйцо куриное'::text,
    150::numeric,
    'food_confirmed_amount_defaulted_3x50g'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    1::bigint,
    'куриной грудки'::text,
    '7b2f4b6a-049e-4714-81f4-79199b47ab6b'::uuid,
    'Куриная грудка'::text,
    100::numeric,
    'safe_food_match_raw_amount_used_as_grams'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    2::bigint,
    'огурца'::text,
    null::uuid,
    null::text,
    200::numeric,
    'operator_choice_required_amount_defaulted_2x100g'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    3::bigint,
    'банка гороха'::text,
    null::uuid,
    null::text,
    240::numeric,
    'operator_choice_required_amount_defaulted_1x240g_can_contents'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    4::bigint,
    'пучок зелени'::text,
    null::uuid,
    null::text,
    30::numeric,
    'operator_choice_required_amount_defaulted_1x30g_bundle'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    5::bigint,
    '% сметана'::text,
    null::uuid,
    null::text,
    10::numeric,
    'operator_choice_required'::text
),
recipe_counts as (
  select
    mm.recipe_id,
    count(ri.id) as existing_ingredient_rows
  from manual_mapping mm
  left join public.recipe_ingredients ri
    on ri.recipe_id = mm.recipe_id
  group by mm.recipe_id
)
select
  mm.recipe_id,
  mm.recipe_name,
  mm.ingredient_position,
  mm.raw_ingredient_name,
  mm.chosen_food_id,
  mm.chosen_food_name,
  mm.chosen_amount_g,
  f.name as existing_food_name,
  mm.mapping_note,
  case
    when r.id is null then 'missing_recipe'
    when coalesce(rc.existing_ingredient_rows, 0) > 0 then 'recipe_already_has_ingredients'
    when mm.chosen_food_id is null then 'missing_food_choice'
    when f.id is null then 'missing_food'
    when mm.chosen_amount_g is null or mm.chosen_amount_g <= 0 then 'invalid_amount_g'
    else 'ready_for_manual_backfill'
  end as preview_status
from manual_mapping mm
left join public.recipes r
  on r.id = mm.recipe_id
left join recipe_counts rc
  on rc.recipe_id = mm.recipe_id
left join public.foods f
  on f.id = mm.chosen_food_id
order by mm.recipe_name, mm.ingredient_position;
