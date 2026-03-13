-- Automatically recompute recipe totals after recipe_ingredients changes
-- Production-safe and idempotent
-- Does not bypass RLS: trigger function runs with invoker permissions

create or replace function public.recipe_ingredients_recompute_trigger()
returns trigger
language plpgsql
as $$
declare
  v_target_recipe_id uuid;
  v_target_recipe_ids uuid[];
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_uid uuid := auth.uid();
  v_has_recipes_fiber boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recipes'
      and column_name = 'fiber'
  )
  into v_has_recipes_fiber;

  if tg_op = 'DELETE' then
    v_target_recipe_ids := array[old.recipe_id];
  elsif tg_op = 'UPDATE' then
    v_target_recipe_ids := array[old.recipe_id, new.recipe_id];
  else
    v_target_recipe_ids := array[new.recipe_id];
  end if;

  for v_target_recipe_id in
    select distinct recipe_id
    from unnest(v_target_recipe_ids) as t(recipe_id)
    where recipe_id is not null
  loop
    begin
      perform public.recompute_recipe_totals(v_target_recipe_id);
    exception
      when others then
        -- Deleting or moving the last ingredient should zero totals instead of
        -- breaking the write operation. All other errors are re-raised.
        if sqlerrm = 'recipe_has_no_ingredients' then
          if v_has_recipes_fiber then
            execute
              'update public.recipes
               set total_calories = 0,
                   protein = 0,
                   fat = 0,
                   carbs = 0,
                   fiber = 0,
                   updated_at = now()
               where id = $1
                 and ($2 = ''service_role'' or user_id = $3)'
            using v_target_recipe_id, v_role, v_uid;
          else
            update public.recipes
            set
              total_calories = 0,
              protein = 0,
              fat = 0,
              carbs = 0,
              updated_at = now()
            where id = v_target_recipe_id
              and (v_role = 'service_role' or user_id = v_uid);
          end if;
        else
          raise;
        end if;
    end;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_recipe_ingredients_recompute on public.recipe_ingredients;

create trigger trg_recipe_ingredients_recompute
  after insert or update or delete on public.recipe_ingredients
  for each row
  execute function public.recipe_ingredients_recompute_trigger();
