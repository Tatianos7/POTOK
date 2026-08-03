# Admin-Approved Alias Apply Production Smoke Package

- Timestamp: 2026-08-03T00:00:00Z
- DB/RPC status: `reports/admin-approved-alias-apply-db-applied-final-status-2026-08-02.md`
- Runtime/UI status: `reports/admin-approved-alias-apply-runtime-ui-2026-08-02.md`
- Runtime commit: `841227c`
- GitHub Pages run: `30836930903` PASS
- Scope: owner-approved production smoke plan only
- Verdict: **ADMIN_APPROVED_ALIAS_APPLY_SMOKE_PACKAGE_READY**

## Safety

- Package only.
- Smoke was not run.
- RPC was not called by Codex.
- Production DB/schema/storage was not changed by Codex.
- No aliases were added by Codex.
- No foods were created.
- No import/backfill/recompute was run.
- No ambiguous/manual override test is included.
- No PR was created.

## Strategy

Recommended smoke path:

1. Create one temporary non-ambiguous source event.
2. Create one temporary approved review queue row pointing to an existing shared `core` food.
3. Open `/admin/search-review` as admin.
4. Click `Apply alias` once for the temporary approved row.
5. Validate:
   - exactly one smoke alias was inserted;
   - one audit row exists with `result = 'applied'`;
   - queue row has terminal applied state;
   - `foods` is unchanged.
6. Cleanup all temporary smoke artifacts unless owner explicitly chooses to keep the test alias.

Default decision: **cleanup**.

Reason: the smoke alias is intentionally synthetic and should not remain in Food Core aliases.

## Smoke Marker

Use this exact marker in every query:

```text
POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP
```

The normalized smoke alias is produced by:

```sql
public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP')
```

## Exact Pre-Smoke SQL

Run this first. It is read-only.

