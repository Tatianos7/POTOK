-- STAGING ONLY
-- DO NOT RUN IN PRODUCTION
-- ADDITIVE DRAFT SQL
-- REVIEW BEFORE EXECUTION
-- TARGET STAGING PROJECT REF: ozidryfvhkcbtpnulakq
-- THIS FILE MUST NOT IMPORT OR MODIFY FOOD DATA
--
-- Purpose:
--   Add the stable Food Core identity layer to an already-created POTOK
--   staging schema.
--
-- Fixed identity model:
--   public.foods.id = uuid primary key
--   public.foods.stable_food_id = text semantic Food Core identifier
--   public.foods.canonical_food_id = uuid self-reference
--   public.food_aliases.canonical_food_id = uuid reference to public.foods.id
--
-- Food Core Excel id values such as eggs_fried and mint_essence belong in
-- public.foods.stable_food_id. They must never be written into UUID columns.

do $$
declare
  v_foods_id_type text;
  v_foods_canonical_type text;
  v_alias_canonical_type text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'foods'
  ) then
    raise exception 'public.foods table is required before adding stable Food Core identity';
  end if;

  select data_type
  into v_foods_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'foods'
    and column_name = 'id';

  if coalesce(v_foods_id_type, '') <> 'uuid' then
    raise exception 'public.foods.id must be uuid, got %', coalesce(v_foods_id_type, 'missing');
  end if;

  select data_type
  into v_foods_canonical_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'foods'
    and column_name = 'canonical_food_id';

  if v_foods_canonical_type is not null and v_foods_canonical_type <> 'uuid' then
    raise exception 'public.foods.canonical_food_id must remain uuid, got %', v_foods_canonical_type;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_aliases'
  ) then
    select data_type
    into v_alias_canonical_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'food_aliases'
      and column_name = 'canonical_food_id';

    if v_alias_canonical_type is not null and v_alias_canonical_type <> 'uuid' then
      raise exception 'public.food_aliases.canonical_food_id must remain uuid, got %', v_alias_canonical_type;
    end if;
  end if;
end $$;

alter table public.foods
  add column if not exists stable_food_id text;

alter table public.foods
  add column if not exists product_scope text;

alter table public.foods
  add column if not exists data_source text;

alter table public.foods
  add column if not exists cooking_state text;

create unique index if not exists foods_stable_food_id_unique
  on public.foods (stable_food_id)
  where stable_food_id is not null;

comment on column public.foods.stable_food_id is
  'Stable semantic identifier from Food Core import. This is not the database primary key and must not be used as a UUID foreign key. public.foods.id remains UUID identity.';

comment on column public.foods.product_scope is
  'Food Core scope label, for example core. Nullable for legacy rows.';

comment on column public.foods.data_source is
  'Import/source label for Food Core rows, for example food_core_v02. Nullable for legacy rows.';

comment on column public.foods.cooking_state is
  'Food preparation state from Food Core, for example raw, cooked, boiled, fried. Nullable for legacy rows.';

select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- VALIDATION QUERIES
-- RUN MANUALLY AFTER THE ADDITIVE PATCH
-- ============================================================

-- 1. Column types
-- select
--   table_name,
--   column_name,
--   data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and (
--     (table_name = 'foods' and column_name in ('id', 'stable_food_id', 'canonical_food_id'))
--     or (table_name = 'food_aliases' and column_name = 'canonical_food_id')
--   )
-- order by table_name, column_name;

-- 2. Food Core identity/support columns
-- select
--   column_name,
--   data_type,
--   is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'foods'
--   and column_name in ('stable_food_id', 'product_scope', 'data_source', 'cooking_state')
-- order by column_name;

-- 3. Stable id index
-- select
--   indexname,
--   indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'foods'
--   and indexname = 'foods_stable_food_id_unique';

-- 4. Duplicate stable ids
-- select
--   stable_food_id,
--   count(*)
-- from public.foods
-- where stable_food_id is not null
-- group by stable_food_id
-- having count(*) > 1;

-- 5. Table row counts
-- select 'foods' as table_name, count(*) from public.foods
-- union all
-- select 'food_aliases', count(*) from public.food_aliases
-- union all
-- select 'food_diary_entries', count(*) from public.food_diary_entries
-- union all
-- select 'recipes', count(*) from public.recipes
-- union all
-- select 'recipe_ingredients', count(*) from public.recipe_ingredients
-- union all
-- select 'favorite_products', count(*) from public.favorite_products;

-- 6. Empty-string stable ids
-- select count(*)
-- from public.foods
-- where stable_food_id is not null
--   and btrim(stable_food_id) = '';

-- 7. Reload schema cache again if needed
-- select pg_notify('pgrst', 'reload schema');
