# Missing Food Draft Correct Syrniki Owner Package

- Timestamp: 2026-08-10T00:00:00Z
- Basis: `reports/missing-food-owner-apply-smoke-food-cleanup-applied-final-status-2026-08-10.md`
- Target draft: `b65055c5-1283-46fd-ba69-de7f395eae88`
- Current draft name: `Сырники ки`
- Target draft name: `Сырники`
- Scope: owner package for correcting the existing Missing Food Draft name before any future owner apply
- Verdict: **SYRNIKI_DRAFT_CORRECTION_OWNER_PACKAGE_READY**

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

## Current Context

Smoke food cleanup is complete:

- smoke food `812e6711-4e99-4d1e-8b88-5a4b011b1ad3` was deleted;
- draft `b65055c5-1283-46fd-ba69-de7f395eae88` was reset to `ready_for_owner_apply`;
- `applied_food_id`, `applied_by`, and `applied_at` were cleared.

The remaining draft should be corrected from:

| Field | Current | Target |
| --- | --- | --- |
| `name` | `Сырники ки` | `Сырники` |
| `normalized_name` | `сырники ки` | `сырники` |

This package updates only the draft fields `name` and `normalized_name`.

## Exact Pre-Check SQL

Run immediately before the correction. Stop if any row returns `pass = false`.

```sql
-- Syrniki draft correction pre-check
-- Read-only. Do not update drafts, foods, aliases, diary, favorites, recipes, or search rows.

with target as (
  select
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id,
    'Сырники'::text as target_name,
    public.normalize_food_text('Сырники') as target_normalized_name
),
checks as (
  select
    'target_draft_exact_ready_state' as check_name,
    coalesce((
      select jsonb_build_object(
        'id', d.id,
        'status', d.status,
        'name', d.name,
        'normalized_name', d.normalized_name,
        'source', d.source,
        'unit', d.unit,
        'applied_food_id', d.applied_food_id,
        'applied_by', d.applied_by,
        'applied_at', d.applied_at
      )::text
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), 'missing') as actual,
    'ready_for_owner_apply / Сырники ки / сырники ки / applied_* null' as expected,
    coalesce((
      select d.status = 'ready_for_owner_apply'
        and d.name = 'Сырники ки'
        and d.normalized_name = 'сырники ки'
        and d.source = 'core'
        and d.unit = 'g'
        and d.applied_food_id is null
        and d.applied_by is null
        and d.applied_at is null
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), false) as pass

  union all
  select
    'target_normalization',
    (select target_normalized_name from target),
    'сырники',
    (select target_normalized_name = 'сырники' from target)

  union all
  select
    'no_food_duplicate_for_syrniki',
    count(*)::text,
    '0',
    count(*) = 0
  from public.foods f, target t
  where f.normalized_name = t.target_normalized_name
    and (f.source in ('core', 'brand') or coalesce(f.normalized_brand, '') = '')

  union all
  select
    'no_active_draft_duplicate_for_syrniki',
    count(*)::text,
    '0',
    count(*) = 0
  from public.food_missing_food_drafts d, target t
  where d.id <> t.draft_id
    and d.normalized_name = t.target_normalized_name
    and d.status in ('draft', 'needs_revision', 'ready_for_owner_apply')
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Baseline counts before correction:

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

Expected baseline from the latest cleanup status:

- `foods = 2266`
- `food_aliases = 2890`
- `food_alias_apply_audit = 0`
- `food_missing_food_drafts = 1`
- `food_missing_review_queue = 3`

If unrelated user activity changed aggregate counts, do not use count drift alone as a blocker. Still require all exact draft and duplicate/conflict checks to pass.

## Exact Correction SQL

Do not run unless owner approves this exact package and the pre-check passes.

```sql
-- Correct the existing Missing Food Draft from Сырники ки to Сырники
-- DRAFT ONLY. Owner-approved manual SQL package.
-- Expected effect:
-- - update exactly one draft;
-- - update only name and normalized_name;
-- - do not create foods;
-- - do not create aliases;
-- - do not call RPC;
-- - do not import/backfill/recompute.

begin;

do $$
declare
  v_draft_id uuid := 'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid;
  v_target_name text := 'Сырники';
  v_target_normalized_name text := public.normalize_food_text('Сырники');
  v_food_duplicates integer;
  v_draft_duplicates integer;
  v_updated_drafts integer;
