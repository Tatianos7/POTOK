# Missing Food Drafts DB Draft Review

- Timestamp: 2026-08-08T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260808_missing_food_drafts_draft.sql`
- Reviewed report: `reports/missing-food-drafts-db-draft-2026-08-08.md`
- Prior verdict: `MISSING_FOOD_DRAFTS_DB_DRAFT_READY`
- Review verdict: **MISSING_FOOD_DRAFTS_DB_APPLY_READY**

## Safety

- Review/report only.
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

## Summary

The draft is apply-ready for owner review.

It creates a draft-only admin table:

- `public.food_missing_food_drafts`

It does not create foods or aliases and does not define any trigger/function that can write to:

- `public.foods`
- `public.food_aliases`

The design matches the approved MVP decisions:

- `source = 'core'` only;
- `unit = 'g'` only;
- `brand` inactive;
- `barcode` inactive;
- `data_source` free text;
- evidence linked through `source_review_id`.

## Dependency Review

Required production dependencies are correctly identified:

- `public.food_missing_review_queue`
- `public.user_profiles.id_user`
- `public.user_profiles.is_admin`
- `public.normalize_food_text(value text)`
- `gen_random_uuid()`
- `public.foods(id)`
- `auth.users(id)`

Assessment:

- `source_review_id` has a required FK to `food_missing_review_queue(id)`.
- `applied_food_id` has an optional FK to `foods(id)` for future apply tracking only.
- Admin policies use the production-correct `user_profiles.id_user = auth.uid()`.
- `normalize_food_text(value text)` is used only for draft-name consistency and is included in the pre-check.
- `gen_random_uuid()` is already used by existing applied migrations and is included implicitly by table defaults.

Pre-apply should still confirm every dependency in production immediately before owner apply.

## Table / Status Contract

Status values are appropriate:

- `draft`
- `needs_revision`
- `ready_for_owner_apply`
- `rejected`
- `applied`

The shape checks are acceptable:

- `ready_for_owner_apply` requires a complete food draft.
- `applied` requires a complete food draft and future apply tracking fields.
- non-applied rows cannot carry apply tracking fields.

This preserves the draft-only contract while leaving a clean terminal state for a later separately approved food-creation workflow.

## Constraint Review

Pass:

- `query` and `normalized_query` cannot be blank.
- optional text fields cannot be whitespace-only.
- `normalized_name` must match `public.normalize_food_text(name)` when both are present.
- `source = 'core'`.
- `unit = 'g'`.
- `brand is null`.
- `barcode is null`.
- calories/protein/fat/carbs are nullable while drafting, but required for `ready_for_owner_apply`.
- fiber is nullable and non-negative when present.
- nutrition values have bounded ranges.

The constraints are intentionally strict for the current MVP but not too strict for the planned UI:

- admins can save incomplete `draft` or `needs_revision` rows;
- complete nutrition/provenance is required only before `ready_for_owner_apply`;
- brand/barcode can be introduced later through a separate reviewed migration when the active brand/barcode flow exists.

## RLS Review

Pass.

The table enables RLS and defines one admin-only policy:

- `food_missing_food_drafts_admin_all`

The policy covers all operations for `authenticated` users and uses:

```sql
exists (
  select 1
  from public.user_profiles
  where id_user = auth.uid()
    and is_admin = true
)
```

No non-admin policy is defined.

## Index Review

Pass.

Expected indexes are present in the draft:

- `food_missing_food_drafts_source_review_id_idx`
- `food_missing_food_drafts_status_updated_at_idx`
- `food_missing_food_drafts_normalized_name_idx`
- `food_missing_food_drafts_source_idx`
- `food_missing_food_drafts_applied_food_id_idx`

No premature unique identity index is added to the draft table. Duplicate canonical-name handling remains a future owner-apply validation against `public.foods`, which is the safer boundary.

## Trigger Review

Pass.

The draft adds only:

- function `public.update_food_missing_food_drafts_updated_at()`
- trigger `update_food_missing_food_drafts_updated_at`

Scope:

- runs only on `public.food_missing_food_drafts`;
- updates only `new.updated_at`;
- does not touch `foods`;
- does not touch `food_aliases`.

No trigger exists from draft status to food creation.

## Food Core Write Path Review

Pass.

The SQL draft contains no statements that write to:

- `public.foods`
- `public.food_aliases`

It contains no Alias Apply RPC call.

The only references to `public.foods` are:

- FK for optional future `applied_food_id`;
- comments/post-apply validation guidance.

That reference does not create or mutate food rows.

## Future UI Compatibility

The draft supports the expected UI sequence:

- create/save incomplete draft;
- move to `needs_revision`;
- complete name/category/source/unit/nutrition/provenance;
- mark `ready_for_owner_apply`;
- keep food creation as a later owner-approved step.

UI/service responsibilities later:

- only offer draft preparation for appropriate `food_missing_review_queue` rows;
- fill `prepared_by/prepared_at` on first meaningful draft preparation;
- fill `reviewed_by/reviewed_at` when marking `ready_for_owner_apply`;
- keep `brand` and `barcode` hidden or disabled for MVP;
- keep `source` fixed to `core`;
- keep `unit` fixed to `g`;
- never show a direct "Create food" action in the draft MVP.

## Non-Blocking Notes

The DB draft does not enforce that `source_review_id` points to a queue row whose status is `approved_for_food_draft`.

Assessment:

- This is acceptable for the draft table because SQL check constraints cannot reference another table.
- Adding an enforcement trigger would increase blast radius and is not necessary for this draft-only MVP.
- The future runtime service and owner-apply package must enforce:
  - source review exists;
  - source review status is `approved_for_food_draft`;
  - source review classification is `missing_canonical_food`.

The draft also keeps `data_source` as free text.

Assessment:

- This matches the MVP decision.
- A stricter enum can be added later once provenance categories are product-approved.

## Pre/Post Validation Plan

The report includes sufficient exact SQL for:

- table absence pre-check;
- required dependency checks;
- no pre-existing draft objects;
- no Food Core write functions;
- pre-count capture;
- table existence post-check;
- row count `0`;
- column count `31`;
- RLS check;
- admin-only policy check;
- index check;
- trigger scope check;
- no Food Core write trigger/function check;
- post-count comparison.

Add one optional pre-check during owner package preparation:

```sql
select
  'gen_random_uuid_available' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'gen_random_uuid'
      and pg_get_function_arguments(p.oid) = ''
      and n.nspname in ('public', 'pg_catalog', 'extensions')
  ) as actual,
  true as expected;
```

This is optional because existing production tables already use `gen_random_uuid()`, but it is useful for owner apply packaging.

## Stop Conditions

Stop before apply if:

- `food_missing_food_drafts` already exists and this is not a known retry;
- `food_missing_review_queue` is missing;
- `user_profiles.id_user` is missing;
- `user_profiles.is_admin` is missing;
- `normalize_food_text(value text)` is missing;
- `foods(id)` is unavailable;
- owner cannot capture pre-counts;
- any bundled SQL writes to `foods` or `food_aliases`;
- any bundled SQL includes import/backfill/recompute.

Stop after apply if:

- `food_missing_food_drafts` count is not `0`;
- `foods` count changed;
- `food_aliases` count changed;
- diary/favorites/recipes counts changed;
- RLS/admin policy is missing;
- unexpected triggers/functions write Food Core data.

## Final Recommendation

The fixed DB draft is ready for owner apply packaging.

Do not apply it directly from this review. Next step should be an owner apply package with exact pre-check SQL, exact migration reference, exact post-check SQL, expected unchanged counts, and stop conditions.
