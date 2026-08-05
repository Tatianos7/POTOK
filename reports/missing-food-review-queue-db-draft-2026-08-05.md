# Missing Food Review Queue DB Draft

- Timestamp: 2026-08-05T00:00:00Z
- Basis: `reports/missing-food-review-foundation-design-2026-08-04.md`
- Production smoke basis: `reports/admin-search-review-classification-ui-production-smoke-2026-08-04.md`
- Draft SQL: `supabase/migration_drafts/20260805_missing_food_review_queue_draft.sql`
- Scope: DB draft for a dedicated Missing Food Review queue separate from Admin-approved Alias Apply
- Verdict: **MISSING_FOOD_REVIEW_QUEUE_DRAFT_READY**

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

## Draft Summary

The draft creates one new table only:

- `public.food_missing_review_queue`

It does not mutate existing Food Core or Search Review tables:

- no writes to `public.foods`;
- no writes to `public.food_aliases`;
- no writes to `public.food_search_review_queue`;
- no diary/favorites/recipes remap;
- no nutrition snapshot recompute.

The draft intentionally defines no RPC and no trigger that creates foods or aliases.

## Table Contract

`food_missing_review_queue` stores durable admin review state for not-found food queries where Alias Apply is not safe because the canonical food is missing, the query is broad/ambiguous, or the query is typo/prefix/noise.

Captured fields:

- `query`
- `normalized_query`
- `context`
- `frequency`
- `classification`
- `status`
- `source_event_ids`
- `suggested_name`
- `suggested_category`
- `suggested_source`
- `reviewer_id`
- `reviewed_at`
- `comment`
- `metadata`
- `created_at`
- `updated_at`

Allowed contexts:

- `diary`
- `recipe`
- `favorites`
- `barcode`
- `admin`
- `other`

Allowed classifications:

- `alias_candidate`
- `missing_canonical_food`
- `ambiguous_broad_query`
- `typo_or_prefix`

Allowed statuses:

- `pending`
- `needs_research`
- `approved_for_food_draft`
- `rejected`
- `snoozed`

## Review Rules

The draft enforces:

- `query` and `normalized_query` cannot be blank.
- `frequency > 0`.
- `pending` rows must not have `reviewer_id` or `reviewed_at`.
- `needs_research`, `approved_for_food_draft`, `rejected`, and `snoozed` rows require `reviewer_id` and `reviewed_at`.
- `approved_for_food_draft` is allowed only for `classification = 'missing_canonical_food'`.
- `approved_for_food_draft` requires a non-blank `suggested_name`.
- `approved_for_food_draft` requires non-empty `source_event_ids`.

This blocks direct food-draft approval for:

- `alias_candidate`;
- `ambiguous_broad_query`;
- `typo_or_prefix`.

## Separation From Alias Apply

The existing Alias Apply workflow remains separate:

- `food_search_review_queue` handles `query -> suggested_canonical_food_id -> food_aliases`.
- `food_missing_review_queue` handles `query -> missing-food/disambiguation/noise decision`.

The new queue does not write aliases. A missing-food approval records intent only. It does not insert into `foods`, and it does not create an alias after a future food exists.

Example:

- `стейк` can be reviewed as `missing_canonical_food`.
- It must not become an alias until a canonical food exists.
- Creating that canonical food requires a separate owner-approved Food Core workflow.
- Any later alias mapping requires a separate Admin-approved Alias Apply action.

## RLS Contract

The queue is admin-only for all operations.

Admin detection uses the production-correct profile identity:

```sql
exists (
  select 1
  from public.user_profiles
  where id_user = auth.uid()
    and is_admin = true
)
```

No non-admin select/insert/update/delete policy is defined.

## Indexes

The draft adds indexes for first-MVP review usage:

- `status, created_at desc`
- `normalized_query`
- `classification, status, updated_at desc`
- `frequency desc`
- nullable `context`
- GIN over `source_event_ids`

A partial unique index prevents duplicate pending rows for the same:

- `normalized_query`
- `context`
- `classification`

Reviewed history remains possible after status changes.

## No Auto Food Rules

The draft preserves:

- no automatic food creation from not-found queries;
- no automatic alias creation from missing-food rows;
- no trigger from `approved_for_food_draft`;
- no writes to `foods`;
- no writes to `food_aliases`;
- no diary/favorites/recipes remap;
- no historical nutrition snapshot recompute.

Future food creation must be separately drafted, reviewed, owner-approved, and validated with pre/post counts.

## Pre-Apply Gate

Before any future apply, validate:

- explicit owner approval;
- `public.food_missing_review_queue` does not already exist, unless retrying a known partial apply;
- `public.user_profiles.id_user` exists;
- `public.user_profiles.is_admin` exists;
- `public.food_search_events` exists;
- no bundled food creation SQL exists;
- no bundled alias creation SQL exists;
- no import/backfill/recompute is bundled.

Capture pre-apply counts:

- `foods`;
- `food_aliases`;
- `food_search_events`;
- `food_search_review_queue`;
- `food_alias_apply_audit`;
- `food_diary_entries`;
- `favorite_products`;
- `recipes`;
- `recipe_ingredients`.

Expected unchanged counts after applying this draft:

- `foods`;
- `food_aliases`;
- `food_search_events`;
- `food_search_review_queue`;
- `food_alias_apply_audit`;
- `food_diary_entries`;
- `favorite_products`;
- `recipes`;
- `recipe_ingredients`.

Expected new table count:

- `food_missing_review_queue = 0`.

## Post-Apply Validation

After any approved apply, validate:

- `food_missing_review_queue` exists.
- Expected columns exist.
- RLS is enabled.
- `food_missing_review_queue_admin_all` policy exists.
- Expected indexes exist.
- `update_food_missing_review_queue_updated_at` trigger exists only on `food_missing_review_queue`.
- No trigger/function exists that inserts into `foods` from `food_missing_review_queue`.
- No trigger/function exists that inserts into `food_aliases` from `food_missing_review_queue`.
- `food_missing_review_queue` count is `0`.
- Existing Food Core/downstream counts are unchanged.
- No foods were created.
- No aliases were added.

## Deferred

- Apply-readiness review of this draft.
- Owner apply package.
- Runtime service/UI that writes durable missing-food queue rows.
- Missing-food draft preparation workflow.
- Owner-approved food creation migration/RPC/package.
- Post-food-creation Alias Apply follow-up.
- Persistent classification audit history.
- Ambiguous/manual override workflow.
- Noise suppression before durable queue insertion.

## Final Recommendation

The Missing Food Review queue DB draft is ready for review. Do not apply it until a separate apply-readiness review confirms the production schema, RLS policy shape, indexes, and pre/post validation plan. This draft should remain separate from Alias Apply and must not create foods or aliases.
