-- Nutrition shadow JSON operator fill template
-- Read-only template
-- Purpose:
-- - provide an updated editable manual_mapping CTE
-- - preserve already confirmed rows
-- - leave ambiguous rows for operator completion

with manual_mapping as (
  select
    '72656369-7065-45f3-b137-363733353137'::uuid as recipe_id,
    'Салат Весна'::text as recipe_name,
    1::bigint as ingredient_position,
    'помидора'::text as raw_ingredient_name,
    null::uuid as chosen_food_id,
    null::text as chosen_food_name,
    null::numeric as chosen_amount_g,
    'operator_choice_required'::text as mapping_note

  union all
  select
    '72656369-7065-45f3-b137-363733353137'::uuid,
    'Салат Весна'::text,
    2::bigint,
    'огурец'::text,
    null::uuid,
    null::text,
    null::numeric,
    'operator_choice_required'::text

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
    'confirmed_safe_match_amount_in_grams'::text

  union all
  select
    '72656369-7065-45f3-9137-363732373731'::uuid,
    'Салат Мемоза 2'::text,
    2::bigint,
    'куриного яйца'::text,
    'f4022e2a-9cf3-42c2-8a1c-6c873c866524'::uuid,
    'яйцо куриное'::text,
    null::numeric,
    'food_confirmed_grams_require_operator_decision'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    1::bigint,
    'куриной грудки'::text,
    '7b2f4b6a-049e-4714-81f4-79199b47ab6b'::uuid,
    'Куриная грудка'::text,
    100::numeric,
    'confirmed_safe_match_amount_in_grams'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    2::bigint,
    'огурца'::text,
    null::uuid,
    null::text,
    null::numeric,
    'operator_choice_required'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    3::bigint,
    'банка гороха'::text,
    null::uuid,
    null::text,
    null::numeric,
    'operator_choice_required'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    4::bigint,
    'пучок зелени'::text,
    null::uuid,
    null::text,
    null::numeric,
    'operator_choice_required'::text

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
)
select *
from manual_mapping
order by recipe_name, ingredient_position;
