# Missing Food Owner Apply Owner Package

- Timestamp: 2026-08-09T00:00:00Z
- Draft SQL: `supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql`
- Draft report: `reports/missing-food-owner-apply-db-draft-2026-08-09.md`
- Apply-readiness review: `reports/missing-food-owner-apply-db-draft-review-2026-08-09.md`
- Verdict: **MISSING_FOOD_OWNER_APPLY_OWNER_PACKAGE_READY**

## Safety

- Owner package/report only.
- Migration was not applied by Codex.
- RPC was not called.
- Production DB schema was not changed by Codex.
- Storage buckets and policies were not changed.
- No foods were created.
- No aliases were added.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## Scope

This package is only for installing the RPC:

- `public.apply_owner_approved_missing_food_draft(draft_id uuid)`

Expected migration apply effect:

- creates/replaces one function;
- sets function comment;
- revokes public execute;
- grants execute to `authenticated`;
- creates no trigger;
- inserts no foods;
- inserts no aliases;
- updates no draft rows;
- runs no import/backfill/recompute.

Do not call the RPC as part of this package.

## Exact Migration Reference

Apply this exact draft only after owner approval:

```text
supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql
```

Expected Supabase SQL editor result:

```text
Success. No rows returned.
```

## Combined Pre-Check SQL

Run before applying the migration.

```sql
-- Missing Food Owner Apply RPC install pre-check
-- Read-only. Do not create foods, aliases, drafts, events, diary rows, favorites, or recipes.

with expected_food_columns(column_name) as (
  values
    ('id'),
    ('name'),
    ('normalized_name'),
    ('normalized_brand'),
    ('category'),
    ('source'),
    ('calories'),
    ('protein'),
    ('fat'),
    ('carbs'),
    ('fiber'),
    ('unit'),
    ('created_by_user_id'),
    ('canonical_food_id'),
    ('nutrition_version'),
    ('verified'),
    ('suspicious'),
    ('confidence_score'),
    ('source_version'),
    ('allergens'),
    ('intolerances'),
    ('aliases'),
    ('auto_filled'),
    ('popularity')
),
expected_draft_columns(column_name) as (
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
    ('status'),
    ('applied_food_id'),
    ('applied_by'),
    ('applied_at'),
    ('metadata')
),
checks as (
  select
    'branch_owner_confirmation_manual' as check_name,
    'owner must confirm this is production/master apply' as actual,
    'confirmed before apply' as expected,
    true as pass

  union all
  select
    'user_profiles_id_user_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'id_user'
    )::text,
    true::text,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'id_user'
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
        and n.nspname in ('public', 'pg_catalog', 'extensions')
    )::text,
    true::text,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'gen_random_uuid'
        and n.nspname in ('public', 'pg_catalog', 'extensions')
    )

  union all
  select
    'food_missing_food_drafts_exists',
    to_regclass('public.food_missing_food_drafts')::text,
    'food_missing_food_drafts exists',
    to_regclass('public.food_missing_food_drafts') is not null

  union all
  select
    'food_missing_review_queue_exists',
    to_regclass('public.food_missing_review_queue')::text,
    'food_missing_review_queue exists',
    to_regclass('public.food_missing_review_queue') is not null

  union all
  select
    'foods_exists',
    to_regclass('public.foods')::text,
    'foods exists',
    to_regclass('public.foods') is not null

  union all
  select
    'food_aliases_exists',
    to_regclass('public.food_aliases')::text,
    'food_aliases exists',
    to_regclass('public.food_aliases') is not null

  union all
  select
    'expected_food_columns_present',
    (
      select count(*)
      from information_schema.columns c
      join expected_food_columns e on e.column_name = c.column_name
      where c.table_schema = 'public'
        and c.table_name = 'foods'
    )::text,
    (select count(*) from expected_food_columns)::text,
    (
      select count(*)
      from information_schema.columns c
      join expected_food_columns e on e.column_name = c.column_name
      where c.table_schema = 'public'
        and c.table_name = 'foods'
    ) = (select count(*) from expected_food_columns)

  union all
  select
    'expected_draft_columns_present',
    (
      select count(*)
      from information_schema.columns c
      join expected_draft_columns e on e.column_name = c.column_name
      where c.table_schema = 'public'
        and c.table_name = 'food_missing_food_drafts'
    )::text,
    (select count(*) from expected_draft_columns)::text,
    (
      select count(*)
      from information_schema.columns c
      join expected_draft_columns e on e.column_name = c.column_name
      where c.table_schema = 'public'
        and c.table_name = 'food_missing_food_drafts'
    ) = (select count(*) from expected_draft_columns)

  union all
  select
    'foods_core_source_available',
    exists (
      select 1
      from public.foods
      where source = 'core'
      limit 1
    )::text,
    true::text,
    exists (
      select 1
      from public.foods
      where source = 'core'
      limit 1
    )

  union all
  select
    'foods_fiber_nullable_contract_check',
    coalesce((
      select jsonb_build_object('is_nullable', is_nullable, 'data_type', data_type)::text
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'foods'
        and column_name = 'fiber'
    ), 'missing'),
    'fiber column present; nullable semantics reviewed',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'foods'
        and column_name = 'fiber'
    )

  union all
  select
    'owner_apply_rpc_absent_or_known_retry',
    coalesce(to_regprocedure('public.apply_owner_approved_missing_food_draft(uuid)')::text, 'missing'),
    'missing or intentional replace',
    true
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Stop if any row other than `owner_apply_rpc_absent_or_known_retry` returns `pass = false`.

## Counts Baseline SQL

Run before applying the migration and save the output.

```sql
-- Missing Food Owner Apply RPC install baseline counts
-- Read-only.

