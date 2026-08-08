# Missing Food Drafts DB Draft

- Timestamp: 2026-08-08T00:00:00Z
- Basis: `reports/missing-food-draft-foundation-design-2026-08-07.md`
- Draft SQL: `supabase/migration_drafts/20260808_missing_food_drafts_draft.sql`
- Scope: DB draft for draft-only missing-food preparation before any production food creation
- Verdict: **MISSING_FOOD_DRAFTS_DB_DRAFT_READY**

## Safety

- Draft files only.
- Migration was not applied.
- Production DB schema was not changed.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- RPC was not called.
- No foods were created.
- No aliases were added.
- No writes were made to `foods` or `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## MVP Decisions

The draft follows the approved MVP constraints:

- `source` is initially `core` only.
- `unit` is initially `g` only.
- `barcode` is nullable and inactive in this MVP.
- `brand` is inactive in this MVP.
- `data_source` is free text.
- `source_event_ids` are not copied; evidence is linked through `source_review_id`.

## Draft Summary

The draft creates one table:

- `public.food_missing_food_drafts`

It references:

- `public.food_missing_review_queue(id)`
- `auth.users(id)` for reviewer/preparer/apply tracking
- `public.foods(id)` only for optional future `applied_food_id` tracking

It does not:

- insert into `public.foods`;
- update `public.foods`;
- delete from `public.foods`;
- insert into `public.food_aliases`;
- call Alias Apply RPC;
- create triggers from draft status to Food Core;
- backfill diary/favorites/recipes;
- recompute nutrition snapshots.

## Table Contract

Draft identity/review fields:

- `source_review_id`
- `query`
- `normalized_query`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Draft food fields:

- `name`
- `normalized_name`
- `category`
- `source`
- `brand`
- `barcode`
- `unit`

Nutrition fields:

- `calories`
- `protein`
- `fat`
- `carbs`
- `fiber`

Provenance/reviewer fields:

- `data_source`
- `source_url`
- `source_notes`
- `reviewer_notes`
- `prepared_by`
- `prepared_at`
- `reviewed_by`
- `reviewed_at`

Future apply tracking fields:

- `applied_food_id`
- `applied_by`
- `applied_at`

The apply tracking fields are inert in this draft. No function or trigger populates them.

## Status Contract

Allowed statuses:

- `draft`
- `needs_revision`
- `ready_for_owner_apply`
- `rejected`
- `applied`

`ready_for_owner_apply` and `applied` require a complete draft:

- non-blank `name`;
- non-blank `normalized_name`;
- non-blank `category`;
- `source = 'core'`;
- `unit = 'g'`;
- non-null calories/protein/fat/carbs;
- non-blank `data_source`;
- `prepared_by` and `prepared_at`;
- `reviewed_by` and `reviewed_at`.

`applied` requires:

- `applied_food_id`;
- `applied_by`;
- `applied_at`.

Non-applied statuses require apply tracking fields to remain null.

## Nutrition Constraints

The draft enforces:

- `calories >= 0 and calories <= 1000`
- `protein >= 0 and protein <= 100`
- `fat >= 0 and fat <= 100`
- `carbs >= 0 and carbs <= 100`
- `fiber is null or fiber >= 0 and fiber <= 100`

Fiber is nullable:

- `fiber = null` means unknown/unprovided.
- `fiber = 0` means confirmed zero.

No macro-sum constraint is added in this draft because some data sources include fiber inside carbohydrate totals. Cross-field nutrition sanity checks should be part of the future owner apply package.

## Normalization Contract

The draft stores both:

- `name`
- `normalized_name`

When both are present, the draft requires:

```sql
normalized_name = public.normalize_food_text(name)
```

This keeps future owner apply checks aligned with current Food Core search/identity behavior.

## RLS Contract

The table is admin-only for all operations.

Admin detection uses the production-correct identity column:

```sql
exists (
  select 1
  from public.user_profiles
  where id_user = auth.uid()
    and is_admin = true
)
```

No non-admin policy is defined.

## Indexes

The draft adds:

- `food_missing_food_drafts_source_review_id_idx`
- `food_missing_food_drafts_status_updated_at_idx`
- `food_missing_food_drafts_normalized_name_idx`
- `food_missing_food_drafts_source_idx`
- `food_missing_food_drafts_applied_food_id_idx`

No unique food-identity index is added in the draft table. Duplicate food-name checks should be pre-apply validation against `public.foods`, not a premature draft-table global uniqueness rule.

## Updated-At Trigger

The draft adds:

- `public.update_food_missing_food_drafts_updated_at()`
- trigger `update_food_missing_food_drafts_updated_at`

Trigger scope:

- only `public.food_missing_food_drafts`;
- updates only `updated_at`;
- does not write `foods`;
- does not write `food_aliases`.

## Exact Pre-Check SQL

Run before any future apply:

```sql
-- Missing Food Drafts pre-check
-- Read-only. Do not modify data.

select
  'food_missing_food_drafts_absent' as check_name,
  not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_missing_food_drafts'
  ) as actual,
  true as expected;

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
      and pg_get_function_arguments(p.oid) = 'value text'
  ) as actual,
  true as expected;

select
  'foods_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'foods'
  ) as actual,
  true as expected;

select
  'food_aliases_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_aliases'
  ) as actual,
  true as expected;

select
  'unexpected_draft_objects_absent' as check_name,
  not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'food_missing_food_drafts'
  )
  and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'food_missing_food_drafts'
  )
  and not exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'food_missing_food_drafts'
  )
  and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'update_food_missing_food_drafts_updated_at'
  ) as actual,
  true as expected;

