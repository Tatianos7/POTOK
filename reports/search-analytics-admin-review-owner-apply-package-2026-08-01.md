# Search Analytics / Admin Review Owner Apply Package

- Timestamp: 2026-08-01T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- Apply-readiness report: `reports/search-analytics-admin-review-fixed-sql-apply-readiness-2026-08-01.md`
- Retry fix: `reports/search-analytics-admin-review-failed-apply-fix-2026-08-01.md`
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_OWNER_RETRY_PACKAGE_READY**

## Safety

- Owner apply package only.
- Migration was not applied by Codex.
- Runtime code was not changed.
- Production DB schema was not changed by Codex.
- Storage buckets and policies were not changed by Codex.
- No import/backfill/recompute was run.
- No Food Core import was run.
- No aliases were added.
- No foods were created.
- Recipes, nutrition, workouts, progress, and auth were not changed.
- No PR was created.

## Expected Unchanged Counts

Capture these exact counts before apply. After apply, each count must match the pre-apply value exactly:

- `public.foods`
- `public.food_aliases`
- `public.food_diary_entries`
- `public.favorite_products`
- `public.recipes`
- `public.recipe_ingredients`

Expected data effect:

- `foods`: unchanged.
- `food_aliases`: unchanged.
- `food_diary_entries`: unchanged.
- `favorite_products`: unchanged.
- `recipes`: unchanged.
- `recipe_ingredients`: unchanged.
- `food_search_events`: new table, expected initial count `0`.
- `food_search_review_queue`: new table, expected initial count `0`.

## Exact Partial-Object Check SQL

Run this before the retry because the first owner apply failed inside the transaction:

```sql
-- Search Analytics / Admin Review failed-apply partial object check
-- Read-only. Do not modify data.

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('food_search_events', 'food_search_review_queue')
order by table_name;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('food_search_events', 'food_search_review_queue')
order by tablename, policyname;

select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('food_search_events', 'food_search_review_queue')
order by tablename, indexname;

select
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'update_food_search_review_queue_updated_at'
order by function_name;

select
  event_object_schema,
  event_object_table,
  trigger_name
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('food_search_events', 'food_search_review_queue')
order by event_object_table, trigger_name;
```

Partial-object check expected:

- no rows for both new tables;
- no rows for policies;
- no rows for indexes;
- no rows for `update_food_search_review_queue_updated_at`;
- no rows for triggers.

If any partial object exists, stop and prepare a separate cleanup/alignment draft before retrying.

## Exact Pre-Check SQL

Run this before applying the migration:

```sql
-- Search Analytics / Admin Review pre-check
-- Read-only. Do not modify data.

select
  'food_search_events_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_search_events'
  ) as actual,
  false as expected;

select
  'food_search_review_queue_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_search_review_queue'
  ) as actual,
  false as expected;

select
  'user_profiles_id_user_and_is_admin_exist' as check_name,
  exists (
    select 1
    from information_schema.columns id_col
    join information_schema.columns admin_col
      on admin_col.table_schema = id_col.table_schema
      and admin_col.table_name = id_col.table_name
    where id_col.table_schema = 'public'
      and id_col.table_name = 'user_profiles'
      and id_col.column_name = 'id_user'
      and id_col.udt_name = 'uuid'
      and admin_col.column_name = 'is_admin'
  ) as actual,
  true as expected;

select
  'foods_id_is_uuid' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'foods'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) as actual,
  true as expected;

select 'foods' as table_name, count(*) as row_count from public.foods
union all
select 'food_aliases' as table_name, count(*) as row_count from public.food_aliases
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

- `food_search_events_exists = false`
- `food_search_review_queue_exists = false`
- `user_profiles_id_user_and_is_admin_exist = true`
- `foods_id_is_uuid = true`
- Save the six existing table counts for post-check comparison.

## Exact Migration SQL

Apply exactly this reviewed file:

```text
supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql
```

Do not edit it in the SQL Editor. Do not bundle it with any other SQL.

The file begins with:

```sql
-- Search Analytics / Admin Review draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
```

The file ends with:

```sql
commit;
```

Approved migration scope:

- create `public.food_search_events`;
- create `public.food_search_review_queue`;
- add indexes and RLS policies for those two tables;
- add updated-at trigger only for `food_search_review_queue`;
- no writes to `public.foods`;
- no writes to `public.food_aliases`;
- no import/backfill/recompute.

## Exact Post-Check SQL

Run this immediately after applying the migration:

```sql
-- Search Analytics / Admin Review post-check
-- Read-only. Do not insert aliases, foods, diary rows, favorites, recipes, or review rows.

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('food_search_events', 'food_search_review_queue')
order by table_name;

select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('food_search_events', 'food_search_review_queue')
order by tablename;

select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('food_search_events', 'food_search_review_queue')
order by tablename, policyname;

select
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('food_search_events', 'food_search_review_queue')
order by tablename, indexname;

select
  conrelid::regclass::text as table_name,
  conname as constraint_name,
  contype as constraint_type
from pg_constraint
where conrelid in (
  'public.food_search_events'::regclass,
  'public.food_search_review_queue'::regclass
)
order by table_name, constraint_name;

select 'food_search_events' as table_name, count(*) as row_count from public.food_search_events
union all
select 'food_search_review_queue' as table_name, count(*) as row_count from public.food_search_review_queue
order by table_name;

select 'foods' as table_name, count(*) as row_count from public.foods
union all
select 'food_aliases' as table_name, count(*) as row_count from public.food_aliases
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

- Tables returned:
  - `food_search_events`
  - `food_search_review_queue`
- RLS:
  - `food_search_events.rowsecurity = true`
  - `food_search_review_queue.rowsecurity = true`
- Policies returned:
  - `food_search_events_admin_all`
  - `food_search_events_insert_own`
  - `food_search_events_select_own`
  - `food_search_review_queue_admin_all`
- New table counts:
  - `food_search_events = 0`
  - `food_search_review_queue = 0`
- Existing table counts:
  - must exactly match the pre-check values for `foods`;
  - must exactly match the pre-check values for `food_aliases`;
  - must exactly match the pre-check values for `food_diary_entries`;
  - must exactly match the pre-check values for `favorite_products`;
  - must exactly match the pre-check values for `recipes`;
  - must exactly match the pre-check values for `recipe_ingredients`.

## Stop Conditions

Stop and do not apply if:

- any partial object from the failed apply exists;
- either new table already exists;
- `public.user_profiles.id_user` is missing or not UUID;
- `public.user_profiles.is_admin` is missing;
- `public.foods.id` is not UUID;
- pre-check count queries fail;
- the SQL Editor contains any additional SQL not from the reviewed draft.

Stop after apply if:

- any existing table count changed;
- any alias was inserted;
- any food was created;
- any diary/favorite/recipe row changed;
- any import/backfill/recompute was run;
- RLS or expected policies are missing.

## Final Instruction

Apply only the reviewed Search Analytics/Admin Review migration after explicit owner approval. Do not enable runtime logging, do not create aliases, do not create foods, and do not run import/backfill/recompute in the same step.
