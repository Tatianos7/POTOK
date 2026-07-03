-- STAGING ONLY
-- DO NOT RUN IN PRODUCTION
-- ADDITIVE/CONTRACT-ALIGNMENT DRAFT SQL
-- REVIEW BEFORE EXECUTION
-- TARGET STAGING PROJECT REF: ozidryfvhkcbtpnulakq
-- THIS FILE MUST NOT INSERT OR UPDATE DIARY ROWS
--
-- Diary nutrition snapshot contract:
--   public.food_diary_entries stores immutable nutrition snapshots.
--   public.food_diary_entries.fiber is nullable and has no default.
--   NULL means the source did not provide a reliable dietary fiber value.
--   NULL must not be interpreted as confirmed zero.

do $$
declare
  v_missing_macros text[];
  v_bad_macro_types text[];
  v_foods_id_type text;
  v_diary_canonical_type text;
  v_fiber_type text;
  v_fiber_nullable text;
  v_fiber_default text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_diary_entries'
  ) then
    raise exception 'public.food_diary_entries table is required before aligning diary snapshot contract';
  end if;

  select array_agg(required.column_name order by required.column_name)
  into v_missing_macros
  from (
    values ('calories'), ('protein'), ('fat'), ('carbs')
  ) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'food_diary_entries'
      and c.column_name = required.column_name
  );

  if coalesce(array_length(v_missing_macros, 1), 0) > 0 then
    raise exception 'public.food_diary_entries is missing required macro snapshot columns: %', array_to_string(v_missing_macros, ', ');
  end if;

  select array_agg(column_name order by column_name)
  into v_bad_macro_types
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'food_diary_entries'
    and column_name in ('calories', 'protein', 'fat', 'carbs')
    and data_type not in ('numeric', 'real', 'double precision', 'integer', 'bigint', 'smallint');

  if coalesce(array_length(v_bad_macro_types, 1), 0) > 0 then
    raise exception 'public.food_diary_entries macro snapshot columns must be numeric-compatible, bad columns: %', array_to_string(v_bad_macro_types, ', ');
  end if;

  select data_type
  into v_foods_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'foods'
    and column_name = 'id';

  if coalesce(v_foods_id_type, '') <> 'uuid' then
    raise exception 'public.foods.id must be uuid before diary canonical snapshot alignment, got %', coalesce(v_foods_id_type, 'missing');
  end if;

  select data_type
  into v_diary_canonical_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'food_diary_entries'
    and column_name = 'canonical_food_id';

  if v_diary_canonical_type is not null and v_diary_canonical_type <> 'uuid' then
    raise exception 'public.food_diary_entries.canonical_food_id must be uuid-compatible, got %', v_diary_canonical_type;
  end if;

  select data_type, is_nullable, column_default
  into v_fiber_type, v_fiber_nullable, v_fiber_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'food_diary_entries'
    and column_name = 'fiber';

  if v_fiber_type is not null then
    if v_fiber_type not in ('numeric', 'real', 'double precision', 'integer', 'bigint', 'smallint') then
      raise exception 'public.food_diary_entries.fiber must be numeric-compatible, got %', v_fiber_type;
    end if;

    if v_fiber_nullable <> 'YES' then
      raise exception 'public.food_diary_entries.fiber must be nullable to preserve unknown fiber snapshots';
    end if;

    if v_fiber_default is not null then
      raise exception 'public.food_diary_entries.fiber must not have a default; got %', v_fiber_default;
    end if;
  end if;
end $$;

alter table public.food_diary_entries
  add column if not exists fiber numeric(8,2);

comment on column public.food_diary_entries.fiber is
  'Immutable dietary fiber snapshot for this diary entry. NULL means the source did not provide a reliable value and must not be interpreted as confirmed zero.';

select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- VALIDATION QUERIES
-- RUN MANUALLY AFTER THE CONTRACT-ALIGNMENT PATCH
-- ============================================================

-- Query 1: diary fiber contract
-- select
--   column_name,
--   data_type,
--   numeric_precision,
--   numeric_scale,
--   is_nullable,
--   column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'food_diary_entries'
--   and column_name = 'fiber';

-- Query 2: diary nutrition snapshot columns
-- select
--   column_name,
--   data_type,
--   numeric_precision,
--   numeric_scale,
--   is_nullable,
--   column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'food_diary_entries'
--   and column_name in ('calories', 'protein', 'fat', 'carbs', 'fiber')
-- order by column_name;

-- Query 3: canonical food FK column and foods UUID identity
-- select
--   table_name,
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and (
--     (table_name = 'foods' and column_name = 'id')
--     or (table_name = 'food_diary_entries' and column_name = 'canonical_food_id')
--   )
-- order by table_name, column_name;

-- Query 4: table counts must remain unchanged by this patch
-- select 'foods' as table_name, count(*) from public.foods
-- union all select 'food_aliases', count(*) from public.food_aliases
-- union all select 'food_diary_entries', count(*) from public.food_diary_entries
-- union all select 'recipes', count(*) from public.recipes
-- union all select 'recipe_ingredients', count(*) from public.recipe_ingredients
-- union all select 'favorite_products', count(*) from public.favorite_products;

-- Query 5: idempotency index contract
-- select
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'food_diary_entries'
--   and indexname in ('food_diary_entries_idempotency_unique', 'food_diary_entries_user_date_idx');

-- Query 6: RLS policies
-- select
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'food_diary_entries';

-- Query 7: reload schema cache if needed
-- select pg_notify('pgrst', 'reload schema');
