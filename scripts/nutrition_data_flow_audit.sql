-- Nutrition Data Flow Audit (read-only)
-- Purpose: identify where user food data is stored and validate RLS coverage signals.
-- Safe to run in Supabase SQL Editor (only SELECT statements).

-- =========================================================
-- SECTION 1: All public tables with user ownership columns
-- =========================================================
with ownership_cols as (
  select
    c.table_name,
    max(case when c.column_name = 'user_id' then 1 else 0 end) = 1 as has_user_id,
    max(case when c.column_name = 'created_by_user_id' then 1 else 0 end) = 1 as has_created_by_user_id
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name in ('user_id', 'created_by_user_id')
  group by c.table_name
)
select
  table_name,
  has_user_id,
  has_created_by_user_id,
  case
    when has_user_id then 'user_id'
    when has_created_by_user_id then 'created_by_user_id'
    else 'none'
  end as ownership_guard_column
from ownership_cols
order by table_name;

-- =========================================================
-- SECTION 2: Nutrition-related tables by naming convention
-- =========================================================
with public_tables as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
)
select
  table_name,
  case
    when position('food' in table_name) > 0 then 'food'
    when position('meal' in table_name) > 0 then 'meal'
    when position('recipe' in table_name) > 0 then 'recipe'
    when position('product' in table_name) > 0 then 'product'
    when position('nutrition' in table_name) > 0 then 'nutrition'
    else 'other'
  end as name_match_bucket
from public_tables
where position('food' in table_name) > 0
   or position('meal' in table_name) > 0
   or position('recipe' in table_name) > 0
   or position('product' in table_name) > 0
   or position('nutrition' in table_name) > 0
order by table_name;

-- =========================================================
-- SECTION 3: Tables that hold nutrition metric columns
-- =========================================================
with metric_cols as (
  select
    c.table_name,
    c.column_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name in ('calories', 'protein', 'fat', 'carbs', 'weight', 'grams')
)
select
  table_name,
  array_agg(column_name order by column_name) as present_metric_columns
from metric_cols
group by table_name
order by table_name;

-- =========================================================
-- SECTION 4: foods composition stats (catalog vs user rows)
-- =========================================================
with foods_presence as (
  select to_regclass('public.foods') is not null as foods_exists
), foods_stats as (
  select
    count(*)::bigint as total_rows,
    count(*) filter (where created_by_user_id is not null)::bigint as user_rows,
    count(*) filter (where created_by_user_id is null)::bigint as catalog_rows,
    count(*) filter (where source = 'core')::bigint as core_rows,
    count(*) filter (where source = 'brand')::bigint as brand_rows,
    count(*) filter (where source = 'user')::bigint as source_user_rows
  from public.foods
)
select
  case when p.foods_exists then s.total_rows else null end as total_rows,
  case when p.foods_exists then s.user_rows else null end as user_rows,
  case when p.foods_exists then s.catalog_rows else null end as catalog_rows,
  case when p.foods_exists then s.core_rows else null end as core_rows,
  case when p.foods_exists then s.brand_rows else null end as brand_rows,
  case when p.foods_exists then s.source_user_rows else null end as source_user_rows,
  case
    when not p.foods_exists then 'foods table is missing'
    when s.user_rows > 0 then 'WARNING: user-created foods exist; verify strict owner guard in SELECT/UPDATE/DELETE policies'
    else 'OK: no user-created foods detected by created_by_user_id'
  end as leakage_risk_note
from foods_presence p
left join foods_stats s on p.foods_exists;

