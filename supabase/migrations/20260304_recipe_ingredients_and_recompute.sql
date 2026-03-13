-- Recipe Analyzer baseline hardening: normalized recipe ingredients + server-side recompute
-- Safe/idempotent migration

-- 1) Table
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_id uuid not null references public.foods(id),
  amount_g numeric(10,2) not null check (amount_g > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_ingredients_recipe_idx
  on public.recipe_ingredients (recipe_id);

create index if not exists recipe_ingredients_food_idx
  on public.recipe_ingredients (food_id);

-- 2) updated_at trigger
create or replace function public.update_recipe_ingredients_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_recipe_ingredients_updated_at on public.recipe_ingredients;
create trigger update_recipe_ingredients_updated_at
  before update on public.recipe_ingredients
  for each row
  execute function public.update_recipe_ingredients_updated_at();

-- 3) RLS
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_ingredients force row level security;

revoke all on table public.recipe_ingredients from anon;
grant select, insert, update, delete on table public.recipe_ingredients to authenticated;

-- SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_ingredients'
      AND policyname = 'recipe_ingredients_select_own'
  ) THEN
    CREATE POLICY recipe_ingredients_select_own
      ON public.recipe_ingredients
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.recipes r
          WHERE r.id = recipe_id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_ingredients'
      AND policyname = 'recipe_ingredients_insert_own'
  ) THEN
    CREATE POLICY recipe_ingredients_insert_own
      ON public.recipe_ingredients
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.recipes r
          WHERE r.id = recipe_id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_ingredients'
      AND policyname = 'recipe_ingredients_update_own'
  ) THEN
    CREATE POLICY recipe_ingredients_update_own
      ON public.recipe_ingredients
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.recipes r
          WHERE r.id = recipe_id
            AND r.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.recipes r
          WHERE r.id = recipe_id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_ingredients'
      AND policyname = 'recipe_ingredients_delete_own'
  ) THEN
    CREATE POLICY recipe_ingredients_delete_own
      ON public.recipe_ingredients
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.recipes r
          WHERE r.id = recipe_id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 4) RPC recompute recipe totals (security invoker; no SECURITY DEFINER)
create or replace function public.recompute_recipe_totals(recipe_id uuid)
returns void
language plpgsql
as $$
declare
  v_owner uuid;
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_uid uuid := auth.uid();
  v_recipe_ingredient_count integer := 0;
  v_joined_food_count integer := 0;
  v_has_recipes_fiber boolean := false;
  v_has_foods_fiber boolean := false;
  v_null_nutrients_count integer := 0;
  v_total_calories numeric(12,4) := 0;
  v_total_protein numeric(12,4) := 0;
  v_total_fat numeric(12,4) := 0;
  v_total_carbs numeric(12,4) := 0;
  v_total_fiber numeric(12,4) := 0;
