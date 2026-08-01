# Search Analytics Admin Review Production Smoke

- Timestamp: 2026-08-01T00:00:00Z
- Basis: `reports/search-analytics-admin-review-mvp-2026-08-01.md`
- Route: `/admin/search-review`
- Scope: production smoke for Admin Review Queue MVP with limited queue writes
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_REQUIRES_FIXES**

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

- `__smoke_admin_review_valid_*`

All smoke rows were deleted after the checks.

## Baseline Counts

Pre-smoke production counts:

| Table | Count |
| --- | ---: |
| `foods` | 2265 |
| `food_aliases` | 2890 |
| `food_search_events` | 0 |
| `food_search_review_queue` | 0 |

## Read Smoke

Read checks:

- `foods` is readable: **PASS**.
- `food_aliases` count is unchanged/readable: **PASS**.
- `food_search_review_queue` starts empty: **PASS**.
- `food_search_events` exists but currently has `0` rows: **BLOCKER**.

Impact:

- Frequent `not_found` / `ambiguous` queries cannot be displayed in production right now because there are no source analytics events to aggregate.
- Candidate lookup can read `foods`, but the Admin Review surface has no review items while `food_search_events = 0`.

## Queue Write Smoke

Pending row checks:

- Created pending smoke rows in `food_search_review_queue`: **PASS**.
- Updated a pending smoke row frequency/comment: **PASS**.

Status checks with a valid auth-backed admin reviewer:

- `approved`: **PASS**.
- `rejected`: **PASS**.
- `snoozed`: **PASS**.
- comment update with status action: **PASS**.

Confirmed behavior:

- status actions write only to `food_search_review_queue`;
- no writes to `foods`;
- no writes to `food_aliases`.

## Admin Reviewer Finding

Production has multiple `is_admin = true` profile rows.

Finding:

- Three admin profile `id_user` values returned `404` from Auth Admin API and failed `reviewer_id -> auth.users` FK when used for review status.
- One admin profile `id_user` exists in `auth.users` and worked for approve/reject/snooze smoke.

Impact:

- Queue status actions require a reviewer id that exists in `auth.users`.
- If an admin session belongs to an orphaned admin profile row, status updates may fail with FK error.

## Cleanup

Smoke cleanup result:

- Deleted smoke rows: `3`.
- `food_search_review_queue` returned to `0`.

Post-smoke production counts:

| Table | Count |
| --- | ---: |
| `foods` | 2265 |
| `food_aliases` | 2890 |
| `food_search_events` | 0 |
| `food_search_review_queue` | 0 |

Unchanged counts:

- `foods = 2265`: **PASS**.
- `food_aliases = 2890`: **PASS**.

No alias insert:

- **PASS**.

## Access Smoke

Code path status:

- `/admin/search-review` route exists.
- Page redirects authenticated non-admin users via `user.isAdmin` guard.
- Existing `/admin` entry button links to `/admin/search-review`.

Not fully browser-verified in this smoke:

- admin user opening `/admin/search-review`;
- non-admin redirect in a real browser session.

Reason:

- This smoke used production REST checks and limited queue writes.
- No browser login credentials/session were used.

## Verdict Reason

The queue write/status/cleanup path is production-smoke ready, but the full Admin Review MVP smoke is not green because:

- `food_search_events = 0`, so frequent `not_found` / `ambiguous` items are not visible;
- admin/non-admin browser access was not verified with real sessions;
- some `is_admin` profile rows are orphaned from `auth.users`, which can break reviewer FK if used.

## Required Fixes / Next Checks

Before final `SEARCH_ANALYTICS_ADMIN_REVIEW_PRODUCTION_SMOKE_READY`:

- generate fresh production `not_found` and/or `ambiguous` events through the deployed app;
- confirm `food_search_events` contains those events;
- verify `/admin/search-review` in a real admin browser session;
- verify a non-admin user is blocked/redirected;
- use an auth-backed admin reviewer for queue actions;
- optionally audit/clean orphaned admin profile rows in a separate approved step.

## Final Status

Admin Review Queue write actions work and cleanup was successful, with `foods` and `food_aliases` unchanged. Full production smoke still requires fixes because the review source table currently has no events to display and browser access was not session-verified.