select 'foods' as table_name, count(*) as row_count from public.foods
union all select 'food_aliases', count(*) from public.food_aliases
union all select 'food_alias_apply_audit', count(*) from public.food_alias_apply_audit
union all select 'food_missing_review_queue', count(*) from public.food_missing_review_queue
union all select 'food_missing_food_drafts', count(*) from public.food_missing_food_drafts
union all select 'food_search_events', count(*) from public.food_search_events
union all select 'food_search_review_queue', count(*) from public.food_search_review_queue
union all select 'food_diary_entries', count(*) from public.food_diary_entries
union all select 'favorite_products', count(*) from public.favorite_products
union all select 'recipes', count(*) from public.recipes
union all select 'recipe_ingredients', count(*) from public.recipe_ingredients
order by table_name;
```

Expected after migration apply only:

- every count stays unchanged.

## Apply Step

Only after pre-check and count baseline pass:

1. Open Supabase SQL editor for the production project.
2. Paste the full contents of:
   - `supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql`
3. Execute once.
4. Expected result:
   - `Success. No rows returned.`
5. Do not call:
   - `public.apply_owner_approved_missing_food_draft(...)`

## Combined Post-Check SQL

Run after applying the migration. This validates installation only and must not call the RPC.

```sql
-- Missing Food Owner Apply RPC install post-check
-- Read-only. Validates RPC installation only; do not call the RPC here.

with checks as (
  select
    'rpc_exists' as check_name,
    to_regprocedure('public.apply_owner_approved_missing_food_draft(uuid)')::text as actual,
    'public.apply_owner_approved_missing_food_draft(uuid)' as expected,
    to_regprocedure('public.apply_owner_approved_missing_food_draft(uuid)') is not null as pass

  union all
  select
    'rpc_security_definer',
    coalesce((
      select p.prosecdef::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
    ), 'missing'),
    true::text,
    coalesce((
      select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
    ), false)

  union all
  select
    'rpc_search_path_public_pg_temp',
    coalesce((
      select array_to_string(p.proconfig, ',')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
    ), 'missing'),
    'search_path=public, pg_temp',
    coalesce((
      select array_to_string(p.proconfig, ',') like '%search_path=public, pg_temp%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
    ), false)

  union all
  select
    'execute_granted_authenticated_only',
    (
      select coalesce(jsonb_agg(jsonb_build_object('grantee', grantee, 'privilege', privilege_type) order by grantee), '[]'::jsonb)::text
      from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = 'apply_owner_approved_missing_food_draft'
    ),
    'authenticated EXECUTE only',
    exists (
      select 1
      from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = 'apply_owner_approved_missing_food_draft'
        and grantee = 'authenticated'
        and privilege_type = 'EXECUTE'
    )
    and not exists (
      select 1
      from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = 'apply_owner_approved_missing_food_draft'
        and grantee in ('anon', 'public')
        and privilege_type = 'EXECUTE'
    )

  union all
  select
    'rpc_uses_id_user_admin_gate',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and pg_get_functiondef(p.oid) ilike '%id_user = v_admin_id%'
        and pg_get_functiondef(p.oid) ilike '%is_admin = true%'
    )::text,
    true::text,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and pg_get_functiondef(p.oid) ilike '%id_user = v_admin_id%'
        and pg_get_functiondef(p.oid) ilike '%is_admin = true%'
    )

  union all
  select
    'rpc_can_insert_foods_explicit_only',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and pg_get_functiondef(p.oid) ilike '%insert into public.foods%'
        and pg_get_functiondef(p.oid) ilike '%where id = p_draft_id%for update%'
        and pg_get_functiondef(p.oid) ilike '%status <> ''ready_for_owner_apply''%'
    )::text,
    true::text,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and pg_get_functiondef(p.oid) ilike '%insert into public.foods%'
        and pg_get_functiondef(p.oid) ilike '%where id = p_draft_id%for update%'
        and pg_get_functiondef(p.oid) ilike '%status <> ''ready_for_owner_apply''%'
    )

  union all
  select
    'rpc_does_not_write_food_aliases',
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and (
          pg_get_functiondef(p.oid) ilike '%insert into public.food_aliases%'
          or pg_get_functiondef(p.oid) ilike '%update public.food_aliases%'
          or pg_get_functiondef(p.oid) ilike '%delete from public.food_aliases%'
          or pg_get_functiondef(p.oid) ilike '%apply_admin_approved_food_alias%'
        )
    )::text,
    true::text,
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and (
          pg_get_functiondef(p.oid) ilike '%insert into public.food_aliases%'
          or pg_get_functiondef(p.oid) ilike '%update public.food_aliases%'
          or pg_get_functiondef(p.oid) ilike '%delete from public.food_aliases%'
          or pg_get_functiondef(p.oid) ilike '%apply_admin_approved_food_alias%'
        )
    )

  union all
  select
    'no_auto_trigger_from_drafts_to_foods',
    not exists (
      select 1
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'food_missing_food_drafts'
        and lower(action_statement) like '%apply_owner_approved_missing_food_draft%'
    )::text,
    true::text,
    not exists (
      select 1
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'food_missing_food_drafts'
        and lower(action_statement) like '%apply_owner_approved_missing_food_draft%'
    )

  union all
  select
    'no_import_backfill_recompute_functions_added',
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and (
          pg_get_functiondef(p.oid) ilike '%recompute%'
          or pg_get_functiondef(p.oid) ilike '%backfill%'
          or pg_get_functiondef(p.oid) ilike '%food_diary_entries%'
          or pg_get_functiondef(p.oid) ilike '%favorite_products%'
          or pg_get_functiondef(p.oid) ilike '%recipe_ingredients%'
        )
    )::text,
    true::text,
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'apply_owner_approved_missing_food_draft'
        and (
          pg_get_functiondef(p.oid) ilike '%recompute%'
          or pg_get_functiondef(p.oid) ilike '%backfill%'
          or pg_get_functiondef(p.oid) ilike '%food_diary_entries%'
          or pg_get_functiondef(p.oid) ilike '%favorite_products%'
          or pg_get_functiondef(p.oid) ilike '%recipe_ingredients%'
        )
    )
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Stop if any row returns `pass = false`.

