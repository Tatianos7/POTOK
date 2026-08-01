# Search Analytics Runtime Logging Zero Events Investigation

- Timestamp: 2026-08-01T00:00:00Z
- Scope: investigation/fix for `food_search_events = 0` after runtime logging smoke
- Related reports:
  - `reports/search-analytics-runtime-logging-implementation-2026-08-01.md`
  - `reports/search-analytics-runtime-logging-production-smoke-2026-08-01.md`
  - `reports/search-analytics-admin-review-production-smoke-2026-08-01.md`
- Verdict: **SEARCH_ANALYTICS_RUNTIME_LOGGING_DEPLOYED_READY**

## Safety

- Runtime investigation did not change DB schema.
- Storage buckets and policies were not changed.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No aliases were created.
- No foods were created.
- Diary/favorites/recipes were not changed.
- Resolver/ranking behavior was not changed.
- No import/backfill/recompute was run.
- No PR was created.

## Finding

Production `food_search_events` remained `0` because the Search Analytics runtime/Admin Review changes were present locally but were not yet committed and deployed to `master`.

Evidence:

- Local git `HEAD` / `origin/master` was `3919e7f Fix exercise catalog bootstrap for new users`.
- Search Analytics runtime files were uncommitted locally.
- Production GitHub Pages loaded bundle `main-D4TfZD5G.js`.
- Production bundle did not include the new `/admin/search-review` route.
- Production DB count showed `food_search_events = 0`.

Conclusion:

- The deployed app was still running the pre-Search-Analytics build.
- No production browser search could call `searchAnalyticsService`, because that code was not in the deployed bundle.

## Insert Path Review

Local runtime insert path is present:

- `src/services/searchAnalyticsService.ts`
- `src/services/foodService.ts`
- `src/components/ProductSearch.tsx`

Events intended for `food_search_events`:

- `query`
- `selection`
- `not_found`
- `ambiguous`

Non-goal:

- `no_selection` remains disabled to avoid noisy analytics.

## Guardrails Review

Local guardrails do not explain `0` events:

- normal food queries longer than 2 characters are allowed;
- obvious email/phone PII is skipped;
- dedupe only skips repeated same query/context/event for 30 seconds;
- blank `userId` becomes `null` and uses `session_id_hash`;
- authenticated `user_id` remains supported.

## RLS/Policy Context

The applied DB layer has insert policy:

- authenticated users may insert events where `user_id is null` or `user_id = auth.uid()`.

Runtime payload rules align with that contract:

- logged-in users can send `user_id`;
- blank/missing `user_id` becomes `null`;
- `session_id_hash` is used when `user_id` is null.

No production authenticated browser insert could be observed because the deployed bundle did not include the logging code.

## Fix

The Search Analytics runtime/Admin Review implementation was deployed from `master`:

- Commit: `f602c8118b446b8984bcf9ba48d73fdfe0d43780`
- GitHub Pages run: `30710916655`
- Deploy status: **PASS**
- Production bundle after deploy: `assets/main-Vv4wgMNj.js`
- Production bundle contains:
  - `food_search_events`;
  - `food_search_review_queue`;
  - `/admin/search-review`.

After deploy, repeat production smoke:
  - search existing product;
  - select product;
  - search not-found query;
  - confirm `food_search_events` increments;
  - confirm `foods = 2265`;
  - confirm `food_aliases = 2890`;
  - confirm no alias/food insert.

## Verification Before Deploy

Targeted tests:

- `npx tsx --test src/services/__tests__/searchAnalyticsService.test.ts src/services/__tests__/searchAdminReviewService.test.ts`
- Result: **PASS**, `11/11`.

Build:

- `npm run build`
- Result: **PASS**.

Deploy:

- GitHub Pages run `30710916655`: **PASS**.
- Production bundle verification: **PASS**.

## Final Status

The zero-events issue was explained by missing production deployment, not by the runtime insert path. Search Analytics runtime logging and Admin Review MVP are now present in the production GitHub Pages bundle.

Next production smoke should create events through the deployed app and confirm `food_search_events` increments while `foods = 2265` and `food_aliases = 2890` remain unchanged.
