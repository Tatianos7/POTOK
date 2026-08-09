# Missing Food Drafts Owner Apply Package

- Timestamp: 2026-08-08T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260808_missing_food_drafts_draft.sql`
- Draft report: `reports/missing-food-drafts-db-draft-2026-08-08.md`
- Apply-readiness report: `reports/missing-food-drafts-db-draft-review-2026-08-08.md`
- Verdict: **MISSING_FOOD_DRAFTS_OWNER_PACKAGE_READY**

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

## Expected Data Effect

The migration should create only:

- `public.food_missing_food_drafts`

Expected immediately after apply:

- `food_missing_food_drafts` exists;
- `food_missing_food_drafts` count is `0`;
- RLS is enabled;
- one admin-only policy exists;
- expected indexes exist;
- updated-at trigger exists only on `food_missing_food_drafts`;
- no foods are inserted;
- no aliases are inserted.

These counts must remain unchanged from pre-check:

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

## Combined Pre-Check SQL

Run this before applying the migration. It is read-only.

```sql
-- Missing Food Drafts combined pre-check
-- Read-only. Do not modify data.

with checks as (
  select
    'food_missing_food_drafts_absent' as check_name,
    not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_missing_food_drafts'
    )::text as actual,
    true::text as expected,
    not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_missing_food_drafts'
    ) as pass

  union all
  select
    'food_missing_review_queue_exists',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_missing_review_queue'
    )::text,
    true::text,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_missing_review_queue'
    )

  union all
  select
    'user_profiles_id_user_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'id_user'
        and udt_name = 'uuid'
    )::text,
    true::text,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'id_user'
        and udt_name = 'uuid'
    )

  union all
  select
    'user_profiles_is_admin_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'is_admin'
    )::text,
    true::text,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'is_admin'
    )

  union all
  select
    'normalize_food_text_exists',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'normalize_food_text'
        and pg_get_function_arguments(p.oid) = 'value text'
    )::text,
    true::text,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'normalize_food_text'
        and pg_get_function_arguments(p.oid) = 'value text'
    )

  union all
  select
    'gen_random_uuid_available',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'gen_random_uuid'
        and pg_get_function_arguments(p.oid) = ''
        and n.nspname in ('public', 'pg_catalog', 'extensions')
    )::text,
    true::text,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'gen_random_uuid'
        and pg_get_function_arguments(p.oid) = ''
        and n.nspname in ('public', 'pg_catalog', 'extensions')
    )

  union all
  select
    'foods_table_exists',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'foods'
    )::text,
    true::text,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'foods'
    )

  union all
  select
    'foods_id_uuid_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'foods'
        and column_name = 'id'
        and udt_name = 'uuid'
    )::text,
    true::text,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'foods'
        and column_name = 'id'
        and udt_name = 'uuid'
    )

  union all
  select
    'food_aliases_table_exists',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_aliases'
    )::text,
    true::text,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_aliases'
    )

  union all
  select
    'unexpected_draft_objects_absent',
    (
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
      )
    )::text,
    true::text,
    (
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
      )
    )

  union all
  select
    'draft_functions_do_not_write_food_core',
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
    )::text,
    true::text,
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
    )
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Pre-check expected:

- every row has `pass = true`;
- if any row has `pass = false`, stop.

## Counts Check SQL

Run before apply and save the output. Run the same query after apply and compare every pre-existing table count exactly.

```sql
-- Missing Food Drafts counts check
-- Read-only. Save output before apply and compare after apply.

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

Expected after apply:

- every count above is unchanged from pre-apply.
- `public.food_missing_food_drafts` is new and has count `0`.

## Exact Migration Reference

Apply exactly this reviewed file:

```text
supabase/migration_drafts/20260808_missing_food_drafts_draft.sql
```

Do not edit it in Supabase SQL Editor. Do not bundle it with any other SQL.

The file begins with:

```sql
-- Missing Food Drafts draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
```

The file ends with:

```sql
commit;
```

Approved migration scope:

- create `public.food_missing_food_drafts`;
- add constraints for draft/status/nutrition shape;
- add indexes for draft management;
- add updated-at trigger only for `food_missing_food_drafts`;
- enable RLS;
- add one admin-only policy using `user_profiles.id_user`;
- no writes to `public.foods`;
- no writes to `public.food_aliases`;
- no RPC calls;
- no import/backfill/recompute.

## Combined Post-Check SQL

Run this immediately after applying the migration. It is read-only.

```sql
-- Missing Food Drafts combined post-check
-- Read-only. Do not insert foods, aliases, draft rows, search events, diary rows, favorites, or recipes.

