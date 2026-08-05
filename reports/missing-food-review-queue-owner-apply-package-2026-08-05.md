# Missing Food Review Queue Owner Apply Package

- Timestamp: 2026-08-05T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260805_missing_food_review_queue_draft.sql`
- Apply-readiness report: `reports/missing-food-review-queue-db-draft-review-2026-08-05.md`
- Verdict: **MISSING_FOOD_REVIEW_QUEUE_OWNER_PACKAGE_READY**

## Safety

- Owner apply package only.
- Migration was not applied by Codex.
- Production DB schema was not changed by Codex.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- RPC was not called.
- No foods were created.
- No aliases were added.
- No import/backfill/recompute was run.
- No PR was created.

## Expected Unchanged Counts

Capture these counts before apply. After apply, each count must match the pre-apply value exactly:

- `public.foods`
- `public.food_aliases`
- `public.food_search_events`
- `public.food_search_review_queue`
- `public.food_alias_apply_audit`
- `public.food_diary_entries`
- `public.favorite_products`
- `public.recipes`
- `public.recipe_ingredients`

Expected data effect:

- `foods`: unchanged.
- `food_aliases`: unchanged.
- `food_search_events`: unchanged.
- `food_search_review_queue`: unchanged.
- `food_alias_apply_audit`: unchanged.
- `food_diary_entries`: unchanged.
- `favorite_products`: unchanged.
- `recipes`: unchanged.
- `recipe_ingredients`: unchanged.
- `food_missing_review_queue`: new table, expected initial count `0`.

## Exact Pre-Check SQL

Run this before applying the migration:

```sql
-- Missing Food Review Queue pre-check
-- Read-only. Do not modify data.

select
  'food_missing_review_queue_absent' as check_name,
  not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_missing_review_queue'
  ) as actual,
  true as expected;

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
  'food_search_events_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_search_events'
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
  true as expected;

select
  'unexpected_missing_queue_objects_absent' as check_name,
  not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'food_missing_review_queue'
  )
  and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'food_missing_review_queue'
  )
  and not exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'food_missing_review_queue'
  )
  and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'update_food_missing_review_queue_updated_at'
  ) as actual,
  true as expected;

select
  'missing_queue_no_food_write_functions_exist' as check_name,
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ilike '%missing%food%'
      and (
        pg_get_functiondef(p.oid) ilike '%insert into public.foods%'
        or pg_get_functiondef(p.oid) ilike '%update public.foods%'
        or pg_get_functiondef(p.oid) ilike '%delete from public.foods%'
        or pg_get_functiondef(p.oid) ilike '%insert into public.food_aliases%'
        or pg_get_functiondef(p.oid) ilike '%update public.food_aliases%'
        or pg_get_functiondef(p.oid) ilike '%delete from public.food_aliases%'
      )
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
select 'food_alias_apply_audit' as table_name, count(*) as row_count from public.food_alias_apply_audit
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

- `food_missing_review_queue_absent = true`
- `user_profiles_id_user_exists = true`
- `user_profiles_is_admin_exists = true`
- `food_search_events_exists = true`
- `food_search_review_queue_exists = true`
- `food_alias_apply_audit_exists = true`
- `unexpected_missing_queue_objects_absent = true`
- `missing_queue_no_food_write_functions_exist = true`
- Save every row count for post-check comparison.

## Exact Migration Reference

Apply exactly this reviewed file:

```text
supabase/migration_drafts/20260805_missing_food_review_queue_draft.sql
```

Do not edit it in the SQL Editor. Do not bundle it with any other SQL.

The file begins with:

```sql
-- Missing Food Review queue draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
```

The file ends with:

```sql
commit;
```

Approved migration scope:

- create `public.food_missing_review_queue`;
- add indexes for review/admin scans;
- add updated-at trigger only for `food_missing_review_queue`;
- enable RLS;
- add one admin-only policy using `user_profiles.id_user`;
- no writes to `public.foods`;
- no writes to `public.food_aliases`;
- no import/backfill/recompute.

## Exact Post-Check SQL

Run this immediately after applying the migration:

