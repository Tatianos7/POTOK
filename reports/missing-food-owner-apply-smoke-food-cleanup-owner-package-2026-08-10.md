# Missing Food Owner Apply Smoke Food Cleanup Owner Package

- Timestamp: 2026-08-10T00:00:00Z
- Basis: `reports/missing-food-owner-apply-smoke-food-cleanup-plan-2026-08-09.md`
- Production smoke status: `reports/missing-food-owner-apply-production-smoke-2026-08-09.md`
- Target food: `812e6711-4e99-4d1e-8b88-5a4b011b1ad3`
- Target draft: `b65055c5-1283-46fd-ba69-de7f395eae88`
- Scope: owner cleanup package for rollback/delete of the smoke-created food
- Verdict: **SMOKE_FOOD_CLEANUP_OWNER_PACKAGE_READY**

## Safety

- Package/report only.
- SQL was not applied.
- Production DB schema was not changed.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- RPC was not called.
- No foods were created.
- No aliases were added.
- No import/backfill/recompute was run.
- No PR was created.

## Owner Decision

Owner read-only link checks:

| Link surface | Count |
| --- | ---: |
| `favorite_products` | 0 |
| `food_aliases` | 0 |
| `food_diary_entries` | 0 |
| `recipe_ingredients` | 0 |
| `food_missing_food_drafts_applied` | 1 |

Decision:

- rollback/delete is safe because the smoke-created food has no downstream links except the expected applied draft;
- cleanup should not create a replacement food;
- cleanup should not create aliases;
- cleanup should not call the owner-apply RPC or Alias Apply RPC.

## Expected Cleanup Result

The cleanup transaction should:

1. Verify the exact smoke food row.
2. Verify the exact applied draft link.
3. Verify no downstream links exist.
4. Reset the draft to `ready_for_owner_apply`.
5. Clear `applied_food_id`, `applied_by`, and `applied_at`.
6. Delete the smoke food by exact id and exact smoke shape.

Expected post-cleanup counts:

| Table | Expected count |
| --- | ---: |
| `foods` | 2266 |
| `food_aliases` | 2890 |
| `food_alias_apply_audit` | 0 |

Expected object state:

- target food no longer exists;
- target draft remains in `food_missing_food_drafts`;
- target draft has `status = 'ready_for_owner_apply'`;
- target draft has all `applied_*` fields set to `null`.

## Exact Pre-Check SQL

Run immediately before cleanup. Stop if any row returns `pass = false`.

```sql
-- Smoke-created food cleanup pre-check
-- Read-only. Do not update/delete foods, drafts, aliases, diary, favorites, recipes, or search rows.

with target as (
  select
    '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid as food_id,
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id
),
checks as (
  select
    'target_food_exact_shape' as check_name,
    coalesce((
      select jsonb_build_object(
        'id', f.id,
        'name', f.name,
        'normalized_name', f.normalized_name,
        'source', f.source,
        'category', f.category,
        'canonical_food_id', f.canonical_food_id
      )::text
      from public.foods f, target t
      where f.id = t.food_id
    ), 'missing') as actual,
    'Сырники ки / сырники ки / core / desserts / self-root' as expected,
    coalesce((
      select f.name = 'Сырники ки'
        and f.normalized_name = 'сырники ки'
        and f.source = 'core'
        and f.category = 'desserts'
        and f.canonical_food_id = f.id
      from public.foods f, target t
      where f.id = t.food_id
    ), false) as pass

  union all
  select
    'target_draft_applied_link',
    coalesce((
      select jsonb_build_object(
        'id', d.id,
        'status', d.status,
        'applied_food_id', d.applied_food_id,
        'applied_by_filled', d.applied_by is not null,
        'applied_at_filled', d.applied_at is not null
      )::text
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), 'missing'),
    'applied draft linked to target food',
    coalesce((
      select d.status = 'applied'
        and d.applied_food_id = t.food_id
        and d.applied_by is not null
        and d.applied_at is not null
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), false)

  union all
  select 'favorite_products_refs', count(*)::text, '0', count(*) = 0
  from public.favorite_products fp, target t
  where fp.canonical_food_id = t.food_id

  union all
  select 'food_aliases_refs', count(*)::text, '0', count(*) = 0
  from public.food_aliases a, target t
  where a.canonical_food_id = t.food_id

  union all
  select 'food_alias_apply_audit_refs', count(*)::text, '0', count(*) = 0
  from public.food_alias_apply_audit a, target t
  where a.canonical_food_id = t.food_id

  union all
  select 'food_diary_entries_refs', count(*)::text, '0', count(*) = 0
  from public.food_diary_entries e, target t
  where e.canonical_food_id = t.food_id

  union all
  select 'recipe_ingredients_refs', count(*)::text, '0', count(*) = 0
  from public.recipe_ingredients ri, target t
  where ri.food_id = t.food_id

  union all
  select 'food_search_events_selected_refs', count(*)::text, '0', count(*) = 0
  from public.food_search_events e, target t
  where e.selected_canonical_food_id = t.food_id

  union all
  select 'food_search_events_candidate_refs', count(*)::text, '0', count(*) = 0
  from public.food_search_events e, target t
  where t.food_id = any(coalesce(e.candidate_canonical_food_ids, '{}'::uuid[]))

  union all
  select 'food_search_review_queue_refs', count(*)::text, '0', count(*) = 0
  from public.food_search_review_queue q, target t
  where q.suggested_canonical_food_id = t.food_id

  union all
  select 'missing_food_drafts_applied_refs', count(*)::text, '1', count(*) = 1
  from public.food_missing_food_drafts d, target t
  where d.applied_food_id = t.food_id
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Baseline counts before cleanup:

```sql
select 'foods' as table_name, count(*) as row_count from public.foods
union all select 'food_aliases', count(*) from public.food_aliases
union all select 'food_alias_apply_audit', count(*) from public.food_alias_apply_audit
union all select 'food_missing_food_drafts', count(*) from public.food_missing_food_drafts
union all select 'food_missing_review_queue', count(*) from public.food_missing_review_queue
union all select 'food_search_events', count(*) from public.food_search_events
union all select 'food_search_review_queue', count(*) from public.food_search_review_queue
union all select 'food_diary_entries', count(*) from public.food_diary_entries
union all select 'favorite_products', count(*) from public.favorite_products
union all select 'recipes', count(*) from public.recipes
union all select 'recipe_ingredients', count(*) from public.recipe_ingredients
order by table_name;
```

Expected baseline immediately before cleanup, based on latest smoke context:

- `foods = 2267`
- `food_aliases = 2890`
- `food_alias_apply_audit = 0`
- `food_missing_food_drafts = 1`

If production counts have changed for unrelated user activity, do not use count drift alone as a blocker. Still require all exact target and reference checks to pass.

## Exact Cleanup Transaction

Do not run unless owner approves this exact package and the pre-check passes.

```sql
-- Smoke-created food rollback/delete cleanup
-- DRAFT ONLY. Owner-approved manual SQL package.
-- Expected effect:
-- - reset one draft to ready_for_owner_apply and clear applied_*;
-- - delete exactly one smoke-created food;
-- - do not create foods;
-- - do not create aliases;
-- - do not call RPC;
-- - do not import/backfill/recompute.

