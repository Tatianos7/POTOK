-- POTOK Premium minimal staging seed draft
-- DRAFT ONLY. Staging-only. Do not apply without explicit owner approval.
--
-- Staging target:
-- - ozidryfvhkcbtpnulakq
--
-- Production exclusion:
-- - do not run against dtsdnhbcwpbfrhcazqkb
--
-- Purpose:
-- - seed a tiny test Premium catalog for staging smoke/RLS validation
-- - keep all rows clearly marked with staging_seed_* titles/labels
-- - avoid production-like final catalog naming
--
-- Safety:
-- - does not create user Premium selections
-- - does not write diary/workout rows
-- - does not write public.recipes
-- - does not write public.recipe_ingredients
-- - does not write public.food_diary_entries
-- - does not create shopping source-of-truth rows
-- - does not create AI/runtime rows

begin;

do $$
declare
  v_plan_id uuid;
  v_day1_id uuid;
  v_day2_id uuid;
  v_breakfast1_slot_id uuid;
  v_lunch1_slot_id uuid;
  v_dinner1_slot_id uuid;
  v_snack1_slot_id uuid;
  v_breakfast2_slot_id uuid;
  v_lunch2_slot_id uuid;
  v_dinner2_slot_id uuid;
  v_snack2_slot_id uuid;
  v_oats_id uuid;
  v_eggs_id uuid;
  v_chicken_bowl_id uuid;
  v_turkey_wrap_id uuid;
  v_salmon_id uuid;
  v_yogurt_id uuid;