```sql
-- Missing Food Review Queue post-check
-- Read-only. Do not insert foods, aliases, search events, queue rows, diary rows, favorites, or recipes.

select
  'food_missing_review_queue_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_missing_review_queue'
  ) as actual,
  true as expected;

select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'food_missing_review_queue'
order by ordinal_position;

select
  'food_missing_review_queue_expected_columns' as check_name,
  count(*) = 17 as actual,
  true as expected,
  array_agg(column_name order by column_name) as columns_found
from information_schema.columns
where table_schema = 'public'
  and table_name = 'food_missing_review_queue'
  and column_name in (
    'id',
    'query',
    'normalized_query',
    'context',
    'frequency',
    'classification',
    'status',
    'source_event_ids',
    'suggested_name',
    'suggested_category',
    'suggested_source',
    'reviewer_id',
    'reviewed_at',
    'comment',
    'metadata',
    'created_at',
    'updated_at'
  );

select
  'food_missing_review_queue_rls_enabled' as check_name,
  rowsecurity as actual,
  true as expected
from pg_tables
where schemaname = 'public'
  and tablename = 'food_missing_review_queue';

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'food_missing_review_queue'
order by policyname;

select
  'food_missing_review_queue_admin_policy_only' as check_name,
  count(*) = 1
  and bool_and(policyname = 'food_missing_review_queue_admin_all')
  and bool_and(cmd = 'ALL')
  and bool_and(qual ilike '%id_user = auth.uid()%')
  and bool_and(with_check ilike '%id_user = auth.uid()%') as actual,
  true as expected
from pg_policies
where schemaname = 'public'
  and tablename = 'food_missing_review_queue';

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'food_missing_review_queue'
order by indexname;

select
  'food_missing_review_queue_expected_indexes' as check_name,
  count(*) filter (
    where indexname in (
      'food_missing_review_queue_pkey',
      'food_missing_review_queue_status_created_at_idx',
      'food_missing_review_queue_normalized_query_idx',
      'food_missing_review_queue_classification_status_idx',
      'food_missing_review_queue_frequency_idx',
      'food_missing_review_queue_context_idx',
      'food_missing_review_queue_source_event_ids_idx',
      'food_missing_review_queue_pending_unique_idx'
    )
  ) = 8 as actual,
  true as expected,
  array_agg(indexname order by indexname) filter (
    where indexname in (
      'food_missing_review_queue_pkey',
      'food_missing_review_queue_status_created_at_idx',
      'food_missing_review_queue_normalized_query_idx',
      'food_missing_review_queue_classification_status_idx',
      'food_missing_review_queue_frequency_idx',
      'food_missing_review_queue_context_idx',
      'food_missing_review_queue_source_event_ids_idx',
      'food_missing_review_queue_pending_unique_idx'
    )
  ) as indexes_found
from pg_indexes
where schemaname = 'public'
  and tablename = 'food_missing_review_queue';

select
  conname,
  pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conrelid = 'public.food_missing_review_queue'::regclass
order by conname;

select
  trigger_name,
  event_manipulation,
  action_timing,
  event_object_table,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'food_missing_review_queue'
order by trigger_name;

select
  'updated_at_trigger_only_on_missing_queue' as check_name,
  count(*) = 1
  and bool_and(trigger_name = 'update_food_missing_review_queue_updated_at')
  and bool_and(event_object_table = 'food_missing_review_queue') as actual,
  true as expected
from information_schema.triggers
where event_object_schema = 'public'
  and trigger_name = 'update_food_missing_review_queue_updated_at';

select
  'missing_queue_no_food_write_triggers' as check_name,
  not exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'food_missing_review_queue'
      and (
        lower(action_statement) like '%food_alias%'
        or lower(action_statement) like '%public.foods%'
      )
  ) as actual,
  true as expected;

select
  'missing_queue_no_food_write_functions' as check_name,
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ilike '%missing%food%'
      and (
        pg_get_functiondef(p.oid) ilike '%insert into public.foods%'
        or pg_get_functiondef(p.oid) ilike '%update public.foods%'
        or pg_get_functiondef(p.oid) ilike '%delete from public.foods%'
        or pg_get_functiondef(p.oid) ilike '%insert into public.food_aliases%'
        or pg_get_functiondef(p.oid) ilike '%update public.food_aliases%'
        or pg_get_functiondef(p.oid) ilike '%delete from public.food_aliases%'
      )
  ) as actual,
  true as expected;

select 'food_missing_review_queue' as table_name, count(*) as row_count from public.food_missing_review_queue
union all
select 'foods' as table_name, count(*) as row_count from public.foods
union all
select 'food_aliases' as table_name, count(*) as row_count from public.food_aliases
union all
select 'food_search_events' as table_name, count(*) as row_count from public.food_search_events
union all
select 'food_search_review_queue' as table_name, count(*) as row_count from public.food_search_review_queue
union all
select 'food_alias_apply_audit' as table_name, count(*) as row_count from public.food_alias_apply_audit
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

- `food_missing_review_queue_exists = true`
- All 17 expected columns are present.
- `food_missing_review_queue_rls_enabled = true`
- Exactly one policy exists for the table:
  - `food_missing_review_queue_admin_all`
- Policy is admin-only and uses `id_user = auth.uid()`.
- Expected indexes exist.
- Constraints exist for context, classification, status, frequency, blank text, reviewed state, and `approved_for_food_draft` shape.
- `updated_at_trigger_only_on_missing_queue = true`
- `missing_queue_no_food_write_triggers = true`
- `missing_queue_no_food_write_functions = true`
- `food_missing_review_queue = 0`
- All pre-existing counts match the saved pre-apply counts exactly.

## Stop Conditions

Stop before apply if any pre-check differs from expected:

- `food_missing_review_queue_absent` is not `true`;
- `user_profiles.id_user` is missing or not UUID;
- `user_profiles.is_admin` is missing;
- `food_search_events` is missing;
- `food_search_review_queue` is missing;
- `food_alias_apply_audit` is missing;
- unexpected partial `food_missing_review_queue` objects exist;
- any missing-food function already writes to `foods` or `food_aliases`;
- any bundled SQL contains food creation, alias creation, import, backfill, or recompute;
- owner approval is not explicit.

Stop after apply and investigate if:

- `food_missing_review_queue` does not exist;
- table count is not `0`;
- RLS is not enabled;
- non-admin policies exist;
- expected admin policy is missing or does not use `id_user = auth.uid()`;
- expected indexes or constraints are missing;
- updated-at trigger appears on any table other than `food_missing_review_queue`;
- any trigger/function writes to `foods` or `food_aliases`;
- any unchanged count differs from pre-apply;
- any foods or aliases were inserted.

## Final Instruction

Apply only the reviewed migration file after explicit owner approval. Do not create foods, create aliases, call RPCs, import, backfill, recompute, or bundle runtime changes in the same step.