begin
  if v_target_normalized_name <> 'сырники' then
    raise exception 'Unexpected normalization for %. Got %', v_target_name, v_target_normalized_name;
  end if;

  if not exists (
    select 1
    from public.food_missing_food_drafts d
    where d.id = v_draft_id
      and d.status = 'ready_for_owner_apply'
      and d.name = 'Сырники ки'
      and d.normalized_name = 'сырники ки'
      and d.source = 'core'
      and d.unit = 'g'
      and d.applied_food_id is null
      and d.applied_by is null
      and d.applied_at is null
  ) then
    raise exception 'Target draft is missing or no longer has the expected exact ready state: %', v_draft_id;
  end if;

  select count(*)
  into v_food_duplicates
  from public.foods f
  where f.normalized_name = v_target_normalized_name
    and (f.source in ('core', 'brand') or coalesce(f.normalized_brand, '') = '');

  if v_food_duplicates <> 0 then
    raise exception 'Cannot correct draft to %. Existing shared food duplicates found: %', v_target_normalized_name, v_food_duplicates;
  end if;

  select count(*)
  into v_draft_duplicates
  from public.food_missing_food_drafts d
  where d.id <> v_draft_id
    and d.normalized_name = v_target_normalized_name
    and d.status in ('draft', 'needs_revision', 'ready_for_owner_apply');

  if v_draft_duplicates <> 0 then
    raise exception 'Cannot correct draft to %. Active draft duplicates found: %', v_target_normalized_name, v_draft_duplicates;
  end if;

  update public.food_missing_food_drafts
  set
    name = v_target_name,
    normalized_name = v_target_normalized_name
  where id = v_draft_id
    and status = 'ready_for_owner_apply'
    and name = 'Сырники ки'
    and normalized_name = 'сырники ки'
    and applied_food_id is null
    and applied_by is null
    and applied_at is null;

  get diagnostics v_updated_drafts = row_count;
  if v_updated_drafts <> 1 then
    raise exception 'Expected to update exactly 1 draft, updated %', v_updated_drafts;
  end if;
end $$;

commit;
```

## Exact Post-Check SQL

Run immediately after correction:

```sql
-- Syrniki draft correction post-check
-- Read-only. Validates draft correction only.

with target as (
  select
    'b65055c5-1283-46fd-ba69-de7f395eae88'::uuid as draft_id,
    public.normalize_food_text('Сырники') as target_normalized_name
),
checks as (
  select
    'target_draft_corrected' as check_name,
    coalesce((
      select jsonb_build_object(
        'id', d.id,
        'status', d.status,
        'name', d.name,
        'normalized_name', d.normalized_name,
        'applied_food_id', d.applied_food_id,
        'applied_by', d.applied_by,
        'applied_at', d.applied_at
      )::text
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), 'missing') as actual,
    'ready_for_owner_apply / Сырники / сырники / applied_* null' as expected,
    coalesce((
      select d.status = 'ready_for_owner_apply'
        and d.name = 'Сырники'
        and d.normalized_name = t.target_normalized_name
        and d.applied_food_id is null
        and d.applied_by is null
        and d.applied_at is null
      from public.food_missing_food_drafts d, target t
      where d.id = t.draft_id
    ), false) as pass

  union all
  select
    'no_food_created',
    count(*)::text,
    '2266',
    count(*) = 2266
  from public.foods

  union all
  select
    'no_alias_created',
    count(*)::text,
    '2890',
    count(*) = 2890
  from public.food_aliases

  union all
  select
    'alias_apply_audit_unchanged',
    count(*)::text,
    '0',
    count(*) = 0
  from public.food_alias_apply_audit
)
select check_name, actual, expected, pass
from checks
order by check_name;
```

Counts check after correction:

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

- `food_missing_food_drafts` count unchanged;
- `foods` unchanged;
- `food_aliases` unchanged;
- `food_alias_apply_audit` unchanged;
- diary/favorites/recipes/search counts unchanged.

## Stop Conditions

Stop before correction if:

- owner has not approved this exact package;
- branch/context is not the intended production owner-maintenance context;
- pre-check returns any `pass = false`;
- target draft is not exactly `ready_for_owner_apply`;
- target draft does not currently have `name = 'Сырники ки'` and `normalized_name = 'сырники ки'`;
- any `applied_*` field is filled;
- `public.normalize_food_text('Сырники')` does not return `сырники`;
- `foods` already contains a shared `core`/`brand` duplicate for `normalized_name = 'сырники'`;
- another active Missing Food Draft already has `normalized_name = 'сырники'`;
- baseline counts were not captured.

Stop during correction if:

- the transaction raises any exception;
- the update affects anything other than exactly one draft row.

Stop after correction if:

- target draft is not `ready_for_owner_apply`;
- target draft name/normalized name are not `Сырники` / `сырники`;
- any `applied_*` field becomes filled;
- `foods` count changes;
- `food_aliases` count changes;
- `food_alias_apply_audit` changes;
- diary/favorites/recipes/search counts change unexpectedly.

## Rollback Notes

If the correction transaction stops before commit:

- no production change should persist;
- inspect the raised exception;
- re-run the pre-check;
- prepare a revised package only after reviewing the changed state.

If correction succeeds but owner later decides the draft should remain unready:

- use a separate owner-reviewed package to move the draft to `needs_revision`;
- do not clear nutrition/provenance accidentally;
- do not create foods or aliases.

If owner later applies the corrected draft:

- run a fresh owner-apply pre-check first;
- create the corrected food only through `public.apply_owner_approved_missing_food_draft(...)`;
- keep alias follow-up separate through Admin-approved Alias Apply.

## Final Status

Owner package is ready for correcting the existing draft from `Сырники ки` to `Сырники`. The package updates only `food_missing_food_drafts.name` and `food_missing_food_drafts.normalized_name`, keeps counts unchanged, and preserves the no-food/no-alias/no-RPC/no-import/no-backfill/no-recompute boundary for Codex.