with expected_columns(column_name) as (
  values
    ('id'),
    ('source_review_id'),
    ('query'),
    ('normalized_query'),
    ('name'),
    ('normalized_name'),
    ('category'),
    ('source'),
    ('brand'),
    ('barcode'),
    ('calories'),
    ('protein'),
    ('fat'),
    ('carbs'),
    ('fiber'),
    ('unit'),
    ('data_source'),
    ('source_url'),
    ('source_notes'),
    ('reviewer_notes'),
    ('status'),
    ('prepared_by'),
    ('prepared_at'),
    ('reviewed_by'),
    ('reviewed_at'),
    ('applied_food_id'),
    ('applied_by'),
    ('applied_at'),
    ('metadata'),
    ('created_at'),
    ('updated_at')
),
expected_indexes(indexname) as (
  values
    ('food_missing_food_drafts_source_review_id_idx'),
    ('food_missing_food_drafts_status_updated_at_idx'),
    ('food_missing_food_drafts_normalized_name_idx'),
    ('food_missing_food_drafts_source_idx'),
    ('food_missing_food_drafts_applied_food_id_idx')
),
expected_constraints(conname) as (
  values
    ('food_missing_food_drafts_pkey'),
    ('food_missing_food_drafts_status_check'),
    ('food_missing_food_drafts_query_not_blank_check'),
    ('food_missing_food_drafts_normalized_query_not_blank_check'),
    ('food_missing_food_drafts_name_not_blank_check'),
    ('food_missing_food_drafts_normalized_name_not_blank_check'),
    ('food_missing_food_drafts_normalized_name_matches_check'),
    ('food_missing_food_drafts_category_not_blank_check'),
    ('food_missing_food_drafts_source_check'),
    ('food_missing_food_drafts_brand_inactive_check'),
    ('food_missing_food_drafts_barcode_inactive_check'),
    ('food_missing_food_drafts_unit_check'),
    ('food_missing_food_drafts_data_source_not_blank_check'),
    ('food_missing_food_drafts_source_url_not_blank_check'),
    ('food_missing_food_drafts_source_notes_not_blank_check'),
    ('food_missing_food_drafts_reviewer_notes_not_blank_check'),
    ('food_missing_food_drafts_calories_check'),
    ('food_missing_food_drafts_protein_check'),
    ('food_missing_food_drafts_fat_check'),
    ('food_missing_food_drafts_carbs_check'),
    ('food_missing_food_drafts_fiber_check'),
    ('food_missing_food_drafts_ready_shape_check'),
    ('food_missing_food_drafts_applied_shape_check'),
    ('food_missing_food_drafts_non_applied_shape_check')
),
checks as (
  select
    'food_missing_food_drafts_exists' as check_name,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_missing_food_drafts'
    )::text as actual,
    true::text as expected,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'food_missing_food_drafts'
    ) as pass

  union all
  select
    'food_missing_food_drafts_count',
    (select count(*) from public.food_missing_food_drafts)::text,
    0::text,
    (select count(*) from public.food_missing_food_drafts) = 0

  union all
  select
    'expected_columns_present',
    (
      select count(*)
      from information_schema.columns c
      join expected_columns ec on ec.column_name = c.column_name
      where c.table_schema = 'public'
        and c.table_name = 'food_missing_food_drafts'
    )::text,
    (select count(*) from expected_columns)::text,
    (
      select count(*)
      from information_schema.columns c
      join expected_columns ec on ec.column_name = c.column_name
      where c.table_schema = 'public'
        and c.table_name = 'food_missing_food_drafts'
    ) = (select count(*) from expected_columns)

  union all
  select
    'rls_enabled',
    coalesce((
      select c.relrowsecurity::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'food_missing_food_drafts'
    ), 'missing'),
    true::text,
    coalesce((
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'food_missing_food_drafts'
    ), false)

  union all
  select
    'admin_policy_only',
    (
      select jsonb_build_object(
        'count', count(*),
        'policies', coalesce(jsonb_agg(policyname order by policyname), '[]'::jsonb)
      )::text
      from pg_policies
      where schemaname = 'public'
        and tablename = 'food_missing_food_drafts'
    ),
    'one food_missing_food_drafts_admin_all policy using id_user',
    (
      select count(*) = 1
        and bool_and(policyname = 'food_missing_food_drafts_admin_all')
        and bool_and(cmd = 'ALL')
        and bool_and(qual ilike '%id_user = auth.uid()%')
        and bool_and(with_check ilike '%id_user = auth.uid()%')
      from pg_policies
      where schemaname = 'public'
        and tablename = 'food_missing_food_drafts'
    )

  union all
  select
    'expected_indexes_present',
    (
      select count(*)
      from pg_indexes i
      join expected_indexes ei on ei.indexname = i.indexname
      where i.schemaname = 'public'
        and i.tablename = 'food_missing_food_drafts'
    )::text,
    (select count(*) from expected_indexes)::text,
    (
      select count(*)
      from pg_indexes i
      join expected_indexes ei on ei.indexname = i.indexname
      where i.schemaname = 'public'
        and i.tablename = 'food_missing_food_drafts'
    ) = (select count(*) from expected_indexes)

  union all
  select
    'expected_constraints_present',
    (
      select count(*)
      from pg_constraint pc
      join pg_class c on c.oid = pc.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join expected_constraints ec on ec.conname = pc.conname
      where n.nspname = 'public'
        and c.relname = 'food_missing_food_drafts'
    )::text,
    (select count(*) from expected_constraints)::text,
    (
      select count(*)
      from pg_constraint pc
      join pg_class c on c.oid = pc.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join expected_constraints ec on ec.conname = pc.conname
      where n.nspname = 'public'
        and c.relname = 'food_missing_food_drafts'
    ) = (select count(*) from expected_constraints)

  union all
  select
    'updated_at_trigger_only_on_drafts',
    (
      select count(*)
      from information_schema.triggers
      where trigger_schema = 'public'
        and trigger_name = 'update_food_missing_food_drafts_updated_at'
        and event_object_schema = 'public'
        and event_object_table = 'food_missing_food_drafts'
    )::text,
    1::text,
    (
      select count(*)
      from information_schema.triggers
      where trigger_schema = 'public'
        and trigger_name = 'update_food_missing_food_drafts_updated_at'
        and event_object_schema = 'public'
        and event_object_table = 'food_missing_food_drafts'
    ) = 1

  union all
  select
    'no_draft_triggers_write_food_core',
    not exists (
      select 1
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'food_missing_food_drafts'
        and (
          lower(action_statement) like '%public.foods%'
          or lower(action_statement) like '%public.food_aliases%'
          or lower(action_statement) like '%food_alias%'
        )
    )::text,
    true::text,
    not exists (
      select 1
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'food_missing_food_drafts'
        and (
          lower(action_statement) like '%public.foods%'
          or lower(action_statement) like '%public.food_aliases%'
          or lower(action_statement) like '%food_alias%'
        )
    )

  union all
  select
    'draft_functions_do_not_write_food_core',
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
    )::text,
    true::text,
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
    )
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Post-check expected:

