# Search Analytics / Admin Review SQL Draft Review

- Timestamp: 2026-08-01T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- Reviewed contract: `reports/search-analytics-admin-review-db-draft-2026-08-01.md`
- Basis: `reports/data-layer-manual-review-readiness-audit-2026-08-01.md`
- Review verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_REQUIRES_FIXES**

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

## Overall Assessment

The draft is directionally correct and non-destructive:

- It creates only `food_search_events` and `food_search_review_queue`.
- It does not define triggers/functions that write to `public.foods`.
- It does not define triggers/functions that write to `public.food_aliases`.
- It does not backfill, remap, recompute, or mutate diary/favorites/recipes.
- Review queue approval is modeled as intent only, not as automatic alias creation.

However, the draft should be tightened before apply because the event consistency constraints currently allow mixed states that would reduce analytics quality.

## Findings

### P1: Event State Constraints Allow Mixed Signals

`food_search_events_selection_consistency_check` currently validates each event type with partial conditions.

Examples that would pass:

- `event_type = 'query'` with `selected_canonical_food_id` set.
- `event_type = 'query'` with `not_found = true` or `ambiguous = true`.
- `event_type = 'no_selection'` with `not_found = true`.
- `event_type = 'ambiguous'` with `no_selection = true` or `not_found = true`.

Why this matters:

- Analytics aggregation depends on clean event semantics.
- The admin review queue will likely rank `not_found` and `ambiguous` events by frequency.
- Mixed flags can make frequency counts and review suggestions unreliable.

Recommended fix before apply:

- Make event states mutually exclusive.
- Require neutral `query` events to have:
  - `selected_canonical_food_id is null`;
  - `no_selection = false`;
  - `not_found = false`;
  - `ambiguous = false`.
- Require `no_selection` events to have only `no_selection = true`.
- Require `not_found` events to have only `not_found = true`.
- Require `ambiguous` events to have only `ambiguous = true`.
- Keep `selection` requiring selected canonical id and all flags false.

### P2: Privacy/Retention Contract Is Not Yet Enforced

The draft stores raw `query` text. A user may accidentally type personal data into search.

Current status:

- The report identifies this risk.
- The SQL draft does not include retention, redaction, or query-length constraints beyond not-blank checks.

Recommended before runtime logging:

- Add a maximum length check for `query` and `normalized_query`.
- Define retention before high-volume rollout.
- Keep runtime metadata small and avoid storing full UI state.

This is not necessarily a DB apply blocker if no runtime logging is enabled yet, but it is a blocker before production analytics logging becomes active.

### P2: Anonymous/Session Events Need Clear Ownership Semantics

The insert policy allows authenticated users to insert rows with `user_id is null`.

This can be useful for privacy if paired with `session_id_hash`, but the draft does not require either `user_id` or `session_id_hash`.

Recommended fix or explicit decision:

- Either require `user_id is not null or session_id_hash is not null`;
- or document that admin-only orphan analytics rows are allowed.

If `user_id is null`, ordinary users cannot select those rows under `food_search_events_select_own`; only admins can review them. That is acceptable if intentional.

### P2: Idempotency Is Partial If Tables Already Exist

The draft uses `create table if not exists` with inline constraints.

If a partially-created table already exists, inline constraints/columns will not be repaired.

Recommended apply note:

- Before apply, confirm neither table exists.
- If either table exists, use a separate alignment draft with `alter table add column if not exists` and constraint existence checks.

For a first apply where both tables are absent, this is acceptable.

## RLS/Admin Review

Original review note, superseded after owner failed apply:

- The initial draft assumed `public.user_profiles.user_id = auth.uid()`.
- Owner apply showed production uses `public.user_profiles.id_user uuid`.
- The fixed draft now uses `public.user_profiles.id_user = auth.uid()` for admin lookup.

Fixed admin policy uses the production profile identity column:

```sql
exists (
  select 1
  from public.user_profiles
  where id_user = auth.uid()
    and is_admin = true
)
```

Assessment:

- This matches the production `public.user_profiles` schema found during owner apply.
- It should work for admins because `user_profiles_select_own` lets a user read their own profile row.
- Non-admin users cannot access the review queue.
- Non-admin users can insert their own search events.
- Non-admin users can select only their own search events with `user_id = auth.uid()`.

Apply validation should confirm `public.user_profiles.is_admin` exists before running the draft.

## Index And Volume Review

Current indexes are reasonable for MVP:

- recent events by `created_at`;
- per-user event history by `(user_id, created_at)`;
- query aggregation by `normalized_query`;
- context/event-type scans by `(context, event_type, created_at)`;
- partial indexes for `not_found` and `ambiguous`;
- review queue by status, normalized query, frequency, and suggested canonical target.

Remaining concern:

- Search logging can grow quickly.
- Add retention/cleanup before high-volume runtime rollout.
- A materialized aggregate can remain deferred until event volume proves it is needed.

## Pending Unique Index Review

The pending unique index:

```sql
(normalized_query, coalesce(context, ''), coalesce(suggested_canonical_food_id, zero_uuid))
where status = 'pending'
```

Assessment:

- Good for preventing duplicate pending queue rows.
- Allows separate reviewed history after rows leave `pending`.
- Allows multiple contexts for the same query when context is meaningful.
- Allows an unknown target and a suggested target to coexist as separate pending rows.

No blocker found.

## No Auto-Alias / No Auto-Food Review

The draft contains no operational SQL that writes to:

- `public.foods`;
- `public.food_aliases`;
- diary/favorites/recipes tables.

The only references to `public.foods` are foreign keys and validation comments.

The only references to `public.food_aliases` are safety comments and validation comments.

No trigger/function writes aliases or foods.

No blocker found.

## Pre/Post Validation Plan

Before apply:

- Confirm explicit owner approval for apply.
- Confirm both new tables do not already exist.
- Capture counts:
  - `foods`;
  - `food_aliases`;
  - `food_diary_entries`;
  - `favorite_products`;
  - `recipes`;
  - `recipe_ingredients`.
- Confirm `public.user_profiles.is_admin` exists.
- Confirm `public.foods.id` exists and is UUID.

After apply:

- Confirm both tables exist.
- Confirm RLS is enabled on both tables.
- Confirm expected policies exist.
- Confirm indexes exist.
- Confirm table row counts for existing Food Core/downstream tables are unchanged.
- Do not insert aliases.
- Do not create foods.
- Do not run import/backfill/recompute.

## Required Fixes Before Apply

1. Tighten `food_search_events_selection_consistency_check` so event states are mutually exclusive.
2. Add a privacy guard or explicit apply note for raw `query` retention:
   - recommended minimum: max length checks for `query` and `normalized_query`;
   - retention can be deferred only if runtime logging is not enabled yet.
3. Decide whether `user_id is null` events must require `session_id_hash`.
4. Add a pre-apply validation step confirming the draft tables do not already exist.

## Safe Deferred

- Runtime analytics service.
- Admin UI.
- Retention cleanup job before high-volume logging.
- Materialized aggregates.
- Approved alias apply workflow.
- Open Food Facts/barcode candidate persistence.

## Final Recommendation

Do not apply the current draft as-is. It is structurally safe, but event-state constraints should be tightened before apply so analytics and admin review are reliable from the first row.

After the fixes above, the draft can be re-reviewed for `SEARCH_ANALYTICS_ADMIN_REVIEW_APPLY_READY`.
