# Search Analytics Admin Review MVP

- Timestamp: 2026-08-01T00:00:00Z
- Basis: `reports/search-analytics-admin-review-db-applied-final-status-2026-08-01.md`
- Runtime smoke: `reports/search-analytics-runtime-logging-production-smoke-2026-08-01.md`
- Scope: admin-only MVP for Search Analytics review queue
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_MVP_READY**

## Safety

- Runtime UI/service code was changed for admin review only.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- Food Core was not changed.
- No rows were inserted into `foods`.
- No rows were inserted into `food_aliases`.
- Search resolver/ranking behavior was not changed.
- Diary/favorites/recipes writes were not changed.
- No import/backfill/recompute was run.
- No PR was created.

## Implementation

Added admin review service:

- `src/services/searchAdminReviewService.ts`

Added admin-only page:

- `src/pages/SearchAnalyticsAdminReview.tsx`

Added route:

- `/admin/search-review`

Added entry from existing admin panel:

- `src/pages/AdminPanel.tsx`

## MVP Behavior

The page is admin-only:

- protected by existing authenticated route;
- redirects non-admin users away through `user.isAdmin` guard.

The service reads:

- `food_search_events`;
- `food_search_review_queue`;
- `foods`;
- `food_aliases`.

The service writes only:

- `food_search_review_queue`.

It does not write to:

- `foods`;
- `food_aliases`;
- diary/favorites/recipes tables.

## Review Surface

The page shows frequent Search Analytics issues from `food_search_events`:

- `not_found`
- `ambiguous`

Displayed fields:

- query;
- normalized query;
- event type;
- frequency;
- context;
- last_seen;
- candidate foods;
- existing pending queue rows.

Candidates are read-only suggestions from:

- event `candidate_canonical_food_ids`;
- exact `food_aliases.normalized_alias`;
- `foods` name/normalized-name lookup.

## Queue Actions

Admin can:

- create/update pending queue row with a suggested canonical candidate;
- create/update pending queue row without a candidate;
- approve pending row;
- reject pending row;
- snooze pending row;
- add/update review comment.

Important contract:

- approved/rejected/snoozed status is stored only in `food_search_review_queue`;
- approval does not insert into `food_aliases`;
- approval does not mutate `foods`;
- alias apply remains a separate future workflow.

## Tests

Added targeted tests:

- `src/services/__tests__/searchAdminReviewService.test.ts`

Covered:

- grouping by context/event type/normalized query;
- frequency and last_seen aggregation;
- candidate id aggregation;
- pending queue insert path writes only to review queue;
- pending queue update path;
- queue status update path.

## Verification

- `npx tsx --test src/services/__tests__/searchAdminReviewService.test.ts src/services/__tests__/searchAnalyticsService.test.ts`: **PASS**, `11/11`.
- `npm run build`: **PASS**.

Build notes:

- Vite reported existing dynamic-import/chunk-size warnings.
- Browser data warnings were shown.
- No build failure.

## Deferred

- Dedicated admin aggregation tables/materialized views.
- Bulk review actions.
- Approved alias apply workflow.
- Retention cleanup job.
- Open Food Facts/barcode candidate review layer.
- UI polish after real admin usage.

## Final Status

Search Analytics Admin Review MVP is ready. Admins can inspect frequent not-found/ambiguous search queries, create pending review rows, and record review decisions without mutating Food Core, aliases, resolver behavior, ranking, or diary writes.