begin;

do $$
declare
  v_food_id uuid := '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid;
  v_draft_id uuid := 'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid;
  v_external_refs integer;
  v_draft_refs integer;
  v_updated_drafts integer;
  v_deleted_foods integer;
begin
  if not exists (
    select 1
    from public.foods f
    where f.id = v_food_id
      and f.name = 'Сырники ки'
      and f.normalized_name = 'сырники ки'
      and f.source = 'core'
      and f.category = 'desserts'
      and f.canonical_food_id = f.id
  ) then
    raise exception 'Target smoke food is missing or no longer has the expected exact shape: %', v_food_id;
  end if;

  if not exists (
    select 1
    from public.food_missing_food_drafts d
    where d.id = v_draft_id
      and d.status = 'applied'
      and d.applied_food_id = v_food_id
      and d.applied_by is not null
      and d.applied_at is not null
  ) then
    raise exception 'Target draft is missing or no longer applied to target food: %', v_draft_id;
  end if;

  select sum(ref_count)::integer
  into v_external_refs
  from (
    select count(*) as ref_count from public.favorite_products where canonical_food_id = v_food_id
    union all select count(*) from public.food_aliases where canonical_food_id = v_food_id
    union all select count(*) from public.food_alias_apply_audit where canonical_food_id = v_food_id
    union all select count(*) from public.food_diary_entries where canonical_food_id = v_food_id
    union all select count(*) from public.recipe_ingredients where food_id = v_food_id
    union all select count(*) from public.food_search_events where selected_canonical_food_id = v_food_id
    union all select count(*) from public.food_search_events where v_food_id = any(coalesce(candidate_canonical_food_ids, '{}'::uuid[]))
    union all select count(*) from public.food_search_review_queue where suggested_canonical_food_id = v_food_id
  ) refs;

  if coalesce(v_external_refs, 0) <> 0 then
    raise exception 'Cannot delete smoke food %. External references found: %', v_food_id, v_external_refs;
  end if;

  select count(*)
  into v_draft_refs
  from public.food_missing_food_drafts
  where applied_food_id = v_food_id;

  if v_draft_refs <> 1 then
    raise exception 'Expected exactly 1 draft applied to smoke food %, found %', v_food_id, v_draft_refs;
  end if;

  update public.food_missing_food_drafts
  set
    status = 'ready_for_owner_apply',
    applied_food_id = null,
    applied_by = null,
    applied_at = null
  where id = v_draft_id
    and status = 'applied'
    and applied_food_id = v_food_id;

  get diagnostics v_updated_drafts = row_count;
  if v_updated_drafts <> 1 then
    raise exception 'Expected to reset exactly 1 draft, reset %', v_updated_drafts;
  end if;

  delete from public.foods
  where id = v_food_id
    and name = 'Сырники ки'
    and normalized_name = 'сырники ки'
    and source = 'core'
    and category = 'desserts'
    and canonical_food_id = id;

  get diagnostics v_deleted_foods = row_count;
  if v_deleted_foods <> 1 then
    raise exception 'Expected to delete exactly 1 smoke food, deleted %', v_deleted_foods;
  end if;