## Post-Apply Counts SQL

Run after applying the migration and compare with baseline.

```sql
-- Missing Food Owner Apply RPC install post-apply counts
-- Read-only.

select 'foods' as table_name, count(*) as row_count from public.foods
union all select 'food_aliases', count(*) from public.food_aliases
union all select 'food_alias_apply_audit', count(*) from public.food_alias_apply_audit
union all select 'food_missing_review_queue', count(*) from public.food_missing_review_queue
union all select 'food_missing_food_drafts', count(*) from public.food_missing_food_drafts
union all select 'food_search_events', count(*) from public.food_search_events
union all select 'food_search_review_queue', count(*) from public.food_search_review_queue
union all select 'food_diary_entries', count(*) from public.food_diary_entries
union all select 'favorite_products', count(*) from public.favorite_products
union all select 'recipes', count(*) from public.recipes
union all select 'recipe_ingredients', count(*) from public.recipe_ingredients
order by table_name;
```

Expected after migration apply only:

| Table | Expected |
| --- | --- |
| `foods` | unchanged |
| `food_aliases` | unchanged |
| `food_alias_apply_audit` | unchanged |
| `food_missing_review_queue` | unchanged |
| `food_missing_food_drafts` | unchanged |
| `food_search_events` | unchanged |
| `food_search_review_queue` | unchanged |
| `food_diary_entries` | unchanged |
| `favorite_products` | unchanged |
| `recipes` | unchanged |
| `recipe_ingredients` | unchanged |

## Stop Conditions

Stop before apply if:

- owner approval is not explicit;
- branch/source artifact is not `master`;
- pre-check returns any unexpected `pass = false`;
- required tables/columns/functions are missing;
- `user_profiles.id_user` or `user_profiles.is_admin` is missing;
- `normalize_food_text(value text)` is missing;
- `gen_random_uuid()` is missing;
- `foods.fiber` nullable semantics are not reviewed;
- baseline counts were not saved;
- this is not an intentional RPC install/retry.

Stop during apply if:

- Supabase project/environment is not the intended production project;
- SQL editor shows any error;
- SQL editor returns rows unexpectedly for the migration.

Stop after apply if:

- post-check returns any `pass = false`;
- any table count changed;
- `foods` count changed;
- `food_aliases` count changed;
- `food_missing_food_drafts` count changed;
- any draft row was marked applied;
- any import/backfill/recompute appears to have run.

Do not call the RPC in this package. A future package must approve one exact `draft_id`, run draft-specific pre-checks, call the RPC exactly once, and validate `foods +1`.

## Rollback

If the RPC install must be rolled back before any successful RPC call:

```sql
begin;
drop function if exists public.apply_owner_approved_missing_food_draft(uuid);
commit;
```

After any future successful RPC call, rollback is no longer function-only. It becomes a Food Core data remediation and must have a separate owner-approved package.

## Final Recommendation

This owner package is ready for installing the owner-approved Missing Food apply RPC. Applying this migration should install only the function and leave all Food Core/data-quality/user-data counts unchanged. Food creation remains a separate, later, explicit owner-approved RPC call package.
