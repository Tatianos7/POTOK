# Missing Food Owner Apply Smoke Food Cleanup Plan

- Timestamp: 2026-08-09T00:00:00Z
- Basis: `reports/missing-food-owner-apply-production-smoke-2026-08-09.md`
- Target food: `812e6711-4e99-4d1e-8b88-5a4b011b1ad3`
- Target draft: `b65055c5-1283-46fd-ba69-de7f395eae88`
- Scope: read-only cleanup/correction plan for the smoke-created Missing Food core food
- Verdict: **SMOKE_FOOD_CLEANUP_PLAN_READY**

## Safety

- Plan/report only.
- Production DB schema was not changed.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- SQL was not applied.
- RPC was not called.
- No additional foods were created.
- No aliases were added.
- No import/backfill/recompute was run.
- No PR was created.

## Target State

Smoke-created food:

| Field | Value |
| --- | --- |
| `id` | `812e6711-4e99-4d1e-8b88-5a4b011b1ad3` |
| `name` | `Сырники ки` |
| `normalized_name` | `сырники ки` |
| `source` | `core` |
| `category` | `desserts` |

Applied draft:

| Field | Value |
| --- | --- |
| `id` | `b65055c5-1283-46fd-ba69-de7f395eae88` |
| `status` | `applied` |
| `applied_food_id` | `812e6711-4e99-4d1e-8b88-5a4b011b1ad3` |

## Link Surfaces To Check

The smoke food may be referenced by:

- `food_missing_food_drafts.applied_food_id`
- `food_aliases.canonical_food_id`
- `food_alias_apply_audit.canonical_food_id`
- `food_diary_entries.canonical_food_id`
- `favorite_products.canonical_food_id`
- `recipe_ingredients.food_id`
- `food_search_events.selected_canonical_food_id`
- `food_search_events.candidate_canonical_food_ids`
- `food_search_review_queue.suggested_canonical_food_id`

## Recommended Decision

Safest default:

- If all downstream reference checks are zero except the expected applied draft reference, rollback/delete the smoke food. This removes the imperfect smoke artifact instead of converting test data into a real core catalog row.
- If any diary/favorite/recipe/search/alias references already exist, do not delete. Prefer rename only if `Сырники` has no duplicate/conflict in shared `foods`.
- If `Сырники` already exists as a shared `core`/`brand` food, stop. Do not rename into a duplicate and do not delete a referenced food without a separate remap package.

## Read-Only Inspection SQL

Run before choosing rename or rollback/delete:

