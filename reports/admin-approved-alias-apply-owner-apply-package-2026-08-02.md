# Admin-Approved Alias Apply Owner Apply Package

- Timestamp: 2026-08-02T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260802_admin_approved_alias_apply_draft.sql`
- Apply-readiness report: `reports/admin-approved-alias-apply-fixed-draft-apply-readiness-2026-08-02.md`
- Verdict: **ADMIN_APPROVED_ALIAS_APPLY_OWNER_PACKAGE_READY**

## Safety

- Owner apply package only.
- Migration was not applied by Codex.
- Runtime code was not changed.
- Production DB schema was not changed by Codex.
- Storage buckets and policies were not changed by Codex.
- No aliases were added.
- No foods were created.
- No import/backfill/recompute was run.
- No PR was created.

## Expected Unchanged Counts

Capture these counts before apply. After apply, each count must match the pre-apply value exactly:

- `public.foods`
- `public.food_aliases`
- `public.food_search_events`
- `public.food_search_review_queue`
- `public.food_diary_entries`
- `public.favorite_products`
- `public.recipes`
- `public.recipe_ingredients`

Expected data effect:

- `foods`: unchanged.
- `food_aliases`: unchanged.
- `food_search_events`: unchanged.
- `food_search_review_queue`: unchanged count; nullable apply columns added only.
- `food_diary_entries`: unchanged.
- `favorite_products`: unchanged.
- `recipes`: unchanged.
- `recipe_ingredients`: unchanged.
- `food_alias_apply_audit`: new table, expected initial count `0`.

## Exact Pre-Check SQL

Run this before applying the migration:

```sql
-- Admin-approved Alias Apply pre-check
-- Read-only. Do not modify data.

select
  'user_profiles_id_user_exists' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'id_user'
      and udt_name = 'uuid'
  ) as actual,
  true as expected;

select
  'user_profiles_is_admin_exists' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'is_admin'
  ) as actual,
  true as expected;

select
  'normalize_food_text_exists' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'normalize_food_text'
  ) as actual,
  true as expected;

select
  'foods_source_exists' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'foods'
      and column_name = 'source'
  ) as actual,
  true as expected;

select
  'food_search_review_queue_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_search_review_queue'
  ) as actual,
  true as expected;

select
  'food_alias_apply_audit_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_alias_apply_audit'
  ) as actual,
  false as expected;

select
  'apply_admin_approved_food_alias_exists' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_admin_approved_food_alias'
  ) as actual,
  false as expected;

select
  'queue_apply_columns_exist' as check_name,
  count(*) = 0 as actual,
  true as expected,
  array_agg(column_name order by column_name) filter (where column_name is not null) as existing_columns
from information_schema.columns
where table_schema = 'public'
  and table_name = 'food_search_review_queue'
  and column_name in (
    'applied_alias_id',
    'alias_applied_by',
    'alias_applied_at',
    'alias_apply_result',
    'alias_apply_error'
  );

select
  'food_aliases_required_columns_exist' as check_name,
  count(*) = 7 as actual,
  true as expected,
  array_agg(column_name order by column_name) as columns_found
from information_schema.columns
where table_schema = 'public'
  and table_name = 'food_aliases'
  and column_name in (
    'id',
    'canonical_food_id',
    'alias',
    'normalized_alias',
    'source',
    'verified',
    'created_by_user_id'
  );

select
  'food_aliases_normalized_alias_unique_exists' as check_name,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'food_aliases'
      and indexdef ilike '%unique%'
      and indexdef ilike '%normalized_alias%'
  ) as actual,
  true as expected;

select
  'food_aliases_normalize_trigger_exists' as check_name,
  exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'food_aliases'
      and trigger_name = 'food_aliases_normalize_trigger'
  ) as actual,
  true as expected;

select
  'review_queue_alias_auto_trigger_absent' as check_name,
  not exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'food_search_review_queue'
      and lower(action_statement) like '%food_alias%'
  ) as actual,
  true as expected;

select
  'shared_food_sources' as check_name,
  array_agg(distinct source order by source) filter (where source in ('core', 'brand')) as actual,
  array['brand', 'core']::text[] as expected_or_subset
from public.foods
where source in ('core', 'brand');