begin
  select id into v_plan_id
  from public.premium_plans
  where title = 'staging_seed_weight_loss_14_day_test_plan'
  limit 1;

  if v_plan_id is null then
    insert into public.premium_plans (
      title,
      subtitle,
      goal_type,
      duration_days,
      difficulty,
      is_active
    ) values (
      'staging_seed_weight_loss_14_day_test_plan',
      'Staging-only minimal Premium catalog seed',
      'weight_loss',
      14,
      'staging_test',
      true
    )
    returning id into v_plan_id;
  end if;

  select id into v_day1_id
  from public.premium_plan_days
  where premium_plan_id = v_plan_id
    and day_number = 1;

  if v_day1_id is null then
    insert into public.premium_plan_days (
      premium_plan_id,
      day_number,
      calories,
      protein,
      fat,
      carbs,
      workout_title,
      workout_duration_min,
      workout_focus
    ) values (
      v_plan_id,
      1,
      1850,
      135,
      58,
      190,
      'staging_seed_light_walk',
      30,
      'recovery'
    )
    returning id into v_day1_id;
  end if;

  select id into v_day2_id
  from public.premium_plan_days
  where premium_plan_id = v_plan_id
    and day_number = 2;

  if v_day2_id is null then
    insert into public.premium_plan_days (
      premium_plan_id,
      day_number,
      calories,
      protein,
      fat,
      carbs,
      workout_title,
      workout_duration_min,
      workout_focus
    ) values (
      v_plan_id,
      2,
      1900,
      140,
      60,
      195,
      'staging_seed_mobility',
      25,
      'mobility'
    )
    returning id into v_day2_id;
  end if;

  select id into v_oats_id
  from public.premium_recipes
  where title = 'staging_seed_protein_oats'
  limit 1;

  if v_oats_id is null then
    insert into public.premium_recipes (
      title,
      category,
      calories,
      protein,
      fat,
      carbs,
      cooking_time_min,
      difficulty_label,
      is_active
    ) values (
      'staging_seed_protein_oats',
      'breakfast',
      410,
      31,
      10,
      52,
      10,
      'staging_test_easy',
      true
    )
    returning id into v_oats_id;
  end if;

  select id into v_eggs_id
  from public.premium_recipes
  where title = 'staging_seed_egg_plate'
  limit 1;

  if v_eggs_id is null then
    insert into public.premium_recipes (
      title,
      category,
      calories,
      protein,
      fat,
      carbs,
      cooking_time_min,
      difficulty_label,
      is_active
    ) values (
      'staging_seed_egg_plate',
      'breakfast',
      390,
      29,
      18,
      28,
      12,
      'staging_test_easy',
      true
    )
    returning id into v_eggs_id;
  end if;

  select id into v_chicken_bowl_id
  from public.premium_recipes
  where title = 'staging_seed_chicken_bowl'
  limit 1;

  if v_chicken_bowl_id is null then
    insert into public.premium_recipes (
      title,
      category,
      calories,
      protein,
      fat,
      carbs,
      cooking_time_min,
      difficulty_label,
      is_active
    ) values (
      'staging_seed_chicken_bowl',
      'lunch',
      560,
      45,
      16,
      58,
      25,
      'staging_test_medium',
      true
    )
    returning id into v_chicken_bowl_id;
  end if;

  select id into v_turkey_wrap_id
  from public.premium_recipes
  where title = 'staging_seed_turkey_wrap'
  limit 1;

  if v_turkey_wrap_id is null then
    insert into public.premium_recipes (
      title,
      category,
      calories,
      protein,
      fat,
      carbs,
      cooking_time_min,
      difficulty_label,
      is_active
    ) values (
      'staging_seed_turkey_wrap',
      'lunch',
      520,
      39,
      17,
      50,
      15,
      'staging_test_easy',
      true
    )
    returning id into v_turkey_wrap_id;
  end if;

  select id into v_salmon_id
  from public.premium_recipes
  where title = 'staging_seed_salmon_plate'
  limit 1;

  if v_salmon_id is null then
    insert into public.premium_recipes (
      title,
      category,
      calories,
      protein,
      fat,
      carbs,
      cooking_time_min,
      difficulty_label,
      is_active
    ) values (
      'staging_seed_salmon_plate',
      'dinner',
      610,
      43,
      24,
      48,
      30,
      'staging_test_medium',
      true
    )
    returning id into v_salmon_id;
  end if;

  select id into v_yogurt_id
  from public.premium_recipes
  where title = 'staging_seed_yogurt_berries'
  limit 1;

  if v_yogurt_id is null then
    insert into public.premium_recipes (
      title,
      category,
      calories,
      protein,
      fat,
      carbs,
      cooking_time_min,
      difficulty_label,
      is_active
    ) values (
      'staging_seed_yogurt_berries',
      'snack',
      260,
      24,
      6,
      28,
      5,
      'staging_test_no_cook',
      true
    )
    returning id into v_yogurt_id;
  end if;

  insert into public.premium_recipe_ingredients (
    premium_recipe_id,
    ingredient_name,
    amount_g,
    display_amount,
    sort_order
  )
  select *
  from (
    values
      (v_oats_id, 'staging_seed_oats', 45::numeric, 'half cup oats', 1),
      (v_oats_id, 'staging_seed_protein_powder', 25::numeric, 'one scoop', 2),
      (v_oats_id, 'staging_seed_banana', 80::numeric, 'one small banana', 3),
      (v_eggs_id, 'staging_seed_eggs', 110::numeric, 'two eggs', 1),
      (v_eggs_id, 'staging_seed_wholegrain_toast', 40::numeric, 'one slice', 2),
      (v_eggs_id, 'staging_seed_tomato', 100::numeric, 'one tomato', 3),
      (v_chicken_bowl_id, 'staging_seed_chicken_breast', 150::numeric, 'one palm portion', 1),
      (v_chicken_bowl_id, 'staging_seed_rice', 130::numeric, 'one fist cooked rice', 2),
      (v_chicken_bowl_id, 'staging_seed_cucumber', 100::numeric, 'one handful cucumber', 3),
      (v_turkey_wrap_id, 'staging_seed_turkey', 120::numeric, 'one palm portion', 1),
      (v_turkey_wrap_id, 'staging_seed_wrap', 65::numeric, 'one wrap', 2),
      (v_turkey_wrap_id, 'staging_seed_lettuce', 40::numeric, 'two handfuls lettuce', 3),
      (v_salmon_id, 'staging_seed_salmon', 150::numeric, 'one palm portion', 1),
      (v_salmon_id, 'staging_seed_potato', 180::numeric, 'one medium potato', 2),
      (v_salmon_id, 'staging_seed_green_beans', 120::numeric, 'two handfuls beans', 3),
      (v_yogurt_id, 'staging_seed_greek_yogurt', 180::numeric, 'one small bowl', 1),
      (v_yogurt_id, 'staging_seed_berries', 90::numeric, 'one handful berries', 2),
      (v_yogurt_id, 'staging_seed_honey', 10::numeric, 'one teaspoon', 3)
  ) as v(recipe_id, ingredient_name, amount_g, display_amount, sort_order)
  where not exists (
    select 1
    from public.premium_recipe_ingredients pri
    where pri.premium_recipe_id = v.recipe_id
      and pri.ingredient_name = v.ingredient_name
  );

  insert into public.premium_recipe_steps (
    premium_recipe_id,
    step_number,
    instruction
  )
  select *
  from (
    values
      (v_oats_id, 1, 'Mix oats with hot water or milk until soft.'),
      (v_oats_id, 2, 'Stir in protein powder and top with banana.'),
      (v_eggs_id, 1, 'Cook eggs to preference.'),
      (v_eggs_id, 2, 'Serve with toast and tomato.'),
      (v_chicken_bowl_id, 1, 'Warm cooked rice and sliced chicken.'),
      (v_chicken_bowl_id, 2, 'Add cucumber and serve as a bowl.'),
      (v_turkey_wrap_id, 1, 'Layer turkey and lettuce in the wrap.'),
      (v_turkey_wrap_id, 2, 'Roll tightly and slice in half.'),
      (v_salmon_id, 1, 'Bake or pan-cook salmon until done.'),
      (v_salmon_id, 2, 'Serve with potato and green beans.'),
      (v_yogurt_id, 1, 'Spoon yogurt into a bowl.'),
      (v_yogurt_id, 2, 'Top with berries and honey.')
  ) as v(recipe_id, step_number, instruction)
  where not exists (
    select 1
    from public.premium_recipe_steps prs
    where prs.premium_recipe_id = v.recipe_id
      and prs.step_number = v.step_number
  );

  insert into public.premium_recipe_hints (
    premium_recipe_id,
    hint_text,
    sort_order
  )
  select *
  from (
    values
      (v_oats_id, 'No scale: use one small bowl of oats and one scoop protein.', 1),
      (v_eggs_id, 'No scale: two eggs plus one slice toast is enough.', 1),
      (v_chicken_bowl_id, 'No scale: chicken is one palm, rice is one fist.', 1),
      (v_turkey_wrap_id, 'No scale: one wrap with one palm of turkey.', 1),
      (v_salmon_id, 'No scale: salmon is one palm, potato is one fist.', 1),
      (v_yogurt_id, 'No scale: yogurt is one small bowl, berries one handful.', 1)
  ) as v(recipe_id, hint_text, sort_order)
  where not exists (
    select 1
    from public.premium_recipe_hints prh
    where prh.premium_recipe_id = v.recipe_id
      and prh.hint_text = v.hint_text
  );

  insert into public.premium_meal_slots (
    premium_plan_day_id,
    meal_type,
    title,
    calories,
    protein,
    fat,
    carbs,
    sort_order
  )
  select *
  from (
    values
      (v_day1_id, 'breakfast', 'staging_seed_day1_breakfast', 410, 31, 10, 52, 1),
      (v_day1_id, 'lunch', 'staging_seed_day1_lunch', 560, 45, 16, 58, 2),
      (v_day1_id, 'dinner', 'staging_seed_day1_dinner', 610, 43, 24, 48, 3),
      (v_day1_id, 'snack', 'staging_seed_day1_snack', 260, 24, 6, 28, 4),
      (v_day2_id, 'breakfast', 'staging_seed_day2_breakfast', 390, 29, 18, 28, 1),
      (v_day2_id, 'lunch', 'staging_seed_day2_lunch', 520, 39, 17, 50, 2),
      (v_day2_id, 'dinner', 'staging_seed_day2_dinner', 610, 43, 24, 48, 3),
      (v_day2_id, 'snack', 'staging_seed_day2_snack', 260, 24, 6, 28, 4)
  ) as v(day_id, meal_type, title, calories, protein, fat, carbs, sort_order)
  where not exists (
    select 1
    from public.premium_meal_slots pms
    where pms.premium_plan_day_id = v.day_id
      and pms.sort_order = v.sort_order
  );

  select id into v_breakfast1_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day1_id
    and sort_order = 1;

  select id into v_lunch1_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day1_id
    and sort_order = 2;

  select id into v_dinner1_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day1_id
    and sort_order = 3;

  select id into v_snack1_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day1_id
    and sort_order = 4;

  select id into v_breakfast2_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day2_id
    and sort_order = 1;

  select id into v_lunch2_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day2_id
    and sort_order = 2;

  select id into v_dinner2_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day2_id
    and sort_order = 3;

  select id into v_snack2_slot_id
  from public.premium_meal_slots
  where premium_plan_day_id = v_day2_id
    and sort_order = 4;

  insert into public.premium_meal_recipe_options (
    premium_meal_slot_id,
    premium_recipe_id,
    option_type,
    label,
    sort_order
  )
  select *
  from (
    values
      (v_breakfast1_slot_id, v_oats_id, 'primary', 'staging_seed_primary', 1),
      (v_breakfast1_slot_id, v_eggs_id, 'replacement', 'staging_seed_replacement', 2),
      (v_lunch1_slot_id, v_chicken_bowl_id, 'primary', 'staging_seed_primary', 1),
      (v_lunch1_slot_id, v_turkey_wrap_id, 'replacement', 'staging_seed_replacement', 2),
      (v_dinner1_slot_id, v_salmon_id, 'primary', 'staging_seed_primary', 1),
      (v_dinner1_slot_id, v_chicken_bowl_id, 'replacement', 'staging_seed_replacement', 2),
      (v_snack1_slot_id, v_yogurt_id, 'primary', 'staging_seed_primary', 1),
      (v_snack1_slot_id, v_oats_id, 'replacement', 'staging_seed_replacement', 2),
      (v_breakfast2_slot_id, v_eggs_id, 'primary', 'staging_seed_primary', 1),
      (v_breakfast2_slot_id, v_oats_id, 'replacement', 'staging_seed_replacement', 2),
      (v_lunch2_slot_id, v_turkey_wrap_id, 'primary', 'staging_seed_primary', 1),
      (v_lunch2_slot_id, v_chicken_bowl_id, 'replacement', 'staging_seed_replacement', 2),
      (v_dinner2_slot_id, v_salmon_id, 'primary', 'staging_seed_primary', 1),
      (v_dinner2_slot_id, v_turkey_wrap_id, 'replacement', 'staging_seed_replacement', 2),
      (v_snack2_slot_id, v_yogurt_id, 'primary', 'staging_seed_primary', 1),
      (v_snack2_slot_id, v_eggs_id, 'replacement', 'staging_seed_replacement', 2)
  ) as v(slot_id, recipe_id, option_type, label, sort_order)
  where not exists (
    select 1
    from public.premium_meal_recipe_options pmro
    where pmro.premium_meal_slot_id = v.slot_id
      and pmro.premium_recipe_id = v.recipe_id
  );
