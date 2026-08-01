# Search Analytics Admin Review Production Smoke

- Timestamp: 2026-08-01T00:00:00Z
- Basis:
  - `reports/search-analytics-admin-review-mvp-2026-08-01.md`
  - `reports/search-analytics-runtime-logging-zero-events-investigation-2026-08-01.md`
- Route: `/admin/search-review`
- Scope: production smoke for Search Analytics runtime events and Admin Review Queue MVP with limited queue writes
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_PRODUCTION_SMOKE_READY**

## Safety

- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No aliases were created.
- No foods were created.
- Diary/favorites/recipes were not changed.
- Resolver/ranking/runtime code was not changed.
- No import/backfill/recompute was run.
- No PR was created.

## Allowed Smoke Writes

Limited production writes were performed only in:

- `public.food_search_review_queue`

Smoke rows used explicit test normalized queries:

- `__smoke_admin_review_repeat_*`

All smoke rows were deleted after the checks.

## Baseline Counts

Pre-smoke production counts:

| Table | Count |
| --- | ---: |
| `foods` | 2265 |
| `food_aliases` | 2890 |
| `food_search_events` | 5 |
| `food_search_review_queue` | 0 |

## Runtime Events Smoke

`food_search_events` is no longer empty after the deploy fix.

Latest event types found:

- `query`: **PASS**
- `not_found`: **PASS**
- `selection`: **PASS**
- `ambiguous`: deferred

Latest sample included:

- `selection`, context `diary`, `created_at = 2026-08-01T19:11:18Z`
- `not_found`, query `ывапролдж`, context `diary`, `result_count = 0`
- `query`, query `ывапролдж`, context `diary`, `result_count = 0`
- `query`, query `сол`, context `diary`, `result_count = 3`
- `query`, query `соль`, context `diary`, `result_count = 3`
- `query`, query `со`, context `diary`, `result_count = 8`

Assessment:

- Runtime logging is deployed and writes `query`, `not_found`, and `selection` events.
- The previously missing `selection` event was confirmed after the selection logging deploy fix.
- No manual/fake `selection` row was inserted into `food_search_events`.

## Selection Logging Fix

Missing `selection` events were investigated in the runtime path:

- `ProductSearch` calls `searchAnalyticsService.logSelection(...)` when a search result card is selected.
- `searchAnalyticsService.logSelection(...)` builds a valid `selection` payload:
  - `event_type = 'selection'`;
  - `selected_canonical_food_id` is set;
  - `no_selection = false`;
  - `not_found = false`;
  - `ambiguous = false`.
- Production `query` / `not_found` events prove the deployed Supabase insert path and RLS are working for authenticated food search logging.

Finding:

- `ProductSearch` was starting `logSelection(...)` as fire-and-forget and immediately calling `onSelect(food)`.
- Some parent flows close a modal or navigate/open the add-food sheet immediately after `onSelect`.
- That can lose the selection insert before the browser finishes the async request.

Runtime-only fix:

- `ProductSearch.handleSelect` now awaits `searchAnalyticsService.logSelection(...)` before calling `onSelect(food)`.
- Logging failures remain non-fatal because the service catches insert errors internally.
- Search results, resolver/ranking, and diary writes were not changed.
- The search effect dependency list now includes `searchContext`, so context changes cannot reuse a stale logging context.

Targeted test added:

- `src/components/__tests__/ProductSearchAnalytics.test.ts`
- It verifies that `ProductSearch` waits for selection analytics and passes `searchContext` through search and selection paths.

Manual production confirmation after deploy:

- `food_search_events` contains `event_type = 'selection'`.
- Confirmed selection context: `diary`.
- Confirmed selection timestamp: `2026-08-01T19:11:18Z`.

## Frequent Items

Frequent source items were available from production `not_found` events:

| Query | Context | Event | Frequency | Last seen |
| --- | --- | --- | ---: | --- |
| `ывапролдж` | `diary` | `not_found` | 1 | `2026-08-01T17:53:54.870697+00:00` |

Assessment:

- Frequent `not_found` aggregation has source data: **PASS**.
- Frequent `ambiguous` aggregation is deferred because no current `ambiguous` events exist.

## Candidate Smoke

Candidate lookup was readable from production foods data:

