# Search Analytics / Admin Review Failed Apply Fix

- Timestamp: 2026-08-01T00:00:00Z
- Failed apply error: `ERROR 42703: column "user_id" does not exist`
- Failed object context: `public.user_profiles`
- Production finding: `public.user_profiles.id_user uuid` exists; `public.user_profiles.user_id` does not exist; `is_admin` exists
- Updated SQL: `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- Updated package: `reports/search-analytics-admin-review-owner-apply-package-2026-08-01.md`
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_SAFE_RETRY_PACKAGE_READY**

## Safety

- Draft/package fix only.
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

## Root Cause

The reviewed draft used the local/source-schema convention:

```sql
public.user_profiles.user_id = auth.uid()
```

Production uses:

```sql
public.user_profiles.id_user = auth.uid()
```

The failure occurred while creating admin RLS policies. Because the migration is wrapped in `begin; ... commit;`, the failed transaction should roll back all objects from the attempt. Still, the owner must run the partial-object check before retry.

## SQL Draft Fix

Admin checks were changed from:

```sql
where user_id = auth.uid()
  and is_admin = true
```

to:

```sql
where id_user = auth.uid()
  and is_admin = true
```

This applies to:

- `food_search_events_admin_all`;
- `food_search_review_queue_admin_all`.

Important distinction:

- `food_search_events.user_id` remains the analytics event owner column.
- Only the admin lookup against `public.user_profiles` changed to `id_user`.

## Exact Partial-Object Check SQL

Run this before retrying the migration:

```sql
-- Search Analytics / Admin Review failed-apply partial object check
-- Read-only.

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

Expected after failed transaction:

- no rows for both new tables;
- no rows for policies;
- no rows for indexes;
- no rows for `update_food_search_review_queue_updated_at`;
- no rows for triggers.

If any partial object exists, stop and prepare a separate cleanup/alignment draft. Do not retry blindly.

## Exact Updated Pre-Check SQL

The owner apply package now checks the production profile identity column:

```sql
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
```

## Safe Retry Order

1. Run the partial-object check.
2. Confirm no partial objects exist.
3. Run the updated pre-check from `reports/search-analytics-admin-review-owner-apply-package-2026-08-01.md`.
4. Confirm:
   - `food_search_events_exists = false`;
   - `food_search_review_queue_exists = false`;
   - `user_profiles_id_user_and_is_admin_exist = true`;
   - `foods_id_is_uuid = true`.
5. Capture unchanged-count baseline.
6. Apply exactly `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`.
7. Run the post-check from the owner package.
8. Confirm existing Food Core/downstream counts are unchanged.

## Manual-Review Contract Preserved

The updated draft still does not write to:

- `public.foods`;
- `public.food_aliases`;
- `public.food_diary_entries`;
- `public.favorite_products`;
- `public.recipes`;
- `public.recipe_ingredients`.

The updated draft still preserves:

- no automatic alias insertion;
- no automatic food creation;
- no silent canonical choice for ambiguous queries;
- admin approval only;
- approved queue status records intent only.

## Final Recommendation

The failed apply cause is fixed in the draft. Retry only after confirming no partial objects remain from the failed transaction and after the updated pre-check passes.