select
  'draft_functions_do_not_write_food_core' as check_name,
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ilike '%missing%food%draft%'
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
select 'food_missing_review_queue' as table_name, count(*) as row_count from public.food_missing_review_queue
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

- every boolean check returns `actual = expected`;
- save all row counts for post-check comparison.

## Exact Migration Reference

Apply exactly this draft only after owner approval and apply-readiness review:

```text
supabase/migration_drafts/20260808_missing_food_drafts_draft.sql
```

Do not bundle it with food creation SQL, alias SQL, imports, backfills, recomputes, or runtime changes.

## Exact Post-Check SQL

Run after a future approved apply:

```sql
-- Missing Food Drafts post-check
-- Read-only. Do not modify data.

select
  'food_missing_food_drafts_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_missing_food_drafts'
  ) as actual,
  true as expected;

select
  'food_missing_food_drafts_count' as check_name,
  (select count(*) from public.food_missing_food_drafts) as actual,
  0 as expected;

select
  'expected_columns_present' as check_name,
  count(*) as actual,
  31 as expected
from information_schema.columns
where table_schema = 'public'
  and table_name = 'food_missing_food_drafts'
  and column_name in (
    'id',
    'source_review_id',
    'query',
    'normalized_query',
    'name',
    'normalized_name',
    'category',
    'source',
    'brand',
    'barcode',
    'calories',
    'protein',
    'fat',
    'carbs',
    'fiber',
    'unit',
    'data_source',
    'source_url',
    'source_notes',
    'reviewer_notes',
    'status',
    'prepared_by',
    'prepared_at',
    'reviewed_by',
    'reviewed_at',
    'applied_food_id',
    'applied_by',
    'applied_at',
    'metadata',
    'created_at',
    'updated_at'
  );

select
  'rls_enabled' as check_name,
  relrowsecurity as actual,
  true as expected
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'food_missing_food_drafts';

select
  'admin_policy_exists' as check_name,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'food_missing_food_drafts'
      and policyname = 'food_missing_food_drafts_admin_all'
      and cmd = 'ALL'
  ) as actual,
  true as expected;

select
  'no_non_admin_policies' as check_name,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'food_missing_food_drafts'
      and policyname <> 'food_missing_food_drafts_admin_all'
  ) as actual,
  true as expected;

select
  'expected_indexes_present' as check_name,
  count(*) as actual,
  5 as expected
from pg_indexes
where schemaname = 'public'
  and tablename = 'food_missing_food_drafts'
  and indexname in (
    'food_missing_food_drafts_source_review_id_idx',
    'food_missing_food_drafts_status_updated_at_idx',
    'food_missing_food_drafts_normalized_name_idx',
    'food_missing_food_drafts_source_idx',
    'food_missing_food_drafts_applied_food_id_idx'
  );

select
  'updated_at_trigger_only_on_drafts' as check_name,
  count(*) as actual,
  1 as expected
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'update_food_missing_food_drafts_updated_at'
  and event_object_schema = 'public'
  and event_object_table = 'food_missing_food_drafts';

select
  'no_draft_triggers_write_food_core' as check_name,
  not exists (
    select 1
    from information_schema.triggers
    where trigger_schema = 'public'
      and event_object_table = 'food_missing_food_drafts'
      and (
        lower(action_statement) like '%public.foods%'
        or lower(action_statement) like '%public.food_aliases%'
      )
  ) as actual,
  true as expected;

select
  'draft_functions_do_not_write_food_core' as check_name,
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ilike '%missing%food%draft%'
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
select 'food_missing_review_queue' as table_name, count(*) as row_count from public.food_missing_review_queue
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

- `food_missing_food_drafts` exists.
- `food_missing_food_drafts` count is `0`.
- 31 expected columns exist.
- RLS is enabled.
- Admin-only policy exists.
- Expected indexes exist.
- Updated-at trigger exists only on `food_missing_food_drafts`.
- No trigger/function writes to `foods` or `food_aliases`.
- Existing counts match the saved pre-apply counts exactly.
- No foods were created.
- No aliases were added.

## Expected Unchanged Counts

After applying this draft later, these must remain unchanged from pre-check:

- `foods`
- `food_aliases`
- `food_search_events`
- `food_search_review_queue`
- `food_alias_apply_audit`
- `food_missing_review_queue`
- `food_diary_entries`
- `favorite_products`
- `recipes`
- `recipe_ingredients`

Expected new draft table count:

- `food_missing_food_drafts = 0`

## Stop Conditions

Stop before apply if:

- `food_missing_food_drafts` already exists and this is not a known retry.
- `food_missing_review_queue` is missing.
- `user_profiles.id_user` or `user_profiles.is_admin` is missing.
- `normalize_food_text(value text)` is missing.
- Any bundled SQL writes to `foods` or `food_aliases`.
- Any bundled SQL creates food/alias triggers from draft status.
- Any count check cannot be captured.

Stop after apply and investigate if:

- `food_missing_food_drafts` count is not `0`.
- `foods` count changed.
- `food_aliases` count changed.
- diary/favorites/recipes counts changed.
- RLS/admin-only policy is missing.
- A trigger/function can write to `foods` or `food_aliases`.

## Deferred

- Apply-readiness review of this draft.
- Owner apply package.
- Runtime service/UI for draft preparation.
- Owner-approved food creation package.
- Post-food-creation Alias Apply follow-up.
- Brand/barcode/OFF active flow.
- Batch missing-food drafts.

## Final Recommendation

The DB draft is ready for review. It creates an admin-only draft preparation table that can hold complete candidate food data and provenance without creating foods, creating aliases, calling Alias Apply, or mutating Food Core. Do not apply it until a separate apply-readiness review passes and owner approval is explicit.
