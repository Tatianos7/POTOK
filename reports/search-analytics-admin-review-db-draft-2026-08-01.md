# Search Analytics / Admin Review DB Draft

- Timestamp: 2026-08-01T00:00:00Z
- Basis: `reports/data-layer-manual-review-readiness-audit-2026-08-01.md`
- Draft SQL: `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- Scope: DB draft and product contract for food search analytics + admin manual review queue
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_DRAFT_FIXED_READY**

## Safety

- Draft only.
- Migration was not applied.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No import/backfill/recompute was run.
- No Food Core import was run.
- No aliases were added.
- No foods were created.
- Recipes, nutrition, workouts, progress, and auth were not changed.
- No PR was created.

## Draft Summary

The draft creates two new tables only:

- `public.food_search_events`
- `public.food_search_review_queue`

It does not mutate existing Food Core tables:

- no writes to `public.foods`;
- no writes to `public.food_aliases`;
- no diary/favorites/recipes/remap/recompute behavior.

## Search Events Contract

`food_search_events` records analytics events for food search/resolver behavior.

Captured fields:

- `query`
- `normalized_query`
- `context`
- `event_type`
- `result_count`
- `selected_canonical_food_id`
- `no_selection`
- `not_found`
- `ambiguous`
- `candidate_canonical_food_ids`
- `metadata`
- `user_id` or `session_id_hash`
- `created_at`

Allowed contexts:

- `diary`
- `recipe`
- `favorites`
- `barcode`
- `admin`
- `other`

Allowed event types:

- `query`
- `selection`
- `no_selection`
- `not_found`
- `ambiguous`

Consistency rules:

- Event states are mutually exclusive.
- `query` requires no flags and `selected_canonical_food_id = null`.
- `selection` requires `selected_canonical_food_id` and all flags false.
- `no_selection` requires only `no_selection = true` and `selected_canonical_food_id = null`.
- `not_found` requires only `not_found = true`, `result_count = 0`, and `selected_canonical_food_id = null`.
- `ambiguous` requires only `ambiguous = true` and `selected_canonical_food_id = null`.

## Review Queue Contract

`food_search_review_queue` stores admin-review candidates for query-to-canonical suggestions.

Captured fields:

- `query`
- `normalized_query`
- `context`
- `suggested_canonical_food_id`
- `frequency`
- `status`
- `reviewer_id`
- `reviewed_at`
- `comment`
- `source_event_ids`
- `metadata`
- `created_at`
- `updated_at`

Allowed statuses:

- `pending`
- `approved`
- `rejected`
- `snoozed`

Review rules:

- `pending` rows must not have `reviewer_id` or `reviewed_at`.
- `approved`, `rejected`, and `snoozed` rows require `reviewer_id` and `reviewed_at`.
- `approved` requires `suggested_canonical_food_id`.
- A partial unique index prevents duplicate pending rows for the same normalized query/context/suggested canonical target.

## RLS Contract

Search events:

- authenticated users may insert their own events;
- authenticated users may select their own events;
- admins may select/update/delete all events.

Review queue:

- admin-only for all operations.

Admin detection follows the existing app convention:

```sql
exists (
  select 1
  from public.user_profiles
  where id_user = auth.uid()
    and is_admin = true
)
```

Production schema note:

- Admin lookup uses `public.user_profiles.id_user = auth.uid()`.
- `food_search_events.user_id` remains the analytics event owner column.

## Manual-Review-Only Rules

The draft explicitly preserves these product rules:

- No automatic alias insertion.
- No automatic food creation.
- No silent canonical target for ambiguous queries.
- Admin approval is required before alias/catalog mutation.
- Approved review queue status records intent only; it does not insert into `food_aliases`.
- Open Food Facts/barcode candidates must remain candidates until reviewed.
- Core remains a clean generic catalog without brand pollution.
- Diary history remains immutable; no backfill or recompute is part of this draft.

## Runtime Integration Plan

Runtime-only phase after approved DB apply:

1. Add a non-blocking analytics service.
2. Log `query` events after search returns.
3. Log `selection` when the user chooses a food.
4. Log `no_selection` when useful and not noisy.
5. Log `not_found` when result count is zero.
6. Log `ambiguous` when resolver refuses silent canonical choice.
7. Treat logging failures as non-fatal.

No resolver behavior should change in the logging phase.

## Admin Review Plan

Admin MVP after event logging exists:

1. Aggregate frequent `not_found` and `ambiguous` queries.
2. Create or upsert `pending` queue rows.
3. Show candidate canonical foods and current aliases.
4. Let admin approve, reject, snooze, or comment.
5. Keep approved rows as reviewed decisions.
6. Use a separate explicitly approved alias-apply step to insert `food_aliases`.

## Post-Apply Validation If Approved Later

Before applying:

- capture `foods` count;
- capture `food_aliases` count;
- confirm `user_profiles.id_user` exists and is UUID;
- confirm `user_profiles.is_admin` exists;
- confirm `foods.id` is UUID;
- confirm no pending production data mutation is bundled with the apply.

After applying:

- confirm both new tables exist;
- confirm RLS policies exist;
- confirm `foods` count is unchanged;
- confirm `food_aliases` count is unchanged;
- confirm no diary/favorites/recipes row counts changed;
- insert no test aliases as part of validation.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Analytics volume grows too quickly | Medium | Add retention policy before high-volume rollout |
| Query text may contain personal data | Medium | Define privacy/retention rules before runtime logging |
| Admin approval confused with alias apply | Medium/High | Keep approval and alias insertion as separate steps |
| Ambiguous query silently resolved in runtime | High | Resolver must emit ambiguous status and block canonical write |
| OFF/barcode candidates pollute Core | High | Keep brand/OFF candidate layer separate from Core |

## Deferred

- Retention/cleanup job for old search events.
- Materialized aggregate table for review queue frequency if event volume becomes large.
- Dedicated candidate table for Open Food Facts / barcode results.
- Central runtime resolver object.
- Admin UI implementation.
- Approved alias apply workflow.

## Final Recommendation

The DB draft is ready for manual review. Do not apply it until the owner explicitly approves a migration step with pre/post count validation. The next implementation step should be runtime logging only after the DB contract is approved and applied.
