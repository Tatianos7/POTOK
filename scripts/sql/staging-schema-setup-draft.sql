-- STAGING ONLY
-- DO NOT RUN IN PRODUCTION
-- DRAFT SQL
-- REVIEW BEFORE EXECUTION
-- TARGET STAGING PROJECT REF: ozidryfvhkcbtpnulakq
--
-- Purpose:
--   Minimal POTOK food/diary/recipe/favorites schema for Food Core v02 staging tests.
--   Food Core Excel semantic ids (for example eggs_fried, mint_essence)
--   must be stored in public.foods.stable_food_id.
--   public.foods.id remains UUID and is the only FK identity used by the app.
--
-- Safety:
--   - No Food Core Excel data is included.
--   - No seed/import rows are included.
--   - No DROP TABLE / TRUNCATE / data DELETE is included.
--   - No diary snapshot recalculation is included.
--   - No recipe data recompute is executed by this file.
--
-- Manual guard before running:
--   Run only in Supabase SQL Editor for project ref ozidryfvhkcbtpnulakq.
--   Do not run in project ref dtsdnhbcwpbfrhcazqkb.

-- ============================================================
-- 1. Extensions
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================
-- 2. Minimal support table used by food admin policies
-- Source: supabase/user_profiles_schema.sql, reduced to schema/policies only.
-- ============================================================

create table if not exists public.user_profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  first_name       text,
  last_name        text,
  middle_name      text,
  birth_date       date,
  age              integer,
  height           numeric(5,2),
  goal             text,
  email            text,
  phone            text,
  avatar_url       text,
  has_premium      boolean not null default false,
  is_admin         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists user_profiles_user_idx
  on public.user_profiles (user_id);

create index if not exists user_profiles_email_idx
  on public.user_profiles (email)
  where email is not null;

create index if not exists user_profiles_phone_idx
  on public.user_profiles (phone)
  where phone is not null;

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_profiles_modify_own" on public.user_profiles;
create policy "user_profiles_modify_own"
  on public.user_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_profiles_updated_at on public.user_profiles;
create trigger update_user_profiles_updated_at
  before update on public.user_profiles
  for each row
  execute function public.update_updated_at_column();

-- ============================================================
-- 3. Core food schema
-- Source: supabase/foods_schema.sql, normalized for idempotent staging setup.
-- ============================================================

create table if not exists public.foods (
  id                    uuid primary key default gen_random_uuid(),
  stable_food_id        text,
  name                  text not null,
  name_original         text,
  barcode               text,
  calories              numeric(8,2) not null default 0,
  protein               numeric(8,2) not null default 0,
  fat                   numeric(8,2) not null default 0,
  carbs                 numeric(8,2) not null default 0,
  fiber                 numeric(8,2),
  unit                  text not null default 'g',
  category              text,
  product_scope         text,
  data_source           text,
  cooking_state         text,
  brand                 text,
  source                text not null check (source in ('core', 'brand', 'user')),
  created_by_user_id    uuid references auth.users (id) on delete set null,
  canonical_food_id     uuid references public.foods (id) on delete set null,
  normalized_name       text,
  normalized_brand      text,
  nutrition_version     integer not null default 1,
  verified              boolean not null default false,
  suspicious            boolean not null default false,
  confidence_score      numeric(4,3) not null default 1,
  source_version        text,
  allergens             text[],
  intolerances          text[],
  photo                 text,
  aliases               text[],
  auto_filled           boolean not null default false,
  popularity            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists foods_source_idx on public.foods (source);
create unique index if not exists foods_stable_food_id_unique
  on public.foods (stable_food_id)
  where stable_food_id is not null;
create index if not exists foods_stable_food_id_idx
  on public.foods (stable_food_id)
  where stable_food_id is not null;
create index if not exists foods_created_by_user_id_idx on public.foods (created_by_user_id) where created_by_user_id is not null;
create index if not exists foods_barcode_idx on public.foods (barcode) where barcode is not null;
create index if not exists foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);
create index if not exists foods_category_idx on public.foods (category) where category is not null;
create unique index if not exists foods_normalized_unique
  on public.foods (normalized_name, coalesce(normalized_brand, ''));

