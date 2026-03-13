-- Runtime smoke: recipe_ingredients ownership + recompute_recipe_totals
-- Run as postgres in Supabase SQL Editor
-- Replace CONFIG UUIDs with real user ids from auth.users

begin;

-- CONFIG
create temp table _cfg (
  a_uuid uuid not null,
  b_uuid uuid not null
) on commit drop;

insert into _cfg(a_uuid, b_uuid)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);

create temp table _smoke (
  metric text primary key,
  value text
) on commit drop;

do $$
declare
  v_a uuid;
  v_b uuid;
  v_recipe_id uuid;
  v_food_1 uuid;
  v_food_2 uuid;
  v_count int;
  v_total_calories numeric;
  v_total_protein numeric;
  v_err text;
  r_a_ingredient_rows text;
  r_a_totals_gt_zero text;
  r_b_sees_a_ingredients text;
  r_b_recompute_a_recipe_blocked text;
  r_b_recompute_error text;
begin
  select a_uuid, b_uuid into v_a, v_b from _cfg;

  select f.id into v_food_1
  from public.foods f
  where f.source in ('core', 'brand')
  order by f.created_at desc
  limit 1;

  select f.id into v_food_2
  from public.foods f
  where f.source in ('core', 'brand')
    and f.id <> v_food_1
  order by f.created_at desc
  limit 1;

  if v_food_1 is null or v_food_2 is null then
    raise exception 'Need at least two catalog foods for smoke test';
  end if;

  -- User A creates recipe, ingredients and recomputes totals
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  insert into public.recipes (user_id, name, ingredients, total_calories, protein, fat, carbs)
  values (v_a, '__smoke_recipe__', '[]'::jsonb, 0, 0, 0, 0)
  returning id into v_recipe_id;

  insert into public.recipe_ingredients (recipe_id, food_id, amount_g)
  values
    (v_recipe_id, v_food_1, 120),
    (v_recipe_id, v_food_2, 80);

  perform public.recompute_recipe_totals(v_recipe_id);

  select count(*) into v_count
  from public.recipe_ingredients
  where recipe_id = v_recipe_id;

  r_a_ingredient_rows := v_count::text;

  select total_calories, protein
  into v_total_calories, v_total_protein
  from public.recipes
  where id = v_recipe_id;

  r_a_totals_gt_zero := case when coalesce(v_total_calories, 0) > 0 and coalesce(v_total_protein, 0) > 0 then 'true' else 'false' end;

  execute 'reset role';

  -- User B cannot see A ingredients and cannot recompute A recipe
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  select count(*) into v_count
  from public.recipe_ingredients
  where recipe_id = v_recipe_id;

  r_b_sees_a_ingredients := v_count::text;

  begin
    perform public.recompute_recipe_totals(v_recipe_id);
    r_b_recompute_a_recipe_blocked := 'false';
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    r_b_recompute_a_recipe_blocked := 'true';
    r_b_recompute_error := coalesce(left(v_err, 180), 'unknown_error');
  end;

  execute 'reset role';

  insert into _smoke(metric, value) values ('a_ingredient_rows', r_a_ingredient_rows);
  insert into _smoke(metric, value) values ('a_totals_gt_zero', r_a_totals_gt_zero);
  insert into _smoke(metric, value) values ('b_sees_a_ingredients', r_b_sees_a_ingredients);
  insert into _smoke(metric, value) values ('b_recompute_a_recipe_blocked', r_b_recompute_a_recipe_blocked);
  if r_b_recompute_error is not null then
    insert into _smoke(metric, value) values ('b_recompute_error', r_b_recompute_error);
  end if;
end $$;

select * from _smoke order by metric;

rollback;