```sql
-- Admin-approved Alias Apply production smoke pre-check
-- Read-only. Do not modify data.

select
  'admin_user_available' as check_name,
  exists (
    select 1
    from public.user_profiles
    where is_admin = true
      and id_user is not null
  ) as actual,
  true as expected;

select
  'rpc_exists' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_admin_approved_food_alias'
  ) as actual,
  true as expected;

select
  'audit_table_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'food_alias_apply_audit'
  ) as actual,
  true as expected;

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
  'shared_core_target_available' as check_name,
  exists (
    select 1
    from public.foods
    where source = 'core'
  ) as actual,
  true as expected;

select
  'smoke_alias_absent' as check_name,
  not exists (
    select 1
    from public.food_aliases
    where normalized_alias = public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP')
  ) as actual,
  true as expected;

select
  'smoke_queue_absent' as check_name,
  not exists (
    select 1
    from public.food_search_review_queue
    where normalized_query = public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP')
       or metadata->>'smoke_marker' = 'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'
  ) as actual,
  true as expected;

select
  'smoke_event_absent' as check_name,
  not exists (
    select 1
    from public.food_search_events
    where normalized_query = public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP')
       or metadata->>'smoke_marker' = 'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'
  ) as actual,
  true as expected;

select
  'smoke_audit_absent' as check_name,
  not exists (
    select 1
    from public.food_alias_apply_audit
    where normalized_alias = public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP')
       or validation->>'smoke_marker' = 'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'
  ) as actual,
  true as expected;

select
  'selected_smoke_target' as check_name,
  id as canonical_food_id,
  name,
  source
from public.foods
where source = 'core'
order by name, id
limit 1;

select 'food_alias_apply_audit' as table_name, count(*) as row_count from public.food_alias_apply_audit
union all
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

Expected baseline from the last confirmed status:

| Table | Expected pre-smoke count |
| --- | ---: |
| `food_alias_apply_audit` | 0 |
| `foods` | 2265 |
| `food_aliases` | 2890 |
| `food_search_events` | 50 |
| `food_search_review_queue` | 0 |
| `food_diary_entries` | 159 |
| `favorite_products` | 6 |
| `recipes` | 14 |
| `recipe_ingredients` | 43 |

If runtime search analytics has created new events since the last status, `food_search_events` may be higher. Continue only if all marker-specific pre-checks are absent and Food Core counts match expectations.

## Exact Setup SQL

Run this only after pre-smoke checks pass. It creates exactly one temporary event and one temporary approved review queue row. It does not write to `foods` or `food_aliases`.

```sql
-- Admin-approved Alias Apply production smoke setup
-- Writes only one smoke event and one approved smoke review queue row.
-- Does not write foods or food_aliases.

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
),
admin_user as (
  select id_user
  from public.user_profiles
  where is_admin = true
    and id_user is not null
  order by id_user
  limit 1
),
target_food as (
  select id
  from public.foods
  where source = 'core'
  order by name, id
  limit 1
),
smoke_event as (
  insert into public.food_search_events (
    user_id,
    session_id_hash,
    query,
    normalized_query,
    context,
    event_type,
    result_count,
    selected_canonical_food_id,
    no_selection,
    not_found,
    ambiguous,
    candidate_canonical_food_ids,
    metadata
  )
  select
    admin_user.id_user,
    null,
    smoke_config.marker,
    smoke_config.normalized_marker,
    'admin',
    'not_found',
    0,
    null,
    false,
    true,
    false,
    array[target_food.id],
    jsonb_build_object(
      'smoke_marker', smoke_config.marker,
      'smoke_scope', 'admin_approved_alias_apply',
      'cleanup_required', true
    )
  from smoke_config, admin_user, target_food
  where not exists (
    select 1
    from public.food_aliases
    where normalized_alias = smoke_config.normalized_marker
  )
  returning id, query, normalized_query
),
smoke_queue as (
  insert into public.food_search_review_queue (
    query,
    normalized_query,
    context,
    suggested_canonical_food_id,
    frequency,
    status,
    reviewer_id,
    reviewed_at,
    comment,
    source_event_ids,
    metadata
  )
  select
    smoke_event.query,
    smoke_event.normalized_query,
    'admin',
    target_food.id,
    1,
    'approved',
    admin_user.id_user,
    now(),
    'OWNER-APPROVED SMOKE. Temporary alias apply test; cleanup required.',
    array[smoke_event.id],
    jsonb_build_object(
      'event_type', 'not_found',
      'smoke_marker', smoke_config.marker,
      'smoke_scope', 'admin_approved_alias_apply',
      'cleanup_required', true
    )
  from smoke_config, admin_user, target_food, smoke_event
  returning id, query, normalized_query, suggested_canonical_food_id, status, source_event_ids
)
select *
from smoke_queue;
```

Expected setup result:

- exactly one row returned from `smoke_queue`;
- `status = approved`;
- `source_event_ids` contains exactly one event id;
- `suggested_canonical_food_id` is not null.

## UI Smoke Step

After setup:

1. Open production as admin:
   - `https://tatianos7.github.io/POTOK/`
2. Navigate:
   - `/admin/search-review`
3. Find:
   - `POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP`
4. Confirm the row is approved and has `Apply alias`.
5. Click `Apply alias` exactly once.
6. Expected UI result:
   - `applied`;
   - no duplicate/conflict/orphan/permission error.

Do not test ambiguous/manual override in this smoke.

## Exact Post-Smoke SQL

Run this after the UI click and before cleanup.