select 'foods' as table_name, count(*) as row_count from public.foods
union all
select 'food_aliases' as table_name, count(*) as row_count from public.food_aliases
union all
select 'food_search_events' as table_name, count(*) as row_count from public.food_search_events
union all
select 'food_search_review_queue' as table_name, count(*) as row_count from public.food_search_review_queue
union all
select 'food_diary_entries' as table_name, count(*) as row_count from public.food_diary_entries
union all
select 'favorite_products' as table_name, count(*) as row_count from public.favorite_products
union all
select 'recipes' as table_name, count(*) as row_count from public.recipes
union all
select 'recipe_ingredients' as table_name, count(*) as row_count from public.recipe_ingredients
order by table_name;
```

Pre-check expected:

- `user_profiles_id_user_exists = true`
- `user_profiles_is_admin_exists = true`
- `normalize_food_text_exists = true`
- `foods_source_exists = true`
- `food_search_review_queue_exists = true`
- `food_alias_apply_audit_exists = false`
- `apply_admin_approved_food_alias_exists = false`
- `queue_apply_columns_exist = true`
- `food_aliases_required_columns_exist = true`
- `food_aliases_normalized_alias_unique_exists = true`
- `food_aliases_normalize_trigger_exists = true`
- `review_queue_alias_auto_trigger_absent = true`
- `shared_food_sources` includes `core`; `brand` may be absent if no brand rows exist yet, but source value must be allowed by product contract.
- Save every row count for post-check comparison.

## Exact Migration Reference

Apply exactly this reviewed file:

```text
supabase/migration_drafts/20260802_admin_approved_alias_apply_draft.sql
```

Do not edit it in the SQL Editor. Do not bundle it with any other SQL.

The file begins with:

```sql
-- Admin-approved Alias Apply draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
```

The file ends with:

```sql
commit;
```

Approved migration scope:

- create `public.food_alias_apply_audit`;
- add nullable apply tracking columns to `public.food_search_review_queue`;
- add queue apply result checks and indexes;
- add RLS policies for `food_alias_apply_audit`;
- create `public.apply_admin_approved_food_alias(...)`;
- revoke function execute from `public`;
- grant function execute to `authenticated`.

Not approved in this step:

- calling the RPC;
- inserting aliases;
- creating foods;
- enabling runtime UI;
- import/backfill/recompute;
- diary/favorites/recipes changes.

## Exact Post-Check SQL

Run this immediately after applying the migration:

```sql
-- Admin-approved Alias Apply post-check
-- Read-only. Do not call the RPC. Do not insert aliases or foods.

select
  'food_alias_apply_audit_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_alias_apply_audit'
  ) as actual,
  true as expected;

select
  'food_alias_apply_audit_count' as check_name,
  count(*) as actual,
  0 as expected
from public.food_alias_apply_audit;

select
  'queue_apply_columns_exist' as check_name,
  count(*) = 5 as actual,
  true as expected,
  array_agg(column_name order by column_name) as columns_found
from information_schema.columns
where table_schema = 'public'
  and table_name = 'food_search_review_queue'
  and column_name in (
    'applied_alias_id',
    'alias_applied_by',
    'alias_applied_at',
    'alias_apply_result',
    'alias_apply_error'
  );

select
  'apply_admin_approved_food_alias_exists' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_admin_approved_food_alias'
  ) as actual,
  true as expected;

select
  'apply_admin_approved_food_alias_search_path' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_admin_approved_food_alias'
      and array_to_string(p.proconfig, ',') like '%search_path=public, pg_temp%'
  ) as actual,
  true as expected;

select
  'audit_rls_enabled' as check_name,
  rowsecurity as actual,
  true as expected
from pg_tables
where schemaname = 'public'
  and tablename = 'food_alias_apply_audit';

select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'food_alias_apply_audit'
order by policyname;

select
  routine_schema,
  routine_name,
  routine_type,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'apply_admin_approved_food_alias';

select
  n.nspname as schema_name,
  p.proname as function_name,
  r.rolname as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname = 'apply_admin_approved_food_alias';

select
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'apply_admin_approved_food_alias'
order by grantee, privilege_type;

select
  'authenticated_execute_grant' as check_name,
  has_function_privilege(
    'authenticated',
    'public.apply_admin_approved_food_alias(uuid, text, text)',
    'execute'
  ) as actual,
  true as expected;

select
  'public_execute_grant_absent' as check_name,
  not has_function_privilege(
    'public',
    'public.apply_admin_approved_food_alias(uuid, text, text)',
    'execute'
  ) as actual,
  true as expected;