- every row has `pass = true`;
- `food_missing_food_drafts_count` is `0`;
- if any row has `pass = false`, stop and investigate.

Then run the counts check SQL again and compare to the saved pre-apply counts.

## Stop Conditions

Stop before apply if:

- owner approval is not explicit;
- any combined pre-check row has `pass = false`;
- pre-counts cannot be captured;
- `food_missing_food_drafts` already exists and this is not a known retry;
- `food_missing_review_queue` is missing;
- `user_profiles.id_user` or `user_profiles.is_admin` is missing;
- `normalize_food_text(value text)` is missing;
- `gen_random_uuid()` is unavailable;
- `foods(id)` is unavailable;
- any bundled SQL writes to `foods` or `food_aliases`;
- any bundled SQL creates food/alias triggers from draft status;
- any bundled SQL calls RPCs, imports, backfills, or recomputes.

Stop after apply and investigate if:

- any combined post-check row has `pass = false`;
- `food_missing_food_drafts` count is not `0`;
- `foods` count changed;
- `food_aliases` count changed;
- `food_search_events` count changed;
- `food_search_review_queue` count changed;
- `food_alias_apply_audit` count changed;
- `food_missing_review_queue` count changed;
- diary/favorites/recipes counts changed;
- RLS/admin-only policy is missing;
- any trigger/function can write to `foods` or `food_aliases`;
- any food or alias was inserted.

## Final Instruction

Apply only the reviewed migration file after explicit owner approval. Do not create foods, create aliases, call RPCs, import, backfill, recompute, or bundle runtime changes in the same step.