-- =========================================================
-- SECTION 5: RLS status + policy coverage for nutrition scope
-- =========================================================
with explicit_nutrition as (
  select unnest(array[
    'food_diary_entries',
    'meal_entry_notes',
    'foods',
    'food_aliases',
    'favorite_products',
    'food_import_batches',
    'food_import_staging',
    'food_import_conflicts',
    'recipes',
    'recipe_notes',
    'favorite_recipes',
    'recipe_collections'
  ])::text as table_name
), ownership_cols as (
  select
    c.table_name,
    max(case when c.column_name = 'user_id' then 1 else 0 end) = 1 as has_user_id,
    max(case when c.column_name = 'created_by_user_id' then 1 else 0 end) = 1 as has_created_by_user_id
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name in ('user_id', 'created_by_user_id')
  group by c.table_name
), scope as (
  select
    t.table_name,
    coalesce(cls.relrowsecurity, false) as rls_enabled,
    case
      when coalesce(o.has_user_id, false) then 'user_id'
      when coalesce(o.has_created_by_user_id, false) then 'created_by_user_id'
      else 'none'
    end as guard_column
  from explicit_nutrition t
  left join pg_class cls on cls.relname = t.table_name
  left join pg_namespace nsp on nsp.oid = cls.relnamespace and nsp.nspname = 'public'
  left join ownership_cols o on o.table_name = t.table_name
), policy_rows as (
  select
    p.tablename as table_name,
    p.cmd,
    lower(translate(coalesce(p.qual, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as qual_norm,
    lower(translate(coalesce(p.with_check, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as with_check_norm
  from pg_policies p
  where p.schemaname = 'public'
), policies as (
  select
    r.table_name,
    count(*)::int as policies_count,
    bool_or(r.cmd in ('SELECT', '*')) as has_select,
    bool_or(r.cmd in ('INSERT', '*')) as has_insert,
    bool_or(r.cmd in ('UPDATE', '*')) as has_update,
    bool_or(r.cmd in ('DELETE', '*')) as has_delete,
    bool_or(
      r.qual_norm like '%auth.uid()=user_id%'
      or r.qual_norm like '%user_id=auth.uid()%'
      or r.with_check_norm like '%auth.uid()=user_id%'
      or r.with_check_norm like '%user_id=auth.uid()%'
      or r.qual_norm like '%auth.uid()=created_by_user_id%'
      or r.qual_norm like '%created_by_user_id=auth.uid()%'
      or r.with_check_norm like '%auth.uid()=created_by_user_id%'
      or r.with_check_norm like '%created_by_user_id=auth.uid()%'
    ) as has_owner_guard
  from policy_rows r
  group by r.table_name
)
select
  s.table_name,
  s.rls_enabled,
  coalesce(p.policies_count, 0) as policies_count,
  coalesce(p.has_select, false) as has_select,
  coalesce(p.has_insert, false) as has_insert,
  coalesce(p.has_update, false) as has_update,
  coalesce(p.has_delete, false) as has_delete,
  coalesce(p.has_owner_guard, false) as has_owner_guard,
  s.guard_column,
  case
    when s.guard_column = 'none' then 'public_or_system_table'
    when coalesce(p.has_owner_guard, false) then 'owner_guard_detected'
    else 'owner_guard_missing'
  end as rls_risk_signal
from scope s
left join policies p on p.table_name = s.table_name
order by s.table_name;

-- =========================================================
-- SECTION 6: Quick leak warnings for user-owned nutrition tables
-- =========================================================
with explicit_nutrition as (
  select unnest(array[
    'food_diary_entries',
    'meal_entry_notes',
    'foods',
    'food_aliases',
    'favorite_products',
    'food_import_batches',
    'food_import_staging',
    'food_import_conflicts',
    'recipes',
    'recipe_notes',
    'favorite_recipes',
    'recipe_collections'
  ])::text as table_name
), ownership_cols as (
  select
    c.table_name,
    max(case when c.column_name = 'user_id' then 1 else 0 end) = 1 as has_user_id,
    max(case when c.column_name = 'created_by_user_id' then 1 else 0 end) = 1 as has_created_by_user_id
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name in ('user_id', 'created_by_user_id')
  group by c.table_name
), policy_rows as (
  select
    p.tablename as table_name,
    lower(translate(coalesce(p.qual, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as qual_norm,
    lower(translate(coalesce(p.with_check, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as with_check_norm
  from pg_policies p
  where p.schemaname = 'public'
), owner_guard as (
  select
    r.table_name,
    bool_or(
      r.qual_norm like '%auth.uid()=user_id%'
      or r.qual_norm like '%user_id=auth.uid()%'
      or r.with_check_norm like '%auth.uid()=user_id%'
      or r.with_check_norm like '%user_id=auth.uid()%'
      or r.qual_norm like '%auth.uid()=created_by_user_id%'
      or r.qual_norm like '%created_by_user_id=auth.uid()%'
      or r.with_check_norm like '%auth.uid()=created_by_user_id%'
      or r.with_check_norm like '%created_by_user_id=auth.uid()%'
    ) as has_owner_guard
  from policy_rows r
  group by r.table_name
)
select
  t.table_name,
  case
    when (coalesce(o.has_user_id, false) or coalesce(o.has_created_by_user_id, false))
         and not coalesce(g.has_owner_guard, false)
      then 'WARNING: user-owned columns exist but owner guard pattern not detected'
    when (coalesce(o.has_user_id, false) or coalesce(o.has_created_by_user_id, false))
      then 'OK'
    else 'N/A'
  end as leak_warning,
  case
    when coalesce(o.has_user_id, false) then 'auth.uid() = user_id'
    when coalesce(o.has_created_by_user_id, false) then 'auth.uid() = created_by_user_id'
    else null
  end as recommended_owner_guard
from explicit_nutrition t
left join ownership_cols o on o.table_name = t.table_name
left join owner_guard g on g.table_name = t.table_name
order by t.table_name;