- Candidate query used by smoke: `ывапролдж`
- Candidate count returned by fallback lookup: `5`
- Candidates visible/readable: **PASS**

Note:

- Candidate lookup does not write to `foods` or `food_aliases`.
- Not-found queries may naturally have weak/no direct candidates; Admin Review can still create targetless pending rows or let admin choose a reviewed candidate.

## Queue Write Smoke

Pending row checks:

- Inserted pending smoke rows in `food_search_review_queue`: `4`, **PASS**.
- Updated a pending smoke row frequency/comment: `1`, **PASS**.

Status checks with a valid auth-backed admin reviewer:

- `approved`: `1`, **PASS**.
- `rejected`: `1`, **PASS**.
- `snoozed`: `1`, **PASS**.
- comment update with status action: **PASS**.

Important contract detail:

- `approved` requires `suggested_canonical_food_id`.
- An attempted approve without `suggested_canonical_food_id` was correctly blocked by `food_search_review_queue_approval_target_check`.

Confirmed behavior:

- status actions write only to `food_search_review_queue`;
- no writes to `foods`;
- no writes to `food_aliases`;
- approval records review intent only and does not insert aliases.

## Admin Reviewer Finding

The smoke had to use an auth-backed admin reviewer:

- Valid reviewer used: `286bd239...`
- `user_profiles.is_admin = true` row found for this reviewer: **PASS**.

Existing risk remains:

- At least one `is_admin = true` profile row is orphaned from `auth.users`.
- Using an orphaned `id_user` as `reviewer_id` fails the `food_search_review_queue_reviewer_id_fkey`.

This is not a Food Core mutation risk, but admin profile cleanup should be handled separately if needed.

## Cleanup

Smoke cleanup result:

- Deleted smoke rows: `4`.
- `food_search_review_queue` returned to `0`.

Post-smoke production counts:

| Table | Count |
| --- | ---: |
| `foods` | 2265 |
| `food_aliases` | 2890 |
| `food_search_events` | 5 |
| `food_search_review_queue` | 0 |

Unchanged counts:

- `foods = 2265`: **PASS**.
- `food_aliases = 2890`: **PASS**.
- `food_search_review_queue = 0` after cleanup: **PASS**.

No alias insert:

- **PASS**.

## Access Smoke

Code path status:

- `/admin/search-review` route exists in the deployed production bundle.
- Page redirects authenticated non-admin users via `user.isAdmin` guard.
- Existing `/admin` entry button links to `/admin/search-review`.

Not fully browser-verified in this smoke:

- non-admin redirect in a real browser session.

Reason:

- This smoke used production REST checks and limited queue writes.
- No reusable non-admin browser session was available in this run.

## Out Of Scope Finding

GitHub Pages direct nested SPA routes can still return 404, for example direct `/POTOK/nutrition` or other nested routes.

This is recorded only as a separate routing finding and was not fixed in this task.

## Verdict Reason

Admin Review Queue write/status/cleanup behavior is production-smoke ready, and runtime logging now writes `query`, `not_found`, and `selection` production events.

The remaining items are deferred, not blockers:

- no current `ambiguous` event was available to verify ambiguous aggregation;
- real non-admin browser access was not session-verified.

## Deferred Checks

Safe deferred:

- generate or capture a real `ambiguous` event if ambiguous UI/admin review is required for this smoke;
- verify a non-admin user is blocked/redirected;
- optionally audit/clean orphaned admin profile rows in a separate approved step;
- keep `foods = 2265` and `food_aliases = 2890` unchanged.

## Verification

Targeted tests:

- `npx tsx --test src/services/__tests__/searchAnalyticsService.test.ts src/components/__tests__/ProductSearchAnalytics.test.ts`: **PASS**, `9/9`.

Build:

- `npm run build`: **PASS**.

Build notes:

- Existing browser data warnings were shown.
- Existing Vite dynamic-import/chunk-size warnings were shown.
- No build failure.

## Final Status

Search Analytics Runtime + Admin Review production smoke is ready.

The deploy fix resolved the zero-events blocker, and the selection logging fix was confirmed in production. `food_search_events` now contains `query`, `not_found`, and `selection` events. Admin Review queue writes, status changes, comments, and cleanup work without mutating Food Core.

`foods = 2265` and `food_aliases = 2890` remained unchanged. No aliases or foods were created.
