# Missing Food Review Queue DB Draft Review

- Timestamp: 2026-08-05T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260805_missing_food_review_queue_draft.sql`
- Reviewed report: `reports/missing-food-review-queue-db-draft-2026-08-05.md`
- Prior verdict: `MISSING_FOOD_REVIEW_QUEUE_DRAFT_READY`
- Review verdict: **MISSING_FOOD_REVIEW_QUEUE_APPLY_READY**

## Safety

- Review only.
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

The Missing Food Review Queue draft is apply-ready.

The draft creates a separate admin-only queue:

- `public.food_missing_review_queue`

It does not overload `food_search_review_queue`, and it does not create a path from not-found search events to automatic food or alias creation.

No blocker was found.

## Table Contract Review

The table contract matches the requested foundation:

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

Assessment:

- Fields are scoped to missing-food review state, not Food Core mutation.
- `source_event_ids` preserves analytics evidence without creating a hard dependency that would block cleanup/retention decisions later.
- `suggested_*` fields are draft hints only and are not written into `foods`.

## Constraints Review

Classification constraint:

- allows `alias_candidate`;
- allows `missing_canonical_food`;
- allows `ambiguous_broad_query`;
- allows `typo_or_prefix`.

Status constraint:

- allows `pending`;
- allows `needs_research`;
- allows `approved_for_food_draft`;
- allows `rejected`;
- allows `snoozed`.

Basic data constraints:

- `query` cannot be blank;
- `normalized_query` cannot be blank;
- `frequency > 0`;
- `suggested_name`, `suggested_category` cannot be blank when present;
- `suggested_source` is limited to review/provenance values.

Assessment:

- Constraints are appropriate for a first durable queue.
- They keep review state structured without implying production food creation.

## Pending / Reviewed State

`food_missing_review_queue_review_state_check` enforces:

- `pending` rows have no `reviewer_id` and no `reviewed_at`;
- reviewed rows require both `reviewer_id` and `reviewed_at`.

Reviewed statuses:

- `needs_research`
- `approved_for_food_draft`
- `rejected`
- `snoozed`

Assessment:

- The rule is consistent with the existing manual-review pattern.
- It prevents silent status changes without reviewer attribution.

## Food Draft Shape

`food_missing_review_queue_food_draft_shape_check` enforces:

- `approved_for_food_draft` only for `classification = 'missing_canonical_food'`;
- non-blank `suggested_name`;
- non-empty `source_event_ids`.

Assessment:

- This correctly blocks food-draft approval for broad ambiguous queries, typo/prefix/noise, and alias candidates.
- Approval records intent only; there is no SQL path that inserts into `foods`.

## Pending Unique Index

The partial unique index is:

```sql
create unique index if not exists food_missing_review_queue_pending_unique_idx
  on public.food_missing_review_queue (
    normalized_query,
    coalesce(context, ''),
    classification
  )
  where status = 'pending';
```

Assessment:

- Prevents duplicate pending work for the same normalized query/context/classification.
- Allows reviewed history after a row leaves `pending`.
- Allows the same query to be tracked separately if classification changes during review.
- No blocker found.

## Trigger Scope

The draft defines:

- `public.update_food_missing_review_queue_updated_at()`;
- trigger `update_food_missing_review_queue_updated_at`;
- trigger target: `public.food_missing_review_queue` only.

Assessment:

- The trigger only updates `new.updated_at`.
- It does not reference `foods`, `food_aliases`, `food_search_review_queue`, diary, favorites, or recipes.
- Scope is acceptable.

## RLS Review

RLS is enabled on:

- `public.food_missing_review_queue`

The only policy is:

- `food_missing_review_queue_admin_all`

Admin check:

```sql
exists (
  select 1
  from public.user_profiles
  where id_user = auth.uid()
    and is_admin = true
)
```

Assessment:

- Uses production-correct `user_profiles.id_user`.
- Covers `using` and `with check`.
- Grants access only to `authenticated` callers that satisfy the admin predicate.
- No non-admin select/insert/update/delete policy is defined.

Pre-apply must still confirm `public.user_profiles.id_user` and `public.user_profiles.is_admin` exist in production.

## No Food Core Mutation Review

No SQL writes were found for:

- `public.foods`;
- `public.food_aliases`;
- diary tables;
- favorites tables;
- recipes tables;
- recipe ingredients tables.

The draft contains no RPC that creates foods and no RPC that creates aliases.

The only function is the queue-local `updated_at` trigger function.

The anti-automation guard is explicit: future food creation must be separately drafted, reviewed, and owner-approved.

## Import / Backfill / Recompute

The draft contains no:

- import step;
- backfill step;
- recompute step;
- diary snapshot mutation;
- favorite remap;
- recipe remap.

Assessment: pass.

## Production Schema Compatibility

Expected production dependencies:

- `public.user_profiles.id_user`
- `public.user_profiles.is_admin`
- `auth.users(id)`
- `gen_random_uuid()`
- existing Search Analytics table `public.food_search_events`

Assessment:

- `user_profiles.id_user` is the correct production admin identity path based on recent applied Search Analytics/Admin Review and admin access fixes.
- `auth.users(id)` and `gen_random_uuid()` are already used by applied/drafted project migrations.
- The draft does not depend on `foods` or `food_aliases` schema.

Pre-apply should still validate these in production, because tracked older schema files still contain stale `user_profiles.user_id` examples.

## Pre-Apply Plan Review

The draft/report pre-apply plan is adequate.

Before applying, confirm:

- explicit owner approval;
- `public.food_missing_review_queue` does not already exist, unless retrying a known partial apply;
- `public.user_profiles.id_user` exists;
- `public.user_profiles.is_admin` exists;
- `public.food_search_events` exists;
- no food creation SQL is bundled;
- no alias creation SQL is bundled;
- no import/backfill/recompute is bundled.

Capture counts before apply:

- `foods`;
- `food_aliases`;
- `food_search_events`;
- `food_search_review_queue`;
- `food_alias_apply_audit`;
- `food_diary_entries`;
- `favorite_products`;
- `recipes`;
- `recipe_ingredients`.

## Post-Apply Plan Review

After an approved apply, validate:

- `food_missing_review_queue` exists;
- expected columns exist;
- RLS is enabled;
- policy `food_missing_review_queue_admin_all` exists;
- expected indexes exist;
- updated-at trigger exists only on `food_missing_review_queue`;
- no trigger/function inserts into `foods`;
- no trigger/function inserts into `food_aliases`;
- `food_missing_review_queue` count is `0`;
- existing Food Core/downstream counts are unchanged;
- no foods were created;
- no aliases were added.

Expected unchanged counts:

- `foods`;
- `food_aliases`;
- `food_search_events`;
- `food_search_review_queue`;
- `food_alias_apply_audit`;
- `food_diary_entries`;
- `favorite_products`;
- `recipes`;
- `recipe_ingredients`.

Expected new-table count:

- `food_missing_review_queue = 0`.

## Non-Blocking Notes

- `source_event_ids` is an array without a foreign key. This is acceptable for MVP evidence tracking and avoids retention coupling with `food_search_events`; future durable provenance can use a join table if needed.
- `suggested_source` is a review/provenance hint, not a `foods.source` write contract. Food creation source semantics must be reviewed separately.
- The updated-at function is not security definer and does not need elevated privileges.

## Final Recommendation

The Missing Food Review Queue DB draft is apply-ready for an owner-approved migration step. Apply only this reviewed draft, then run the pre/post validation above. Do not create foods, create aliases, call Alias Apply, import, backfill, or recompute in the same step.
