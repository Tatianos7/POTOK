-- Nutrition shadow JSON manual mapping template
-- Read-only template
-- Purpose:
-- - provide an operator-editable CTE shape for reviewed mappings
-- - no writes are performed by this script

with manual_mapping as (
  select
    '72656369-7065-45f3-b137-363733353137'::uuid as recipe_id,
    1::bigint as ingredient_position,
    'помидора'::text as raw_ingredient_name,
    null::uuid as chosen_food_id,
    null::text as chosen_food_name,
    null::numeric as chosen_amount_g,
    null::text as mapping_note

  union all
  select
    '72656369-7065-45f3-b137-363733353137'::uuid,
    2::bigint,
    'огурец'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-b137-363733353137'::uuid,
    3::bigint,
    'масло растительное'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-9137-363732373731'::uuid,
    1::bigint,
    'тунца'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-9137-363732373731'::uuid,
    2::bigint,
    'куриного яйца'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    1::bigint,
    'куриной грудки'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    2::bigint,
    'огурца'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    3::bigint,
    'банка гороха'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    4::bigint,
    'пучок зелени'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    5::bigint,
    '% сметана'::text,
    null::uuid,
    null::text,
    null::numeric,
    null::text
)
select *
from manual_mapping
order by recipe_id, ingredient_position;