end $$;

commit;
```

## Exact Post-Check SQL

Run immediately after cleanup:

```sql
-- Smoke-created food cleanup post-check
-- Read-only. Validates cleanup result only.

with target as (
  select
    '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid as food_id,
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id
),
checks as (
  select
    'target_food_deleted' as check_name,
    count(*)::text as actual,
    '0' as expected,
    count(*) = 0 as pass
  from public.foods f, target t
  where f.id = t.food_id

  union all
  select
    'target_draft_ready_again',
    coalesce((
      select jsonb_build_object(
        'status', d.status,
        'applied_food_id', d.applied_food_id,
        'applied_by', d.applied_by,
        'applied_at', d.applied_at
      )::text
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), 'missing'),
    'ready_for_owner_apply with applied_* null',
    coalesce((
      select d.status = 'ready_for_owner_apply'
        and d.applied_food_id is null
        and d.applied_by is null
        and d.applied_at is null
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), false)

  union all
  select 'food_aliases_refs_after_cleanup', count(*)::text, '0', count(*) = 0
  from public.food_aliases a, target t
  where a.canonical_food_id = t.food_id

  union all
  select 'alias_apply_audit_refs_after_cleanup', count(*)::text, '0', count(*) = 0
  from public.food_alias_apply_audit a, target t
  where a.canonical_food_id = t.food_id
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Counts check after cleanup:

```sql
select 'foods' as table_name, count(*) as row_count, 2266 as expected_count from public.foods
union all select 'food_aliases', count(*), 2890 from public.food_aliases
union all select 'food_alias_apply_audit', count(*), 0 from public.food_alias_apply_audit
union all select 'food_missing_food_drafts', count(*), 1 from public.food_missing_food_drafts
union all select 'food_missing_review_queue', count(*), 3 from public.food_missing_review_queue
union all select 'food_search_events', count(*), 100 from public.food_search_events
union all select 'food_search_review_queue', count(*), 2 from public.food_search_review_queue
union all select 'food_diary_entries', count(*), 168 from public.food_diary_entries
union all select 'favorite_products', count(*), 7 from public.favorite_products
union all select 'recipes', count(*), 15 from public.recipes
union all select 'recipe_ingredients', count(*), 47 from public.recipe_ingredients
order by table_name;
```

Expected:

- `foods = 2266`;
- `food_aliases = 2890`;
- `food_alias_apply_audit = 0`;
- `food_missing_food_drafts = 1`;
- no aliases created;
- no audit row created;
- no diary/favorite/recipe/search rows changed.

## Stop Conditions

Stop before cleanup if:

- owner has not approved this exact package;
- pre-check returns any `pass = false`;
- target food exact shape does not match `Сырники ки` / `сырники ки` / `core` / `desserts`;
- target draft is not `applied` to the target food;
- any downstream reference count is nonzero;
- more than one draft is applied to the target food;
- current baseline counts are not captured.

Stop during cleanup if:

- the transaction raises any exception;
- draft reset affects anything other than exactly one row;
- food delete affects anything other than exactly one row.

Stop after cleanup if:

- target food still exists;
- target draft is not `ready_for_owner_apply`;
- any `applied_*` field remains filled;
- `foods` is not `2266`;
- `food_aliases` changed from `2890`;
- `food_alias_apply_audit` changed from `0`;
- diary/favorites/recipes/search counts changed unexpectedly.

## Rollback Notes If Delete Is Not Possible

If cleanup transaction stops before commit:

- no production change should persist;
- inspect the raised exception;
- re-run the pre-check;
- prepare a revised package only after reviewing the changed reference state.

If cleanup stops because downstream links appeared:

- do not delete the food;
- prepare a separate remap/rename plan;
- keep alias creation separate through Admin-approved Alias Apply.

If cleanup succeeds but owner later wants to create a corrected food:

- review/update the existing draft while it is back at `ready_for_owner_apply`;
- run owner apply through the installed RPC only after a fresh duplicate/pre-check;
- do not manually insert into `foods`;
- do not automatically create aliases.

## Final Status

Owner cleanup package is ready. The package deletes only the smoke-created food after resetting the linked draft back to `ready_for_owner_apply`, preserves `food_aliases`, avoids all RPC/import/backfill/recompute paths, and includes exact pre/post validation.