begin
  select r.user_id
  into v_owner
  from public.recipes r
  where r.id = recipe_id;

  if v_owner is null then
    raise exception 'recipe_not_found';
  end if;

  if v_role <> 'service_role' and v_owner <> v_uid then
    raise exception 'forbidden_recipe_access';
  end if;

  select count(*)
  into v_recipe_ingredient_count
  from public.recipe_ingredients ri
  where ri.recipe_id = recompute_recipe_totals.recipe_id;

  if v_recipe_ingredient_count = 0 then
    raise exception 'recipe_has_no_ingredients';
  end if;

  select count(*)
  into v_joined_food_count
  from public.recipe_ingredients ri
  join public.foods f on f.id = ri.food_id
  where ri.recipe_id = recompute_recipe_totals.recipe_id;

  if v_joined_food_count <> v_recipe_ingredient_count then
    raise exception 'recipe_contains_unavailable_food_rows';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recipes'
      and column_name = 'fiber'
  )
  into v_has_recipes_fiber;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'foods'
      and column_name = 'fiber'
  )
  into v_has_foods_fiber;

  if v_has_foods_fiber then
    select count(*)
    into v_null_nutrients_count
    from public.recipe_ingredients ri
    join public.foods f on f.id = ri.food_id
    where ri.recipe_id = recompute_recipe_totals.recipe_id
      and (
        f.calories is null
        or f.protein is null
        or f.fat is null
        or f.carbs is null
        or f.fiber is null
      );
  else
    select count(*)
    into v_null_nutrients_count
    from public.recipe_ingredients ri
    join public.foods f on f.id = ri.food_id
    where ri.recipe_id = recompute_recipe_totals.recipe_id
      and (
        f.calories is null
        or f.protein is null
        or f.fat is null
        or f.carbs is null
      );
  end if;

  if v_null_nutrients_count > 0 then
    raise exception 'recipe_contains_foods_with_null_nutrients';
  end if;

  select
    coalesce(sum(f.calories * ri.amount_g / 100.0), 0),
    coalesce(sum(f.protein * ri.amount_g / 100.0), 0),
    coalesce(sum(f.fat * ri.amount_g / 100.0), 0),
    coalesce(sum(f.carbs * ri.amount_g / 100.0), 0),
    coalesce(sum(case when v_has_foods_fiber then f.fiber * ri.amount_g / 100.0 else 0 end), 0)
  into
    v_total_calories,
    v_total_protein,
    v_total_fat,
    v_total_carbs,
    v_total_fiber
  from public.recipe_ingredients ri
  join public.foods f on f.id = ri.food_id
  where ri.recipe_id = recompute_recipe_totals.recipe_id;

  if v_has_recipes_fiber then
    execute
      'update public.recipes
       set total_calories = $1,
           protein = $2,
           fat = $3,
           carbs = $4,
           fiber = $5,
           updated_at = now()
       where id = $6
         and ($7 = ''service_role'' or user_id = $8)'
    using
      round(v_total_calories::numeric, 2),
      round(v_total_protein::numeric, 2),
      round(v_total_fat::numeric, 2),
      round(v_total_carbs::numeric, 2),
      round(v_total_fiber::numeric, 2),
      recompute_recipe_totals.recipe_id,
      v_role,
      v_uid;
  else
    update public.recipes
    set
      total_calories = round(v_total_calories::numeric, 2),
      protein = round(v_total_protein::numeric, 2),
      fat = round(v_total_fat::numeric, 2),
      carbs = round(v_total_carbs::numeric, 2),
      updated_at = now()
    where id = recompute_recipe_totals.recipe_id
      and (v_role = 'service_role' or user_id = v_uid);
  end if;
end;
$$;

revoke all on function public.recompute_recipe_totals(uuid) from public;
grant execute on function public.recompute_recipe_totals(uuid) to authenticated;
grant execute on function public.recompute_recipe_totals(uuid) to service_role;

-- 5) Atomic replace helper for import script (delete old ingredients -> insert new)
create or replace function public.replace_recipe_ingredients_atomic(
  p_recipe_id uuid,
  p_user_id uuid,
  p_rows jsonb,
  p_servings numeric default null,
  p_yield_g numeric default null
)
returns integer
language plpgsql
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_inserted integer := 0;
  v_has_servings boolean := false;
  v_has_yield_g boolean := false;
begin
  select r.user_id
  into v_owner
  from public.recipes r
  where r.id = p_recipe_id;

  if v_owner is null then
    raise exception 'recipe_not_found';
  end if;

  if v_owner <> p_user_id then
    raise exception 'recipe_owner_mismatch';
  end if;

  if v_role <> 'service_role' and v_uid <> p_user_id then
    raise exception 'forbidden_recipe_access';
  end if;

  delete from public.recipe_ingredients
  where recipe_id = p_recipe_id;

  insert into public.recipe_ingredients (recipe_id, food_id, amount_g)
  select
    p_recipe_id,
    r.food_id,
    r.amount_g
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(food_id uuid, amount_g numeric)
  where r.food_id is not null
    and r.amount_g is not null
    and r.amount_g > 0;

  get diagnostics v_inserted = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recipes' and column_name = 'servings'
  ) into v_has_servings;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recipes' and column_name = 'yield_g'
  ) into v_has_yield_g;

  if v_has_servings and v_has_yield_g then
    execute
      'update public.recipes
       set servings = coalesce($1, servings),
           yield_g = coalesce($2, yield_g),
           updated_at = now()
       where id = $3'
    using p_servings, p_yield_g, p_recipe_id;
  elsif v_has_servings then
    execute
      'update public.recipes
       set servings = coalesce($1, servings),
           updated_at = now()
       where id = $2'
    using p_servings, p_recipe_id;
  elsif v_has_yield_g then
    execute
      'update public.recipes
       set yield_g = coalesce($1, yield_g),
           updated_at = now()
       where id = $2'
    using p_yield_g, p_recipe_id;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.replace_recipe_ingredients_atomic(uuid, uuid, jsonb, numeric, numeric) from public;
grant execute on function public.replace_recipe_ingredients_atomic(uuid, uuid, jsonb, numeric, numeric) to authenticated;
grant execute on function public.replace_recipe_ingredients_atomic(uuid, uuid, jsonb, numeric, numeric) to service_role;