end $$;

-- ============================================================
-- Suggested validation SQL after owner-approved staging apply
-- ============================================================
--
-- select 'premium_plans' as table_name, count(*)::bigint as row_count
-- from public.premium_plans
-- where title like 'staging_seed_%'
-- union all
-- select 'premium_plan_days', count(*)::bigint
-- from public.premium_plan_days ppd
-- join public.premium_plans pp on pp.id = ppd.premium_plan_id
-- where pp.title like 'staging_seed_%'
-- union all
-- select 'premium_meal_slots', count(*)::bigint
-- from public.premium_meal_slots pms
-- join public.premium_plan_days ppd on ppd.id = pms.premium_plan_day_id
-- join public.premium_plans pp on pp.id = ppd.premium_plan_id
-- where pp.title like 'staging_seed_%'
-- union all
-- select 'premium_recipes', count(*)::bigint
-- from public.premium_recipes
-- where title like 'staging_seed_%'
-- union all
-- select 'premium_recipe_ingredients', count(*)::bigint
-- from public.premium_recipe_ingredients pri
-- join public.premium_recipes pr on pr.id = pri.premium_recipe_id
-- where pr.title like 'staging_seed_%'
-- union all
-- select 'premium_recipe_steps', count(*)::bigint
-- from public.premium_recipe_steps prs
-- join public.premium_recipes pr on pr.id = prs.premium_recipe_id
-- where pr.title like 'staging_seed_%'
-- union all
-- select 'premium_recipe_hints', count(*)::bigint
-- from public.premium_recipe_hints prh
-- join public.premium_recipes pr on pr.id = prh.premium_recipe_id
-- where pr.title like 'staging_seed_%'
-- union all
-- select 'premium_meal_recipe_options', count(*)::bigint
-- from public.premium_meal_recipe_options pmro
-- join public.premium_meal_slots pms on pms.id = pmro.premium_meal_slot_id
-- join public.premium_plan_days ppd on ppd.id = pms.premium_plan_day_id
-- join public.premium_plans pp on pp.id = ppd.premium_plan_id
-- where pp.title like 'staging_seed_%'
-- order by table_name;
--
-- select title, duration_days, goal_type, is_active
-- from public.premium_plans
-- where title = 'staging_seed_weight_loss_14_day_test_plan';
--
-- select pp.title, pp.duration_days, count(ppd.id) as seeded_days
-- from public.premium_plans pp
-- left join public.premium_plan_days ppd on ppd.premium_plan_id = pp.id
-- where pp.title = 'staging_seed_weight_loss_14_day_test_plan'
-- group by pp.title, pp.duration_days;
--
-- select meal_type, count(*) as slot_count
-- from public.premium_meal_slots pms
-- join public.premium_plan_days ppd on ppd.id = pms.premium_plan_day_id
-- join public.premium_plans pp on pp.id = ppd.premium_plan_id
-- where pp.title = 'staging_seed_weight_loss_14_day_test_plan'
-- group by meal_type
-- order by meal_type;
--
-- select 'user_premium_plan_selections' as table_name, count(*)::bigint as row_count
-- from public.user_premium_plan_selections
-- union all
-- select 'user_premium_meal_selections', count(*)::bigint
-- from public.user_premium_meal_selections;
--
-- select 'public.recipes' as table_name, count(*)::bigint as row_count
-- from public.recipes
-- union all
-- select 'public.recipe_ingredients', count(*)::bigint
-- from public.recipe_ingredients
-- union all
-- select 'public.food_diary_entries', count(*)::bigint
-- from public.food_diary_entries;

