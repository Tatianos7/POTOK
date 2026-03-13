-- Nutrition shadow JSON manual backfill preview
-- Read-only
-- Purpose:
-- - read a manually reviewed mapping CTE
-- - validate the mapping against recipes/foods/current recipe_ingredients state
-- - show exactly what would be inserted
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
  select '72656369-7065-45f3-b137-363733353137'::uuid, 2::bigint, 'огурец'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-b137-363733353137'::uuid, 3::bigint, 'масло растительное'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-9137-363732373731'::uuid, 1::bigint, 'тунца'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-9137-363732373731'::uuid, 2::bigint, 'куриного яйца'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-9137-363733353132'::uuid, 1::bigint, 'куриной грудки'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-9137-363733353132'::uuid, 2::bigint, 'огурца'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-9137-363733353132'::uuid, 3::bigint, 'банка гороха'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-9137-363733353132'::uuid, 4::bigint, 'пучок зелени'::text, null::uuid, null::text, null::numeric, null::text
  union all
  select '72656369-7065-45f3-9137-363733353132'::uuid, 5::bigint, '% сметана'::text, null::uuid, null::text, null::numeric, null::text
),
recipe_state as (
  select
    mm.*,
    r.id as existing_recipe_id,
    r.name as existing_recipe_name,
    count(ri.id) over (partition by mm.recipe_id) as preview_placeholder
  from manual_mapping mm
  left join public.recipes r
    on r.id = mm.recipe_id
  left join public.recipe_ingredients ri
    on ri.recipe_id = mm.recipe_id
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
  r.name as recipe_name,
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
order by mm.recipe_id, mm.ingredient_position;
