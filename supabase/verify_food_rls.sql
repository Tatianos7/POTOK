-- Final release-gate RLS verification for Nutrition/Food domain (NUTRITION-ONLY)
-- Read-only audit script. It does NOT mutate schema/policies/data.

-- =========================================================
-- SECTION A: Scope discovery (nutrition-only)
-- =========================================================
with explicit_tables as (
  select unnest(array[
    'food_diary_entries',
    'meal_entry_notes',
    'foods',
    'food_aliases',
    'favorite_products',
    'food_import_batches',
    'food_import_conflicts',
    'food_import_staging',
    'recipes',
    'recipe_notes',
    'favorite_recipes',
    'recipe_collections'
  ])::text as table_name
),
public_tables as (
  select c.oid, c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
col_flags as (
  select
    t.table_name,
    bool_or(a.attname = 'user_id' and at.typname = 'uuid') as has_user_id_uuid,
    bool_or(a.attname = 'created_by_user_id' and at.typname = 'uuid') as has_created_by_user_id_uuid
  from public_tables t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  join pg_type at on at.oid = a.atttypid
  group by t.table_name
),
name_match as (
  select
    t.table_name,
    (
      t.table_name in (select table_name from explicit_tables)
      or position('food_' in t.table_name) = 1
      or position('meal_' in t.table_name) = 1
      or position('recipe_' in t.table_name) = 1
      or position('recipes_' in t.table_name) = 1
      or position('favorite_' in t.table_name) = 1
      or position('food_ingestion_' in t.table_name) = 1
      or position('recipes_relations_' in t.table_name) = 1
    ) as is_nutrition_related
  from public_tables t
),
scope as (
  select
    t.table_name,
    t.rls_enabled,
    coalesce(c.has_user_id_uuid, false) as has_user_id_uuid,
    coalesce(c.has_created_by_user_id_uuid, false) as has_created_by_user_id_uuid,
    coalesce(n.is_nutrition_related, false) as is_nutrition_related,
    case
      when coalesce(c.has_user_id_uuid, false) then 'user_id'
      when coalesce(c.has_created_by_user_id_uuid, false) then 'created_by_user_id'
      else 'none'
    end as guard_column
  from public_tables t
  left join col_flags c on c.table_name = t.table_name
  left join name_match n on n.table_name = t.table_name
  where coalesce(n.is_nutrition_related, false)
)
select
  table_name,
  is_nutrition_related,
  case when guard_column = 'none' then 'public_or_system' else 'user_owned' end as table_class,
  guard_column,
  rls_enabled
from scope
order by table_name;

-- =========================================================
-- SECTION B: Final per-table verdict (PASS/FAIL) nutrition-only
-- =========================================================
with explicit_tables as (
  select unnest(array[
    'food_diary_entries',
    'meal_entry_notes',
    'foods',
    'food_aliases',
    'favorite_products',
    'food_import_batches',
    'food_import_conflicts',
    'food_import_staging',
    'recipes',
    'recipe_notes',
    'favorite_recipes',
    'recipe_collections'
  ])::text as table_name
),
public_tables as (
  select c.oid, c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
col_flags as (
  select
    t.table_name,
    bool_or(a.attname = 'user_id' and at.typname = 'uuid') as has_user_id_uuid,
    bool_or(a.attname = 'created_by_user_id' and at.typname = 'uuid') as has_created_by_user_id_uuid
  from public_tables t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  join pg_type at on at.oid = a.atttypid
  group by t.table_name
),
name_match as (
  select
    t.table_name,
    (
      t.table_name in (select table_name from explicit_tables)
      or position('food_' in t.table_name) = 1
      or position('meal_' in t.table_name) = 1
      or position('recipe_' in t.table_name) = 1
      or position('recipes_' in t.table_name) = 1
      or position('favorite_' in t.table_name) = 1
      or position('food_ingestion_' in t.table_name) = 1
      or position('recipes_relations_' in t.table_name) = 1
    ) as is_nutrition_related
  from public_tables t
),
scope as (
  select
    t.table_name,
    t.rls_enabled,
    case
      when coalesce(c.has_user_id_uuid, false) then 'user_id'
      when coalesce(c.has_created_by_user_id_uuid, false) then 'created_by_user_id'
      else 'none'
    end as guard_column
  from public_tables t
  left join col_flags c on c.table_name = t.table_name
  left join name_match n on n.table_name = t.table_name
  where coalesce(n.is_nutrition_related, false)
),
policy_rows as (
  select
    p.tablename as table_name,
    p.cmd,
    lower(translate(coalesce(p.qual, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as qual_norm,
    lower(translate(coalesce(p.with_check, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as with_check_norm,
    lower(coalesce(array_to_string(p.roles, ','), '')) as roles_norm
  from pg_policies p
  where p.schemaname = 'public'
),
policies as (
  select
    r.table_name,
    count(*) as policies_count,
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
),
final_eval as (
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
    array_remove(array[
      case when not s.rls_enabled then 'rls_disabled' end,
      case when coalesce(p.policies_count, 0) = 0 then 'no_policies' end,
      case when not coalesce(p.has_select, false) then 'missing_select_policy' end,
      case when s.guard_column <> 'none' and not coalesce(p.has_insert, false) then 'missing_insert_policy_for_user_owned' end,
      case when s.guard_column <> 'none' and not coalesce(p.has_update, false) then 'missing_update_policy_for_user_owned' end,
      case when s.guard_column <> 'none' and not coalesce(p.has_delete, false) then 'missing_delete_policy_for_user_owned' end,
      case when s.guard_column <> 'none' and not coalesce(p.has_owner_guard, false) then 'missing_auth_uid_owner_guard' end
    ], null) as issues,
    case
      when not s.rls_enabled then 'FAIL'
      when coalesce(p.policies_count, 0) = 0 then 'FAIL'
      when not coalesce(p.has_select, false) then 'FAIL'
      when s.guard_column <> 'none' and (
        not coalesce(p.has_insert, false)
        or not coalesce(p.has_update, false)
        or not coalesce(p.has_delete, false)
        or not coalesce(p.has_owner_guard, false)
      ) then 'FAIL'
      else 'PASS'
    end as verdict
  from scope s
  left join policies p on p.table_name = s.table_name
)
select
  table_name,
  rls_enabled,
  policies_count,
  has_select,
  has_insert,
  has_update,
  has_delete,
  has_owner_guard,
  guard_column,
  issues,
  verdict
from final_eval
order by table_name;

-- =========================================================
-- SECTION C: Public-catalog diagnostics (nutrition-only)
-- =========================================================
with explicit_tables as (
  select unnest(array[
    'food_diary_entries',
    'meal_entry_notes',
    'foods',
    'food_aliases',
    'favorite_products',
    'food_import_batches',
    'food_import_conflicts',
    'food_import_staging',
    'recipes',
    'recipe_notes',
    'favorite_recipes',
    'recipe_collections'
  ])::text as table_name
),
public_tables as (
  select c.oid, c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
col_flags as (
  select
    t.table_name,
    bool_or(a.attname = 'user_id' and at.typname = 'uuid') as has_user_id_uuid,
    bool_or(a.attname = 'created_by_user_id' and at.typname = 'uuid') as has_created_by_user_id_uuid
  from public_tables t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  join pg_type at on at.oid = a.atttypid
  group by t.table_name
),
nutrition_scope as (
  select
    t.table_name,
    case
      when coalesce(c.has_user_id_uuid, false) then 'user_id'
      when coalesce(c.has_created_by_user_id_uuid, false) then 'created_by_user_id'
      else 'none'
    end as guard_column,
    (
      t.table_name in (select table_name from explicit_tables)
      or position('food_' in t.table_name) = 1
      or position('meal_' in t.table_name) = 1
      or position('recipe_' in t.table_name) = 1
      or position('recipes_' in t.table_name) = 1
      or position('favorite_' in t.table_name) = 1
      or position('food_ingestion_' in t.table_name) = 1
      or position('recipes_relations_' in t.table_name) = 1
    ) as is_nutrition_related
  from public_tables t
  left join col_flags c on c.table_name = t.table_name
),
policy_rows as (
  select
    p.tablename as table_name,
    p.cmd,
    lower(translate(coalesce(p.qual, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as qual_norm,
    lower(translate(coalesce(p.with_check, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as with_check_norm,
    lower(coalesce(array_to_string(p.roles, ','), '')) as roles_norm
  from pg_policies p
  where p.schemaname = 'public'
)
select
  s.table_name,
  case when s.guard_column = 'none' then 'public_only' else 'user_owned' end as table_class,
  s.guard_column,
  exists(
    select 1
    from policy_rows p
    where p.table_name = s.table_name
      and p.cmd in ('SELECT', '*')
      and (p.roles_norm like '%authenticated%' or p.roles_norm like '%public%')
      and not (
        p.qual_norm like '%auth.uid()=user_id%'
        or p.qual_norm like '%user_id=auth.uid()%'
        or p.qual_norm like '%auth.uid()=created_by_user_id%'
        or p.qual_norm like '%created_by_user_id=auth.uid()%'
      )
  ) as has_select_for_authenticated_without_owner_guard,
  exists(
    select 1
    from policy_rows p
    where p.table_name = s.table_name
      and (
        p.qual_norm like '%auth.uid()=created_by_user_id%'
        or p.qual_norm like '%created_by_user_id=auth.uid()%'
        or p.with_check_norm like '%auth.uid()=created_by_user_id%'
        or p.with_check_norm like '%created_by_user_id=auth.uid()%'
      )
  ) as has_owner_guard_on_created_by_user_id
from nutrition_scope s
where s.is_nutrition_related
order by s.table_name;

-- =========================================================
-- SECTION D: Summary (nutrition-only)
-- =========================================================
with explicit_tables as (
  select unnest(array[
    'food_diary_entries',
    'meal_entry_notes',
    'foods',
    'food_aliases',
    'favorite_products',
    'food_import_batches',
    'food_import_conflicts',
    'food_import_staging',
    'recipes',
    'recipe_notes',
    'favorite_recipes',
    'recipe_collections'
  ])::text as table_name
),
public_tables as (
  select c.oid, c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
col_flags as (
  select
    t.table_name,
    bool_or(a.attname = 'user_id' and at.typname = 'uuid') as has_user_id_uuid,
    bool_or(a.attname = 'created_by_user_id' and at.typname = 'uuid') as has_created_by_user_id_uuid
  from public_tables t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  join pg_type at on at.oid = a.atttypid
  group by t.table_name
),
name_match as (
  select
    t.table_name,
    (
      t.table_name in (select table_name from explicit_tables)
      or position('food_' in t.table_name) = 1
      or position('meal_' in t.table_name) = 1
      or position('recipe_' in t.table_name) = 1
      or position('recipes_' in t.table_name) = 1
      or position('favorite_' in t.table_name) = 1
      or position('food_ingestion_' in t.table_name) = 1
      or position('recipes_relations_' in t.table_name) = 1
    ) as is_nutrition_related
  from public_tables t
),
scope as (
  select
    t.table_name,
    t.rls_enabled,
    case
      when coalesce(c.has_user_id_uuid, false) then 'user_id'
      when coalesce(c.has_created_by_user_id_uuid, false) then 'created_by_user_id'
      else 'none'
    end as guard_column
  from public_tables t
  left join col_flags c on c.table_name = t.table_name
  left join name_match n on n.table_name = t.table_name
  where coalesce(n.is_nutrition_related, false)
),
policy_rows as (
  select
    p.tablename as table_name,
    p.cmd,
    lower(translate(coalesce(p.qual, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as qual_norm,
    lower(translate(coalesce(p.with_check, ''), ' ' || chr(10) || chr(9) || chr(13), '')) as with_check_norm
  from pg_policies p
  where p.schemaname = 'public'
),
policies as (
  select
    r.table_name,
    count(*) as policies_count,
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
),
final_eval as (
  select
    s.table_name,
    case
      -- RLS должен быть включён всегда
      when not s.rls_enabled then 'FAIL'

      -- Для user_owned таблиц — строгая проверка
      when s.guard_column <> 'none' and (
        coalesce(p.policies_count, 0) = 0
        or not coalesce(p.has_select, false)
        or not coalesce(p.has_insert, false)
        or not coalesce(p.has_update, false)
        or not coalesce(p.has_delete, false)
        or not coalesce(p.has_owner_guard, false)
      ) then 'FAIL'

      -- Для public_or_system таблиц достаточно RLS enabled
      else 'PASS'
    end as verdict
  from scope s
  left join policies p on p.table_name = s.table_name
)