```sql
-- Admin-approved Alias Apply production smoke post-check
-- Read-only validation after one UI apply click.

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
),
smoke_alias as (
  select fa.*
  from public.food_aliases fa
  join smoke_config on fa.normalized_alias = smoke_config.normalized_marker
),
smoke_queue as (
  select q.*
  from public.food_search_review_queue q
  join smoke_config on q.normalized_query = smoke_config.normalized_marker
     or q.metadata->>'smoke_marker' = smoke_config.marker
),
smoke_audit as (
  select a.*
  from public.food_alias_apply_audit a
  join smoke_config on a.normalized_alias = smoke_config.normalized_marker
)
select
  'smoke_alias_count' as check_name,
  (select count(*) from smoke_alias) as actual,
  1 as expected;

with smoke_config as (
  select public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
)
select
  'smoke_alias_shape' as check_name,
  id,
  canonical_food_id,
  alias,
  normalized_alias,
  source,
  verified,
  created_by_user_id
from public.food_aliases
where normalized_alias = (select normalized_marker from smoke_config);

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
)
select
  'smoke_audit_applied_count' as check_name,
  count(*) as actual,
  1 as expected
from public.food_alias_apply_audit
where normalized_alias = (select normalized_marker from smoke_config)
  and result = 'applied';

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
),
smoke_alias as (
  select id
  from public.food_aliases
  where normalized_alias = (select normalized_marker from smoke_config)
)
select
  'smoke_queue_applied_state' as check_name,
  id,
  status,
  applied_alias_id,
  alias_apply_result,
  alias_apply_error,
  alias_applied_by,
  alias_applied_at
from public.food_search_review_queue
where normalized_query = (select normalized_marker from smoke_config)
  and metadata->>'smoke_marker' = (select marker from smoke_config)
  and alias_apply_result = 'applied'
  and alias_apply_error is null
  and applied_alias_id in (select id from smoke_alias);

select 'food_alias_apply_audit' as table_name, count(*) as row_count from public.food_alias_apply_audit
union all
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

Expected post-smoke before cleanup:

- `smoke_alias_count = 1`.
- `smoke_audit_applied_count = 1`.
- `smoke_queue_applied_state` returns exactly one row.
- `foods = 2265` unchanged.
- `food_aliases = 2891` if baseline was `2890`.
- `food_alias_apply_audit = 1` if baseline was `0`.
- `food_search_review_queue = 1` if baseline was `0`.
- `food_search_events = 51` if baseline was `50` and no concurrent runtime search logging occurred.
- diary/favorites/recipes counts unchanged.

## Exact Cleanup SQL

Run cleanup after post-smoke validation unless owner explicitly decides to keep the smoke alias.

This removes only rows marked by `POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP`.

```sql
-- Admin-approved Alias Apply production smoke cleanup
-- Removes only temporary smoke artifacts for the exact marker.
-- This returns Food Core alias count to baseline.

begin;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
)
select
  'planned_smoke_alias_rows' as check_name,
  count(*) as rows_to_delete,
  1 as expected
from public.food_aliases fa, smoke_config
where fa.normalized_alias = smoke_config.normalized_marker
  and fa.alias = smoke_config.marker;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
),
deleted_audit as (
  delete from public.food_alias_apply_audit a
  using smoke_config
  where a.normalized_alias = smoke_config.normalized_marker
     or a.validation->>'smoke_marker' = smoke_config.marker
  returning a.id
)
select 'deleted_audit_rows' as check_name, count(*) as deleted_rows, 1 as expected
from deleted_audit;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
),
deleted_queue as (
  delete from public.food_search_review_queue q
  using smoke_config
  where q.normalized_query = smoke_config.normalized_marker
     or q.metadata->>'smoke_marker' = smoke_config.marker
  returning q.id
)
select 'deleted_queue_rows' as check_name, count(*) as deleted_rows, 1 as expected
from deleted_queue;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
),
deleted_alias as (
  delete from public.food_aliases fa
  using smoke_config
  where fa.normalized_alias = smoke_config.normalized_marker
    and fa.alias = smoke_config.marker
  returning fa.id
)
select 'deleted_alias_rows' as check_name, count(*) as deleted_rows, 1 as expected
from deleted_alias;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
),
deleted_event as (
  delete from public.food_search_events e
  using smoke_config
  where e.normalized_query = smoke_config.normalized_marker
     or e.metadata->>'smoke_marker' = smoke_config.marker
  returning e.id
)
select 'deleted_event_rows' as check_name, count(*) as deleted_rows, 1 as expected
from deleted_event;