-- ============================================================
-- Suggested cleanup SQL after owner-approved staging seed cleanup
-- ============================================================
--
-- begin;
--
-- delete from public.premium_meal_recipe_options
-- where premium_meal_slot_id in (
--   select pms.id
--   from public.premium_meal_slots pms
--   join public.premium_plan_days ppd on ppd.id = pms.premium_plan_day_id
--   join public.premium_plans pp on pp.id = ppd.premium_plan_id
--   where pp.title like 'staging_seed_%'
-- )
-- or premium_recipe_id in (
--   select id
--   from public.premium_recipes
--   where title like 'staging_seed_%'
-- );
--
-- delete from public.premium_meal_slots
-- where premium_plan_day_id in (
--   select ppd.id
--   from public.premium_plan_days ppd
--   join public.premium_plans pp on pp.id = ppd.premium_plan_id
--   where pp.title like 'staging_seed_%'
-- );
--
-- delete from public.premium_plan_days
-- where premium_plan_id in (
--   select id
--   from public.premium_plans
--   where title like 'staging_seed_%'
-- );
--
-- delete from public.premium_recipe_hints
-- where premium_recipe_id in (
--   select id
--   from public.premium_recipes
--   where title like 'staging_seed_%'
-- );
--
-- delete from public.premium_recipe_steps
-- where premium_recipe_id in (
--   select id
--   from public.premium_recipes
--   where title like 'staging_seed_%'
-- );
--
-- delete from public.premium_recipe_ingredients
-- where premium_recipe_id in (
--   select id
--   from public.premium_recipes
--   where title like 'staging_seed_%'
-- );
--
-- delete from public.premium_recipes
-- where title like 'staging_seed_%';
--
-- delete from public.premium_plans
-- where title like 'staging_seed_%';
--
-- commit;

commit;
