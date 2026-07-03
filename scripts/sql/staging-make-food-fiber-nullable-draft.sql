-- STAGING ONLY
-- DO NOT RUN IN PRODUCTION
-- ADDITIVE/RELAXING DRAFT SQL
-- REVIEW BEFORE EXECUTION
-- TARGET STAGING PROJECT REF: ozidryfvhkcbtpnulakq
-- THIS FILE DOES NOT MODIFY FOOD ROW VALUES
--
-- Nutrition nullability contract:
--   public.foods.fiber is nullable and has no default.
--   NULL means the source did not provide a reliable dietary fiber value.
--   NULL must not be interpreted as confirmed zero.

do $$
declare
  v_fiber_type text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'foods'
  ) then
    raise exception 'public.foods table is required before relaxing fiber nullability';
  end if;

  select data_type
  into v_fiber_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'foods'
    and column_name = 'fiber';

  if v_fiber_type is null then
    raise exception 'public.foods.fiber column is required before relaxing fiber nullability';
  end if;

  if v_fiber_type not in ('numeric', 'real', 'double precision', 'integer', 'bigint', 'smallint') then
    raise exception 'public.foods.fiber must be numeric-compatible, got %', v_fiber_type;
  end if;
end $$;

alter table public.foods
  alter column fiber drop not null,
  alter column fiber drop default;

comment on column public.foods.fiber is
  'Dietary fiber per 100 g. NULL means the source did not provide a reliable value and must not be interpreted as confirmed zero.';

select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- VALIDATION QUERIES
-- RUN MANUALLY AFTER THE RELAXING PATCH
-- ============================================================

-- Query 1: fiber nullability/default
-- select
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'foods'
--   and column_name = 'fiber';

-- Query 2: required macro columns
-- select
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'foods'
--   and column_name in ('calories', 'protein', 'fat', 'carbs', 'fiber')
-- order by column_name;

-- Query 3: table counts must remain unchanged by this patch
-- select 'foods' as table_name, count(*) from public.foods
-- union all select 'food_aliases', count(*) from public.food_aliases
-- union all select 'food_diary_entries', count(*) from public.food_diary_entries
-- union all select 'recipes', count(*) from public.recipes
-- union all select 'recipe_ingredients', count(*) from public.recipe_ingredients
-- union all select 'favorite_products', count(*) from public.favorite_products;

-- Query 4: reload schema cache if needed
-- select pg_notify('pgrst', 'reload schema');
