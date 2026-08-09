# Missing Food Owner Apply DB/RPC Draft

- Timestamp: 2026-08-09T00:00:00Z
- Basis: `reports/missing-food-owner-approved-food-creation-design-2026-08-09.md`
- Draft SQL: `supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql`
- Scope: draft-only RPC for owner-approved creation of one core food from one ready Missing Food Draft
- Verdict: **MISSING_FOOD_OWNER_APPLY_DB_DRAFT_READY**

## Safety

- Draft files only.
- Migration was not applied.
- RPC was not called.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No foods were created.
- No aliases were added.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## Draft Migration

Created draft:

- `supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql`

The draft creates/replaces one explicit RPC:

- `public.apply_owner_approved_missing_food_draft(p_draft_id uuid)`

Return shape:

- `result text`
- `food_id uuid`
- `error text`

Result values used by the draft:

- `applied`
- `permission_denied`
- `draft_not_found`
- `already_applied`
- `not_ready`
- `invalid_review_state`
- `invalid_draft`
- `duplicate_food`
- `insert_failed`

## RPC Contract

The RPC:

- accepts one `draft_id`;
- uses `security definer`;
- sets `search_path = public, pg_temp`;
- validates admin access through `public.user_profiles.id_user = auth.uid()` and `is_admin = true`;
- requires the selected draft to be locked `for update`;
- requires `status = 'ready_for_owner_apply'`;
- requires `applied_food_id`, `applied_by`, and `applied_at` to be null;
- requires the linked Missing Food Review row to be `classification = 'missing_canonical_food'`;
- requires the linked Missing Food Review row to be `status = 'approved_for_food_draft'`;
- validates `source = 'core'`;
- validates `unit = 'g'`;
- validates `brand is null` and `barcode is null` for MVP;
- validates non-blank `name`, `normalized_name`, `category`, and `data_source`;
- validates `normalized_name = public.normalize_food_text(name)`;
- validates calories/protein/fat/carbs are present, finite, and non-negative;
- validates nullable fiber is either null, finite, or non-negative;
- checks duplicate/conflict risk against `public.foods.normalized_name`;
- inserts exactly one `public.foods` row on success;
- sets `canonical_food_id` to the inserted food id;
- marks the draft `status = 'applied'`;
- fills `applied_food_id`, `applied_by`, and `applied_at`;
- never writes `public.food_aliases`;
- never calls `public.apply_admin_approved_food_alias`;
- creates no trigger from draft status to foods.

Owner approval remains a process gate before calling the RPC. The DB gate enforces authenticated admin access.

## Food Insert Shape

Successful RPC call inserts one `public.foods` row:

| Field | Value |
| --- | --- |
| `id` | generated uuid |
| `name` | draft `name`, trimmed |
| `calories` | draft `calories` |
| `protein` | draft `protein` |
| `fat` | draft `fat` |
| `carbs` | draft `carbs` |
| `fiber` | draft `fiber`, preserving null |
| `unit` | `g` |
| `category` | draft `category`, trimmed |
| `source` | `core` |
| `created_by_user_id` | null |
| `canonical_food_id` | inserted food id |
| `normalized_name` | draft `normalized_name` |
| `normalized_brand` | null |
| `nutrition_version` | 1 |
| `verified` | true |
| `suspicious` | false |
| `confidence_score` | 1 |
| `source_version` | `missing_food_draft:<draft_id>; data_source:<data_source>` |
| `allergens` | empty array |
| `intolerances` | empty array |
| `aliases` | empty array |
| `auto_filled` | false |
| `popularity` | 0 |

No `stable_food_id` is assigned in this draft. It remains null/default because stable-id semantics for manually reviewed Missing Food rows are still deferred.

## Exact Migration Reference

Draft file to review later:

```text
supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql
```

Do not apply without a fresh apply-readiness review and explicit owner approval.

## Exact Pre-Check SQL

Read-only pre-check before any future migration apply:

```sql
-- Missing Food Owner Apply DB/RPC pre-check
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
    'user_profiles_id_user_exists' as check_name,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'id_user'
    )::text as actual,
    true::text as expected,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'id_user'
    ) as pass

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
    'owner_apply_rpc_absent_or_replaceable',
    coalesce(to_regprocedure('public.apply_owner_approved_missing_food_draft(uuid)')::text, 'missing'),
    'missing or known retry',
    true
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Baseline counts before future migration apply:

```sql
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

- all counts unchanged;
- no foods inserted;
- no aliases inserted;
- no draft status changed.

## Exact Post-Check SQL