```sql
-- Smoke-created Missing Food cleanup inspection
-- Read-only. Do not update foods, drafts, aliases, diary, favorites, recipes, or search rows.

with target as (
  select
    '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid as food_id,
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id,
    public.normalize_food_text('Сырники') as rename_normalized_name
),
checks as (
  select
    'target_food_exists' as check_name,
    count(*)::text as actual,
    '1' as expected,
    count(*) = 1 as pass
  from public.foods f, target t
  where f.id = t.food_id

  union all
  select
    'target_food_shape',
    coalesce((
      select jsonb_build_object(
        'name', f.name,
        'normalized_name', f.normalized_name,
        'source', f.source,
        'category', f.category,
        'canonical_food_id', f.canonical_food_id
      )::text
      from public.foods f, target t
      where f.id = t.food_id
    ), 'missing'),
    'core smoke food Сырники ки',
    coalesce((
      select f.name = 'Сырники ки'
        and f.normalized_name = 'сырники ки'
        and f.source = 'core'
        and f.canonical_food_id = f.id
      from public.foods f, target t
      where f.id = t.food_id
    ), false)

  union all
  select
    'draft_applied_to_target',
    coalesce((
      select jsonb_build_object(
        'status', d.status,
        'applied_food_id', d.applied_food_id,
        'applied_by_filled', d.applied_by is not null,
        'applied_at_filled', d.applied_at is not null
      )::text
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), 'missing'),
    'applied to target food',
    coalesce((
      select d.status = 'applied'
        and d.applied_food_id = t.food_id
        and d.applied_by is not null
        and d.applied_at is not null
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), false)

  union all
  select
    'duplicate_for_rename_to_syrniki',
    count(*)::text,
    '0',
    count(*) = 0
  from public.foods f, target t
  where f.id <> t.food_id
    and f.normalized_name = t.rename_normalized_name
    and (f.source in ('core', 'brand') or coalesce(f.normalized_brand, '') = '')

  union all
  select 'food_alias_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.food_aliases a, target t
  where a.canonical_food_id = t.food_id

  union all
  select 'alias_apply_audit_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.food_alias_apply_audit a, target t
  where a.canonical_food_id = t.food_id

  union all
  select 'diary_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.food_diary_entries e, target t
  where e.canonical_food_id = t.food_id

  union all
  select 'favorite_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.favorite_products fp, target t
  where fp.canonical_food_id = t.food_id

  union all
  select 'recipe_ingredient_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.recipe_ingredients ri, target t
  where ri.food_id = t.food_id

  union all
  select 'search_selected_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.food_search_events e, target t
  where e.selected_canonical_food_id = t.food_id

  union all
  select 'search_candidate_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.food_search_events e, target t
  where t.food_id = any(coalesce(e.candidate_canonical_food_ids, '{}'::uuid[]))

  union all
  select 'search_review_suggested_refs', count(*)::text, '0 for delete', count(*) = 0
  from public.food_search_review_queue q, target t
  where q.suggested_canonical_food_id = t.food_id

  union all
  select 'missing_draft_applied_refs',
    count(*)::text,
    '1 expected current applied draft only',
    count(*) = 1
  from public.food_missing_food_drafts d, target t
  where d.applied_food_id = t.food_id
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Stop if `target_food_exists`, `target_food_shape`, or `draft_applied_to_target` is false.

## Option A: Rename Draft

Use only if owner decides the smoke-created row should remain as a real core food and:

- `duplicate_for_rename_to_syrniki = 0`;
- no existing shared `foods.normalized_name` conflicts with `public.normalize_food_text('Сырники')`;
- owner accepts keeping the nutrition/provenance from the smoke draft.

SQL draft, not applied:

```sql
-- Option A: rename smoke-created core food to Сырники
-- DRAFT ONLY. Run only after owner approval and read-only checks pass.
-- Updates name/normalized_name only on the target food and linked applied draft.

begin;

with target as (
  select
    '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid as food_id,
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id,
    'Сырники'::text as new_name,
    public.normalize_food_text('Сырники') as new_normalized_name
),
guard as (
  select
    not exists (
      select 1
      from public.foods other, target t
      where other.id <> t.food_id
        and other.normalized_name = t.new_normalized_name
        and (other.source in ('core', 'brand') or coalesce(other.normalized_brand, '') = '')
    ) as no_duplicate
)
update public.foods f
set
  name = t.new_name,
  normalized_name = t.new_normalized_name
from target t, guard g
where f.id = t.food_id
  and f.name = 'Сырники ки'
  and f.normalized_name = 'сырники ки'
  and f.source = 'core'
  and f.canonical_food_id = f.id
  and g.no_duplicate
returning f.id, f.name, f.normalized_name, f.source, f.category;

with target as (
  select
    '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid as food_id,
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id,
    'Сырники'::text as new_name,
    public.normalize_food_text('Сырники') as new_normalized_name
)
update public.food_missing_food_drafts d
set
  name = t.new_name,
  normalized_name = t.new_normalized_name
from target t
where d.id = t.draft_id
  and d.status = 'applied'
  and d.applied_food_id = t.food_id
returning d.id, d.name, d.normalized_name, d.status, d.applied_food_id;

commit;
```

Rename post-check:

```sql
with target as (
  select
    '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid as food_id,
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id
)
select 'food_renamed' as check_name,
  jsonb_build_object('name', f.name, 'normalized_name', f.normalized_name)::text as actual,
  'Сырники / сырники' as expected,
  f.name = 'Сырники' and f.normalized_name = public.normalize_food_text('Сырники') as pass
from public.foods f, target t
where f.id = t.food_id
union all
select 'draft_renamed',
  jsonb_build_object('name', d.name, 'normalized_name', d.normalized_name, 'status', d.status)::text,
  'Сырники / сырники / applied',
  d.name = 'Сырники'
    and d.normalized_name = public.normalize_food_text('Сырники')
    and d.status = 'applied'
