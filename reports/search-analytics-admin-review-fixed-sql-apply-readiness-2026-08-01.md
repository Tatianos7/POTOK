# Search Analytics / Admin Review Fixed SQL Apply Readiness

- Timestamp: 2026-08-01T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- Prior review: `reports/search-analytics-admin-review-sql-draft-review-2026-08-01.md`
- Fix report: `reports/search-analytics-admin-review-db-draft-fix-2026-08-01.md`
- Production schema retry fix: `reports/search-analytics-admin-review-failed-apply-fix-2026-08-01.md`
- Review verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_RETRY_APPLY_READY**

## Safety

- Review only.
- Draft migration was not applied.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No import/backfill/recompute was run.
- No Food Core import was run.
- No aliases were added.
- No foods were created.
- Recipes, nutrition, workouts, progress, and auth were not changed.
- No PR was created.

## Fixed Blocker Review

The prior P1 blocker is fixed.

`food_search_events_selection_consistency_check` now enforces mutually exclusive event states:

- `query`: `selected_canonical_food_id is null`, `no_selection = false`, `not_found = false`, `ambiguous = false`.
- `selection`: `selected_canonical_food_id is not null`, all flags false.
- `no_selection`: selected canonical is null, only `no_selection = true`.
- `not_found`: selected canonical is null, only `not_found = true`, and `result_count = 0`.
- `ambiguous`: selected canonical is null, only `ambiguous = true`.

Mixed states such as `query + not_found`, `query + selected`, `no_selection + ambiguous`, and `ambiguous + not_found` are now blocked by the check.

## RLS/Admin Review

Admin access uses the existing app convention:

```sql
exists (
  select 1
  from public.user_profiles
  where id_user = auth.uid()
    and is_admin = true
)
```

Assessment:

- Compatible with the production `public.user_profiles.id_user` identity column.
- `food_search_events` allows authenticated users to insert their own events.
- `food_search_events` allows users to select only rows where `user_id = auth.uid()`.
- Admins can manage all `food_search_events`.
- `food_search_review_queue` is admin-only for all operations.

Pre-apply must still confirm `public.user_profiles.id_user` is UUID and `public.user_profiles.is_admin` exists.

## No Food Core Mutation Review

The draft remains non-mutating for existing Food Core/downstream data.

No SQL writes were found for:

- `public.foods`;
- `public.food_aliases`;
- `public.food_diary_entries`;
- `public.favorite_products`;
- `public.recipes`;
- `public.recipe_ingredients`.

The only references to `public.foods` are foreign keys and validation comments.

The only references to `public.food_aliases` are safety/validation comments.

There are no triggers/functions that create aliases or foods from the review queue.

## Pending Unique Index

The pending queue unique index is appropriate for MVP:

```sql
unique (
  normalized_query,
  coalesce(context, ''),
  coalesce(suggested_canonical_food_id, zero_uuid)
)
where status = 'pending'
```

Assessment:

- Prevents duplicate pending rows for the same query/context/target.
- Allows reviewed history after status changes.
- Allows targetless and target-specific pending candidates to be tracked separately.
- No blocker found.

## Indexes And Volume

Indexes are reasonable for the first DB apply:

- recent event scans by `created_at`;
- per-user event scans by `(user_id, created_at)`;
- query aggregation by `normalized_query`;
- context/type event scans;
- partial indexes for `not_found` and `ambiguous`;
- selected canonical lookups;
- review queue by status, normalized query, frequency, and suggested canonical target.

Known volume risk:

- Search events can grow quickly after runtime logging is enabled.
- Retention/cleanup should be designed before high-volume rollout.

This is not a DB apply blocker because the draft only creates empty tables and does not enable runtime logging.

## Privacy Review

The draft stores raw `query` text, which can contain accidental personal data.

Assessment:

- Safe for empty-table DB apply.
- Before runtime logging is enabled, define:
  - query length limits in runtime and/or DB;
  - redaction rules;
  - retention period;
  - metadata allowlist.

Privacy/retention is a blocker before production logging at scale, not before creating the empty draft tables.

## Session/User Ownership

The insert policy allows authenticated users to insert events with `user_id is null`.

Assessment:

- Acceptable if used for privacy-preserving events with `session_id_hash`.
- Such rows are not visible through the user select policy and remain admin-reviewable only.
- Runtime implementation should prefer either `user_id = auth.uid()` or a stable `session_id_hash`; it should not create orphan events accidentally.

This is a runtime integration requirement, not a DB apply blocker.

## Pre-Apply Gate

Before applying the migration, capture:

- explicit owner approval;
- confirm no partial objects remain from the failed apply attempt;
- confirm `public.food_search_events` does not already exist;
- confirm `public.food_search_review_queue` does not already exist;
- confirm `public.user_profiles.id_user` is UUID;
- confirm `public.user_profiles.is_admin` exists;
- confirm `public.foods.id` is UUID;
- counts for:
  - `foods`;
  - `food_aliases`;
  - `food_diary_entries`;
  - `favorite_products`;
  - `recipes`;
  - `recipe_ingredients`.

## Post-Apply Validation

After apply, validate:

- both new tables exist;
- RLS is enabled on both new tables;
- expected policies exist;
- expected indexes exist;
- `foods` count unchanged;
- `food_aliases` count unchanged;
- `food_diary_entries` count unchanged;
- `favorite_products` count unchanged;
- `recipes` count unchanged;
- `recipe_ingredients` count unchanged;
- no aliases inserted;
- no foods created;
- no import/backfill/recompute run.

## Deferred Before Runtime Logging

- Privacy/retention policy.
- Runtime event metadata allowlist.
- Runtime guard against noisy `no_selection` events.
- Central resolver result object.
- Admin UI.
- Approved alias apply workflow.
- Open Food Facts/barcode candidate persistence.

## Final Recommendation

The fixed Search Analytics/Admin Review SQL draft is apply-ready for an approved production migration step. Apply only this reviewed draft after explicit owner approval, then run the pre/post validation above. Do not enable runtime logging, create aliases, create foods, import, backfill, or recompute in the same step.