alter table public.foods add column if not exists search_vector tsvector;

create or replace function public.normalize_food_text(value text)
returns text as $$
  select trim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9а-яё]+', ' ', 'g'));
$$ language sql immutable;

create or replace function public.foods_update_search_vector()
returns trigger as $$
begin
  new.normalized_name := public.normalize_food_text(new.name);
  new.normalized_brand := public.normalize_food_text(new.brand);
  if new.canonical_food_id is null then
    new.canonical_food_id := new.id;
  end if;
  new.search_vector :=
    setweight(to_tsvector('russian', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(new.name_original, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(array_to_string(new.aliases, ' '), '')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists foods_search_vector_update on public.foods;
create trigger foods_search_vector_update
  before insert or update on public.foods
  for each row
  execute function public.foods_update_search_vector();

create index if not exists foods_search_idx on public.foods using gin (search_vector);

create or replace function public.update_foods_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_foods_updated_at on public.foods;
create trigger update_foods_updated_at
  before update on public.foods
  for each row
  execute function public.update_foods_updated_at();

alter table public.foods enable row level security;

drop policy if exists "foods_select_public_sources" on public.foods;
drop policy if exists "foods_select_open_sources" on public.foods;
create policy "foods_select_public_sources"
  on public.foods
  for select
  using (source in ('core', 'brand'));

drop policy if exists "foods_select_user_sources" on public.foods;
create policy "foods_select_user_sources"
  on public.foods
  for select
  using (source = 'user' and created_by_user_id = auth.uid());

drop policy if exists "foods_insert_user" on public.foods;
create policy "foods_insert_user"
  on public.foods
  for insert
  with check (source = 'user' and created_by_user_id = auth.uid());

drop policy if exists "foods_insert_admin" on public.foods;
create policy "foods_insert_admin"
  on public.foods
  for insert
  with check (
    source in ('core', 'brand')
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "foods_update_user" on public.foods;
create policy "foods_update_user"
  on public.foods
  for update
  using (source = 'user' and created_by_user_id = auth.uid())
  with check (source = 'user' and created_by_user_id = auth.uid());

drop policy if exists "foods_update_admin" on public.foods;
create policy "foods_update_admin"
  on public.foods
  for update
  using (
    source in ('core', 'brand')
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  )
  with check (
    source in ('core', 'brand')
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "foods_delete_user" on public.foods;
create policy "foods_delete_user"
  on public.foods
  for delete
  using (source = 'user' and created_by_user_id = auth.uid());

create table if not exists public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_food_id uuid not null references public.foods (id) on delete cascade,
  alias text not null,
  normalized_alias text,
  source text not null default 'core',
  verified boolean not null default false,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_alias)
);

create index if not exists food_aliases_canonical_idx
  on public.food_aliases (canonical_food_id);

alter table public.food_aliases enable row level security;

drop policy if exists "food_aliases_select_public" on public.food_aliases;
create policy "food_aliases_select_public"
  on public.food_aliases
  for select
  using (true);

drop policy if exists "food_aliases_modify_own" on public.food_aliases;
create policy "food_aliases_modify_own"
  on public.food_aliases
  for all
  using (auth.uid() = created_by_user_id)
  with check (auth.uid() = created_by_user_id);

drop policy if exists "food_aliases_modify_admin" on public.food_aliases;
create policy "food_aliases_modify_admin"
  on public.food_aliases
  for all
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  );

create or replace function public.food_aliases_normalize()
returns trigger as $$
begin
  new.normalized_alias := public.normalize_food_text(new.alias);
  return new;
end;
$$ language plpgsql;

drop trigger if exists food_aliases_normalize_trigger on public.food_aliases;
create trigger food_aliases_normalize_trigger
  before insert or update on public.food_aliases
  for each row
  execute function public.food_aliases_normalize();

-- ============================================================
-- 4. Food diary schema
-- Sources: supabase/schema_fixed.sql, food_diary_idempotency.sql,
--          phase7_4_1_food_units.sql.
-- NOTE: source phase7_4_1 includes an UPDATE backfill. It is intentionally
--       not included in this setup draft.
-- ============================================================

create table if not exists public.food_diary_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  date         date not null,
  meal_type    text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  product_name text not null,
  protein      numeric(8,2) not null default 0,
  fat          numeric(8,2) not null default 0,
  carbs        numeric(8,2) not null default 0,
  fiber        numeric(8,2),
  calories     numeric(8,2) not null default 0,
  weight       numeric(8,2) not null default 0,
  canonical_food_id uuid references public.foods (id) on delete set null,
  base_unit    text default 'г',
  display_unit text default 'г',
  display_amount numeric,
  idempotency_key text,
  created_at   timestamptz not null default now()
);

create index if not exists food_diary_entries_user_date_idx
  on public.food_diary_entries (user_id, date, meal_type);

create index if not exists food_diary_entries_canonical_idx
  on public.food_diary_entries (user_id, canonical_food_id);

create unique index if not exists food_diary_entries_idempotency_unique
  on public.food_diary_entries (user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.food_diary_entries enable row level security;

drop policy if exists "food_diary_entries_select_own" on public.food_diary_entries;
create policy "food_diary_entries_select_own"
  on public.food_diary_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists "food_diary_entries_modify_own" on public.food_diary_entries;
create policy "food_diary_entries_modify_own"
  on public.food_diary_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 5. Recipes schema
-- Source: supabase/schema_fixed.sql, with fiber/servings/yield_g compatibility
--         for later recompute functions.
-- ============================================================

create table if not exists public.recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  name           text not null,
  ingredients    jsonb not null default '[]'::jsonb,
  total_calories numeric(10,2) not null default 0,
  protein        numeric(10,2) not null default 0,
  fat            numeric(10,2) not null default 0,
  carbs          numeric(10,2) not null default 0,
  fiber          numeric(10,2) not null default 0,
  servings       numeric(10,2),
  yield_g        numeric(10,2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists recipes_user_idx
  on public.recipes (user_id, created_at desc);

alter table public.recipes enable row level security;

drop policy if exists "recipes_select_own" on public.recipes;
create policy "recipes_select_own"
  on public.recipes
  for select
  using (auth.uid() = user_id);

drop policy if exists "recipes_modify_own" on public.recipes;
create policy "recipes_modify_own"
  on public.recipes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 6. Normalized recipe ingredients and recompute support
-- Sources: 20260304_recipe_ingredients_and_recompute.sql and
--          20260311_recipe_ingredients_recompute_trigger.sql.
--
-- The replace_recipe_ingredients_atomic helper is intentionally excluded from
-- this staging schema draft because its body performs DELETE/INSERT. Add it
-- later only after separate review.
-- ============================================================

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

alter table public.recipe_ingredients enable row level security;
alter table public.recipe_ingredients force row level security;

revoke all on table public.recipe_ingredients from anon;
grant select, insert, update, delete on table public.recipe_ingredients to authenticated;

drop policy if exists recipe_ingredients_select_own on public.recipe_ingredients;
create policy recipe_ingredients_select_own
  on public.recipe_ingredients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_ingredients_insert_own on public.recipe_ingredients;
create policy recipe_ingredients_insert_own
  on public.recipe_ingredients
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_ingredients_update_own on public.recipe_ingredients;
create policy recipe_ingredients_update_own
  on public.recipe_ingredients
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_ingredients_delete_own on public.recipe_ingredients;
create policy recipe_ingredients_delete_own
  on public.recipe_ingredients
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and r.user_id = auth.uid()
    )
  );

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

  select
    coalesce(sum(f.calories * ri.amount_g / 100.0), 0),
    coalesce(sum(f.protein * ri.amount_g / 100.0), 0),
    coalesce(sum(f.fat * ri.amount_g / 100.0), 0),
    coalesce(sum(f.carbs * ri.amount_g / 100.0), 0),
    coalesce(sum(f.fiber * ri.amount_g / 100.0), 0)
  into
    v_total_calories,
    v_total_protein,
    v_total_fat,
    v_total_carbs,
    v_total_fiber
  from public.recipe_ingredients ri
  join public.foods f on f.id = ri.food_id
  where ri.recipe_id = recompute_recipe_totals.recipe_id;

  update public.recipes
  set
    total_calories = round(v_total_calories::numeric, 2),
    protein = round(v_total_protein::numeric, 2),
    fat = round(v_total_fat::numeric, 2),
    carbs = round(v_total_carbs::numeric, 2),
    fiber = round(v_total_fiber::numeric, 2),
    updated_at = now()
  where id = recompute_recipe_totals.recipe_id
    and (v_role = 'service_role' or user_id = v_uid);
end;
$$;

revoke all on function public.recompute_recipe_totals(uuid) from public;
grant execute on function public.recompute_recipe_totals(uuid) to authenticated;
grant execute on function public.recompute_recipe_totals(uuid) to service_role;

create or replace function public.recipe_ingredients_recompute_trigger()
returns trigger
language plpgsql
as $$
declare
  v_target_recipe_id uuid;
  v_target_recipe_ids uuid[];
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_uid uuid := auth.uid();
begin
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
        if sqlerrm = 'recipe_has_no_ingredients' then
          update public.recipes
          set
            total_calories = 0,
            protein = 0,
            fat = 0,
            carbs = 0,
            fiber = 0,
            updated_at = now()
          where id = v_target_recipe_id
            and (v_role = 'service_role' or user_id = v_uid);
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

-- ============================================================
-- 7. Favorite products schema
-- Sources: supabase/schema_fixed.sql and
--          20260310_favorite_products_canonical_food_id.sql.
-- ============================================================

create table if not exists public.favorite_products (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  product_name text not null,
  protein      numeric(8,2) not null default 0,
  fat          numeric(8,2) not null default 0,
  carbs        numeric(8,2) not null default 0,
  calories     numeric(8,2) not null default 0,
  usage_count  integer not null default 0,
  canonical_food_id uuid references public.foods (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists favorite_products_user_idx
  on public.favorite_products (user_id, product_name);

create index if not exists favorite_products_canonical_food_id_idx
  on public.favorite_products (canonical_food_id);

alter table public.favorite_products enable row level security;

drop policy if exists "favorite_products_select_own" on public.favorite_products;
create policy "favorite_products_select_own"
  on public.favorite_products
  for select
  using (auth.uid() = user_id);

drop policy if exists "favorite_products_modify_own" on public.favorite_products;
create policy "favorite_products_modify_own"
  on public.favorite_products
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 8. PostgREST schema cache reload
-- ============================================================

select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- VALIDATION QUERIES
-- Run these manually after execution in staging SQL Editor.
-- ============================================================

-- Query 1: required tables exist
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in (
--     'foods',
--     'food_aliases',
--     'food_diary_entries',
--     'recipes',
--     'recipe_ingredients',
--     'favorite_products'
--   )
-- order by table_name;

-- Query 2: foods required import columns
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'foods'
--   and column_name in (
--     'id',
--     'stable_food_id',
--     'name',
--     'normalized_name',
--     'calories',
--     'protein',
--     'fat',
--     'carbs',
--     'source',
--     'canonical_food_id',
--     'brand',
--     'normalized_brand',
--     'fiber',
--     'verified',
--     'suspicious',
--     'created_by_user_id',
--     'barcode',
--     'category'
--     'product_scope',
--     'data_source',
--     'cooking_state'
--   )
-- order by ordinal_position;

-- Query 3: food_aliases target id column
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'food_aliases'
-- order by ordinal_position;

-- Query 4: recipe functions/triggers
-- select routine_name
-- from information_schema.routines
-- where specific_schema = 'public'
--   and routine_name in (
--     'recompute_recipe_totals',
--     'recipe_ingredients_recompute_trigger',
--     'update_recipe_ingredients_updated_at'
--   )
-- order by routine_name;
--
-- select trigger_name, event_object_table
-- from information_schema.triggers
-- where trigger_schema = 'public'
--   and event_object_table = 'recipe_ingredients'
-- order by trigger_name;

-- Query 5: reload schema cache if needed
-- select pg_notify('pgrst', 'reload schema');