commit;
```

Expected cleanup result:

- `deleted_alias_rows = 1`.
- `deleted_queue_rows = 1`.
- `deleted_event_rows = 1`.
- `deleted_audit_rows = 1`.

If any deleted count is not exactly `1`, stop and inspect before proceeding with any further write.

## Exact Cleanup Verification SQL

Run this after cleanup.

```sql
-- Admin-approved Alias Apply production smoke cleanup verification
-- Read-only.

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
)
select
  'smoke_alias_absent_after_cleanup' as check_name,
  not exists (
    select 1
    from public.food_aliases
    where normalized_alias = smoke_config.normalized_marker
  ) as actual,
  true as expected
from smoke_config;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
)
select
  'smoke_queue_absent_after_cleanup' as check_name,
  not exists (
    select 1
    from public.food_search_review_queue
    where normalized_query = smoke_config.normalized_marker
       or metadata->>'smoke_marker' = smoke_config.marker
  ) as actual,
  true as expected
from smoke_config;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
)
select
  'smoke_event_absent_after_cleanup' as check_name,
  not exists (
    select 1
    from public.food_search_events
    where normalized_query = smoke_config.normalized_marker
       or metadata->>'smoke_marker' = smoke_config.marker
  ) as actual,
  true as expected
from smoke_config;

with smoke_config as (
  select
    'POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP'::text as marker,
    public.normalize_food_text('POTOK_ALIAS_SMOKE_20260803_DO_NOT_KEEP') as normalized_marker
)
select
  'smoke_audit_absent_after_cleanup' as check_name,
  not exists (
    select 1
    from public.food_alias_apply_audit
    where normalized_alias = smoke_config.normalized_marker
       or validation->>'smoke_marker' = smoke_config.marker
  ) as actual,
  true as expected
from smoke_config;

select 'food_alias_apply_audit' as table_name, count(*) as row_count from public.food_alias_apply_audit
union all
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

Expected after cleanup:

- `foods = 2265`.
- `food_aliases = 2890`.
- `food_alias_apply_audit = 0`, if baseline was `0`.
- `food_search_review_queue = 0`, if baseline was `0`.
- `food_search_events = 50`, if baseline was `50` and no concurrent runtime search logging occurred.
- diary/favorites/recipes counts unchanged:
  - `food_diary_entries = 159`;
  - `favorite_products = 6`;
  - `recipes = 14`;
  - `recipe_ingredients = 43`.

## Stop Conditions

Stop before setup if:

- admin user is unavailable;
- RPC is missing;
- audit table is missing;
- queue apply columns are missing;
- no `core` target food exists;
- smoke alias already exists;
- smoke queue/event/audit marker already exists;
- `foods` is not `2265`;
- `food_aliases` is not `2890`;
- diary/favorites/recipes counts differ from the last known expected values and the owner has not accepted the drift.

Stop before UI apply if:

- setup returns zero rows or more than one row;
- queue row is not `approved`;
- queue row has no `source_event_ids`;
- queue row has no `suggested_canonical_food_id`;
- selected target food is not `source = 'core'`.

Stop after UI apply if:

- UI returns anything other than `applied`;
- `food_aliases` increased by more than `1`;
- more than one smoke alias row exists;
- no audit row exists with `result = 'applied'`;
- queue row is not terminal `alias_apply_result = 'applied'`;
- `foods` count changed;
- diary/favorites/recipes counts changed.

Stop during cleanup if:

- cleanup would delete more than one alias;
- cleanup would delete rows without the exact smoke marker;
- cleanup returns any unexpected delete count.

## Final Recommendation

This package is ready for an owner-approved production smoke. Run it only as a controlled owner action, apply exactly one alias through the UI, validate audit/queue state, then remove the temporary smoke artifacts unless the owner explicitly decides to keep the synthetic alias.