Read-only post-check after future migration apply:

```sql
-- Missing Food Owner Apply DB/RPC post-check
-- Read-only. This validates RPC installation only; it must not call the RPC.

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
      select jsonb_agg(jsonb_build_object('grantee', grantee, 'privilege', privilege_type) order by grantee)::text
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
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Counts after migration apply only:

```sql
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

- counts match pre-check exactly;
- `foods` unchanged;
- `food_aliases` unchanged;
- `food_missing_food_drafts` count unchanged;
- no draft row is marked applied by migration.

## Future Owner RPC Call Pre-Check

Before any future owner-approved RPC call, run a draft-id-specific read-only check:

```sql
-- Replace the UUID below with the explicitly owner-approved draft id.
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as draft_id
),
draft_row as (
  select d.*
  from public.food_missing_food_drafts d, params p
  where d.id = p.draft_id
),
review_row as (
  select q.*
  from public.food_missing_review_queue q
  join draft_row d on d.source_review_id = q.id
),
duplicate_foods as (
  select f.id, f.name, f.normalized_name, f.source
  from public.foods f
  join draft_row d on (
    f.normalized_name = d.normalized_name
    or public.normalize_food_text(f.name) = d.normalized_name
  )
  where f.source in ('core', 'brand')
     or coalesce(f.normalized_brand, '') = ''
),
checks as (
  select 'draft_exists' as check_name, (select count(*) from draft_row)::text as actual, '1' as expected, (select count(*) from draft_row) = 1 as pass
  union all select 'draft_ready_for_owner_apply', coalesce((select status from draft_row), 'missing'), 'ready_for_owner_apply', coalesce((select status = 'ready_for_owner_apply' from draft_row), false)
  union all select 'draft_not_applied', coalesce((select jsonb_build_object('applied_food_id', applied_food_id, 'applied_by', applied_by, 'applied_at', applied_at)::text from draft_row), 'missing'), 'all null', coalesce((select applied_food_id is null and applied_by is null and applied_at is null from draft_row), false)
  union all select 'review_approved_for_food_draft', coalesce((select status from review_row), 'missing'), 'approved_for_food_draft', coalesce((select status = 'approved_for_food_draft' from review_row), false)
  union all select 'review_missing_canonical_food', coalesce((select classification from review_row), 'missing'), 'missing_canonical_food', coalesce((select classification = 'missing_canonical_food' from review_row), false)
  union all select 'draft_core_g', coalesce((select jsonb_build_object('source', source, 'unit', unit)::text from draft_row), 'missing'), 'source core, unit g', coalesce((select source = 'core' and unit = 'g' from draft_row), false)
  union all select 'draft_required_fields', coalesce((select jsonb_build_object('name', name, 'normalized_name', normalized_name, 'category', category, 'data_source', data_source)::text from draft_row), 'missing'), 'nonblank required fields', coalesce((select length(trim(name)) > 0 and length(trim(normalized_name)) > 0 and length(trim(category)) > 0 and length(trim(data_source)) > 0 from draft_row), false)
  union all select 'draft_normalized_name_matches', coalesce((select normalized_name from draft_row), 'missing'), 'normalize_food_text(name)', coalesce((select normalized_name = public.normalize_food_text(name) from draft_row), false)
  union all select 'draft_macros_valid', coalesce((select jsonb_build_object('calories', calories, 'protein', protein, 'fat', fat, 'carbs', carbs, 'fiber', fiber)::text from draft_row), 'missing'), 'required macros non-negative; fiber null/non-negative', coalesce((select calories is not null and protein is not null and fat is not null and carbs is not null and calories >= 0 and protein >= 0 and fat >= 0 and carbs >= 0 and (fiber is null or fiber >= 0) from draft_row), false)
  union all select 'no_duplicate_food', (select count(*) from duplicate_foods)::text, '0', (select count(*) from duplicate_foods) = 0
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Stop if any row returns `pass = false`.

## Future Owner RPC Call Post-Check

After a future owner-approved RPC call returns `result = 'applied'`, validate:

```sql
-- Replace both UUIDs with the owner-approved draft id and RPC-returned food id.
with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as draft_id,
    '11111111-1111-1111-1111-111111111111'::uuid as food_id
),
draft_row as (
  select d.*
  from public.food_missing_food_drafts d, params p
  where d.id = p.draft_id
),
food_row as (
  select f.*
  from public.foods f, params p
  where f.id = p.food_id
),
checks as (
  select 'food_exists' as check_name, (select count(*) from food_row)::text as actual, '1' as expected, (select count(*) from food_row) = 1 as pass
  union all select 'food_core_g_self_root', coalesce((select jsonb_build_object('source', source, 'unit', unit, 'canonical_food_id', canonical_food_id)::text from food_row), 'missing'), 'core/g/canonical_food_id=id', coalesce((select source = 'core' and unit = 'g' and canonical_food_id = id from food_row), false)
  union all select 'food_matches_draft', coalesce((select jsonb_build_object('food_name', f.name, 'draft_name', d.name, 'food_normalized_name', f.normalized_name, 'draft_normalized_name', d.normalized_name)::text from food_row f cross join draft_row d), 'missing'), 'name and normalized_name match', coalesce((select f.name = trim(d.name) and f.normalized_name = d.normalized_name from food_row f cross join draft_row d), false)
  union all select 'food_nutrition_matches_draft', coalesce((select jsonb_build_object('food_calories', f.calories, 'draft_calories', d.calories, 'food_fiber', f.fiber, 'draft_fiber', d.fiber)::text from food_row f cross join draft_row d), 'missing'), 'nutrition including nullable fiber matches', coalesce((select f.calories = d.calories and f.protein = d.protein and f.fat = d.fat and f.carbs = d.carbs and f.fiber is not distinct from d.fiber from food_row f cross join draft_row d), false)
  union all select 'draft_applied_state', coalesce((select jsonb_build_object('status', status, 'applied_food_id', applied_food_id, 'applied_by', applied_by, 'applied_at', applied_at)::text from draft_row), 'missing'), 'applied with applied_* filled', coalesce((select status = 'applied' and applied_food_id = (select food_id from params) and applied_by is not null and applied_at is not null from draft_row), false)
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Also confirm counts:

- `foods = pre_foods + 1`;
- `food_aliases = pre_food_aliases`;
- `food_alias_apply_audit = pre_food_alias_apply_audit`;
- `food_missing_review_queue = pre_food_missing_review_queue`;
- `food_search_events = pre_food_search_events`;
- `food_search_review_queue = pre_food_search_review_queue`;
- `food_diary_entries = pre_food_diary_entries`;
- `favorite_products = pre_favorite_products`;
- `recipes = pre_recipes`;
- `recipe_ingredients = pre_recipe_ingredients`.

## Rollback Notes

Migration apply rollback, if the RPC draft itself must be removed before any successful RPC call:

```sql
begin;
drop function if exists public.apply_owner_approved_missing_food_draft(uuid);
commit;
```

After a successful food-creation RPC call, rollback is a Food Core data rollback and must not be casual.

If owner explicitly approves cleanup of a failed test food:

1. Confirm the target draft id and inserted food id.
2. Confirm no diary/favorite/recipe rows reference the inserted food.
3. Confirm no aliases reference the inserted food.
4. Delete or reset only the inserted food and selected draft tracking in one reviewed transaction.
5. Re-run full counts and reference checks.

Do not run rollback if the created food has been used by diary/favorites/recipes or aliases; prepare a separate remediation package instead.

## Stop Conditions

Stop before migration apply if:

- branch is not `master`;
- pre-check has any `pass = false`;
- expected tables/columns/functions are missing;
- `user_profiles.id_user` or `is_admin` is missing;
- `normalize_food_text(value text)` is missing;
- `foods.fiber` cannot preserve the intended nullable fiber semantics;
- the RPC already exists and this is not an intentional retry;
- owner approval is not explicit.

Stop before a future RPC call if:

- owner did not approve the exact draft id;
- draft is not `ready_for_owner_apply`;
- draft `applied_*` fields are not null;
- source review is not `approved_for_food_draft`;
- source review classification is not `missing_canonical_food`;
- draft is not `source = 'core'` / `unit = 'g'`;
- required fields or macros are invalid;
- duplicate/conflict check finds any row;
- baseline counts were not captured.

Stop after a future RPC call if:

- RPC result is not `applied`;
- `foods` did not increase by exactly `+1`;
- `food_aliases` changed;
- draft applied state is missing or points to the wrong food;
- diary/favorites/recipes counts changed.

## Deferred

- Apply-readiness review of this draft.
- Owner apply package for installing the RPC.
- Owner-approved first real food creation call.
- Production smoke for one reviewed food creation.
- Post-food-creation Alias Apply follow-up.
- Stable food id assignment policy.
- Dedicated audit table for owner food creation attempts.

## Final Recommendation

The DB/RPC draft is ready for apply-readiness review. Do not apply the migration and do not call the RPC until the draft has passed review and the owner explicitly approves the exact next step.