from public.food_missing_food_drafts d, target t
where d.id = t.draft_id;
```

Expected counts after rename:

- `foods` unchanged at the pre-rename count.
- `food_aliases` unchanged.
- `food_alias_apply_audit` unchanged.
- `food_missing_food_drafts` unchanged.
- diary/favorites/recipes/search counts unchanged.

## Option B: Rollback/Delete Draft

Use only if owner decides the smoke artifact should not remain and all reference checks are zero except `missing_draft_applied_refs = 1`.

Important constraint note:

- Do not delete the food first.
- `food_missing_food_drafts.applied_food_id` has `on delete set null`, but the `applied` draft shape requires `applied_food_id`, `applied_by`, and `applied_at` to stay filled.
- The safe rollback order is:
  - reset the draft away from `applied`;
  - clear `applied_food_id`, `applied_by`, `applied_at`;
  - then delete the target food.

SQL draft, not applied:

```sql
-- Option B: rollback/delete smoke-created food
-- DRAFT ONLY. Run only after owner approval and zero-reference checks pass.
-- Does not delete aliases because no aliases should reference this smoke food.

begin;

do $$
declare
  v_food_id uuid := '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid;
  v_draft_id uuid := 'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid;
  v_external_refs integer;
  v_updated_drafts integer;
  v_deleted_foods integer;
begin
  select sum(ref_count)::integer
  into v_external_refs
  from (
    select count(*) as ref_count from public.food_aliases where canonical_food_id = v_food_id
    union all select count(*) from public.food_alias_apply_audit where canonical_food_id = v_food_id
    union all select count(*) from public.food_diary_entries where canonical_food_id = v_food_id
    union all select count(*) from public.favorite_products where canonical_food_id = v_food_id
    union all select count(*) from public.recipe_ingredients where food_id = v_food_id
    union all select count(*) from public.food_search_events where selected_canonical_food_id = v_food_id
    union all select count(*) from public.food_search_events where v_food_id = any(coalesce(candidate_canonical_food_ids, '{}'::uuid[]))
    union all select count(*) from public.food_search_review_queue where suggested_canonical_food_id = v_food_id
  ) refs;

  if coalesce(v_external_refs, 0) <> 0 then
    raise exception 'Cannot delete smoke food %. External references found: %', v_food_id, v_external_refs;
  end if;

  update public.food_missing_food_drafts
  set
    status = 'needs_revision',
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
    and canonical_food_id = id;

  get diagnostics v_deleted_foods = row_count;
  if v_deleted_foods <> 1 then
    raise exception 'Expected to delete exactly 1 smoke food, deleted %', v_deleted_foods;
  end if;
end $$;

commit;
```

Rollback/delete post-check:

```sql
with target as (
  select
    '812e6711-4e99-4d1e-8b88-5a4b011b1ad3'::uuid as food_id,
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id
),
checks as (
  select 'food_deleted' as check_name,
    count(*)::text as actual,
    '0' as expected,
    count(*) = 0 as pass
  from public.foods f, target t
  where f.id = t.food_id

  union all
  select 'draft_reset',
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
    'needs_revision with applied_* null',
    coalesce((
      select d.status = 'needs_revision'
        and d.applied_food_id is null
        and d.applied_by is null
        and d.applied_at is null
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), false)
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Expected counts after rollback/delete:

- `foods = pre-delete foods - 1`.
- `food_aliases` unchanged.
- `food_alias_apply_audit` unchanged.
- `food_missing_food_drafts` unchanged.
- diary/favorites/recipes/search counts unchanged.

## Stop Conditions

Stop before any correction if:

- branch/context is not the intended production owner-maintenance context;
- owner has not approved the exact option and exact target ids;
- read-only inspection was not run immediately before the change;
- target food shape does not match the smoke-created row;
- target draft is not the expected applied draft;
- any unexpected references exist;
- `Сырники` duplicate/conflict exists and the chosen option is rename;
- counts baseline was not captured.

Stop during rollback/delete if:

- any external references are found;
- draft reset does not update exactly one row;
- food delete does not delete exactly one row.

Stop after correction if:

- `food_aliases` changes;
- `food_alias_apply_audit` changes;
- diary/favorites/recipes/search counts change unexpectedly;
- rename does not update both food and draft names;
- rollback/delete does not remove the food and reset the draft.

## Final Recommendation

Run the read-only inspection first.

If the smoke food has no downstream references, choose Option B rollback/delete. That is the cleanest correction because the row was created only for smoke and has an imperfect canonical name.

If the food has already been referenced, do not delete it. Choose Option A rename only if `Сырники` has no shared-food duplicate. If a duplicate exists, prepare a separate conflict/remap decision package before touching production data.
