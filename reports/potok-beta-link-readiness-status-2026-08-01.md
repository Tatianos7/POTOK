# POTOK Beta Link Readiness Status

- Timestamp: 2026-08-01T00:00:00Z
- Scope: beta readiness after auth, new-user bootstrap, Search Analytics/Admin Review, and GitHub Pages fixes
- Production URL: `https://tatianos7.github.io/POTOK/`
- Verdict: **POTOK_BETA_LINK_READY**

## Safety

- This is a status report only.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No import/backfill/recompute was run.
- No aliases were added.
- No foods were created.
- No PR was created.

## Reviewed Status

- `reports/email-otp-custom-smtp-final-status-2026-08-01.md`
- `reports/exercise-catalog-new-user-bootstrap-fix-2026-08-01.md`
- `reports/search-analytics-admin-review-db-applied-final-status-2026-08-01.md`
- `reports/search-analytics-admin-review-production-smoke-2026-08-01.md`
- `reports/github-pages-spa-nested-route-fallback-2026-08-01.md`
- `reports/progress-block-readiness-audit-2026-07-30.md`
- `reports/user-exercise-restore-ui-final-status-2026-07-29.md`

## Ready Areas

Auth:

- Email OTP auth is production-ready.
- Resend Custom SMTP is connected through Supabase.
- Sender/domain setup uses `auth@potok-fit.ru`.
- New-user OTP flow was manually smoke-tested: code delivered, entered in POTOK, login successful, user appeared in Supabase Users.

New-user startup:

- Exercise catalog bootstrap 401 noise was fixed.
- Client no longer tries to create shared exercise categories.
- Shared exercise catalog remains global/read-only.

Food Core and analytics foundation:

- Search Analytics/Admin Review DB layer is applied and ready.
- Runtime logging production smoke is ready.
- Admin Review queue production smoke is ready.
- `food_search_events` contains `query`, `not_found`, and `selection`.
- `food_search_review_queue` writes/status/comment/cleanup work without mutating Food Core.
- No automatic alias creation exists.
- No automatic food creation exists.

GitHub Pages:

- SPA nested route fallback is production-ready.
- Direct nested routes receive the custom `404.html` redirect shim.
- Browser direct open/refresh can restore intended SPA routes through `/POTOK/?p=...`.

Progress and workouts:

- Progress block is ready.
- Nutrition Progress and Workout Progress have no known release-blocking issues.
- User Exercise Restore UI is production-ready.

Data integrity:

- `foods = 2265` unchanged.
- `food_aliases = 2890` unchanged.
- No aliases or foods were auto-created.

## Deferred / Non-Blocking

- Search Analytics `ambiguous` event production smoke.
- Real non-admin browser smoke for `/admin/search-review`.
- Optional cleanup/audit of orphaned admin profile rows in a separate approved step.
- Search analytics retention/cleanup automation before high-volume logging.
- Admin-approved alias apply workflow as a separate reviewed step.
- Open Food Facts / barcode brand candidate layer.
- GitHub Pages nested routes still return HTTP `404` at the network level by design, but the deployed custom `404.html` body redirects browser sessions back into the SPA.
- Advanced Food Core search quality/ranking improvements.
- Nutrition goal-history accuracy when selected periods cross goal changes.
- Calendar week/month semantics for Progress.

## Beta Link Guidance

The beta link can be shared for manual user testing:

- `https://tatianos7.github.io/POTOK/`

Expected beta tester flow:

- open the production app;
- request email OTP;
- receive code through Resend/Supabase SMTP;
- enter code in POTOK;
- land inside the app;
- use nutrition/workout/progress flows without direct-route refresh breaking the SPA.

## Guardrails Still In Force

- Do not create PRs from `master` to `feature/initial-setup`.
- Do not auto-create aliases from analytics.
- Do not auto-create foods from not-found queries.
- Do not mutate Food Core during analytics/admin review.
- Do not recompute historical diary snapshots.
- Keep production workflow on `master`.

## Final Status

POTOK is ready for beta-link testing. Auth, new-user startup, Search Analytics/Admin Review foundation, and GitHub Pages SPA fallback have production-ready status, while the remaining items are non-blocking follow-up work.