select
  conrelid::regclass::text as table_name,
  conname as constraint_name
from pg_constraint
where conrelid in (
  'public.food_alias_apply_audit'::regclass,
  'public.food_search_review_queue'::regclass
)
  and conname in (
    'food_alias_apply_audit_result_check',
    'food_search_review_queue_alias_apply_result_check',
    'food_search_review_queue_alias_apply_shape_check'
  )
order by table_name, constraint_name;

select
  'result_checks_include_fixed_values' as check_name,
  bool_and(pg_get_constraintdef(oid) like '%invalid_canonical_source%')
    and bool_and(pg_get_constraintdef(oid) like '%missing_source_evidence%') as actual,
  true as expected
from pg_constraint
where conrelid in (
  'public.food_alias_apply_audit'::regclass,
  'public.food_search_review_queue'::regclass
)
  and conname in (
    'food_alias_apply_audit_result_check',
    'food_search_review_queue_alias_apply_result_check'
  );

select
  'review_queue_alias_auto_trigger_absent' as check_name,
  not exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'food_search_review_queue'
      and lower(action_statement) like '%food_alias%'
  ) as actual,
  true as expected;

select 'foods' as table_name, count(*) as row_count from public.foods
union all
select 'food_aliases' as table_name, count(*) as row_count from public.food_aliases
union all
select 'food_search_events' as table_name, count(*) as row_count from public.food_search_events
union all
select 'food_search_review_queue' as table_name, count(*) as row_count from public.food_search_review_queue
union all
select 'food_diary_entries' as table_name, count(*) as row_count from public.food_diary_entries
union all
select 'favorite_products' as table_name, count(*) as row_count from public.favorite_products
union all
select 'recipes' as table_name, count(*) as row_count from public.recipes
union all
select 'recipe_ingredients' as table_name, count(*) as row_count from public.recipe_ingredients
order by table_name;
```

Post-check expected:

- `food_alias_apply_audit_exists = true`
- `food_alias_apply_audit_count = 0`
- `queue_apply_columns_exist = true`
- `apply_admin_approved_food_alias_exists = true`
- `apply_admin_approved_food_alias_search_path = true`
- `audit_rls_enabled = true`
- Policies returned:
  - `food_alias_apply_audit_admin_insert`
  - `food_alias_apply_audit_admin_select`
- Routine security:
  - `SECURITY DEFINER`
- Routine privileges:
  - `authenticated` has `EXECUTE`
  - `PUBLIC` should not have `EXECUTE`
- `authenticated_execute_grant = true`
- `public_execute_grant_absent = true`
- Result checks include:
  - `invalid_canonical_source`
  - `missing_source_evidence`
- `review_queue_alias_auto_trigger_absent = true`
- Existing table counts exactly match pre-check values.
- `food_aliases` count exactly matches pre-check value.
- No aliases inserted by migration.

## Stop Conditions

Stop and do not apply if:

- owner approval is not explicit;
- any pre-check `actual` does not match `expected`, except `shared_food_sources` may omit `brand` if there are no brand rows yet;
- `public.user_profiles.id_user` is missing;
- `public.user_profiles.is_admin` is missing;
- `public.normalize_food_text` is missing;
- `public.foods.source` is missing;
- `public.food_search_review_queue` is missing;
- `public.food_aliases` required columns are missing;
- `public.food_aliases.normalized_alias` unique protection is missing;
- `food_alias_apply_audit` already exists and this is not a controlled retry;
- queue apply columns already exist and this is not a controlled retry;
- `apply_admin_approved_food_alias` already exists and this is not a controlled retry;
- SQL Editor contains any SQL other than the reviewed draft.

Stop after apply if:

- any existing row count changed;
- `food_alias_apply_audit` count is not `0`;
- `food_aliases` count changed;
- any food was created;
- any alias was inserted;
- any diary/favorite/recipe row changed;
- RLS is missing on audit table;
- expected audit policies are missing;
- RPC is missing;
- RPC grant is broader than `authenticated`;
- `PUBLIC` can execute the RPC;
- any trigger can insert aliases from review queue status;
- any import/backfill/recompute was run.

## Final Instruction

Apply only the reviewed Admin-approved Alias Apply DB/RPC draft after explicit owner approval. Do not call the RPC, create aliases, create foods, enable UI, import, backfill, or recompute in the same step.
