# Search Analytics / Admin Review DB Applied Final Status

- Timestamp: 2026-08-01T00:00:00Z
- Applied SQL: `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- Basis: `reports/search-analytics-admin-review-owner-apply-package-2026-08-01.md`
- Retry fix: `reports/search-analytics-admin-review-failed-apply-fix-2026-08-01.md`
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_DB_APPLIED_READY**

## Safety

- This report records a completed manual production DB apply.
- Runtime code was not changed.
- Storage buckets and policies outside the reviewed DB layer were not changed.
- No import/backfill/recompute was run.
- No Food Core import was run.
- No aliases were added.
- No foods were created.
- Recipes, nutrition, workouts, progress, and auth runtime code were not changed.
- No PR was created.

## Apply Context

The first owner apply attempt failed with:

- `ERROR 42703: column "user_id" does not exist`

Root cause:

- The draft initially used `public.user_profiles.user_id = auth.uid()` for admin RLS checks.
- Production `public.user_profiles` uses `id_user uuid`.
- `is_admin` exists.

Retry fix:

- Admin RLS checks now use `public.user_profiles.id_user = auth.uid()`.
- `food_search_events.user_id` remains the analytics event owner column.

## Applied DB Layer

The manually applied migration created the Search Analytics/Admin Review DB layer:

- `public.food_search_events`
- `public.food_search_review_queue`

The applied migration preserves the manual-review-only contract:

- no automatic alias insertion;
- no automatic food creation;
- no silent canonical choice for ambiguous queries;
- admin approval only;
- approved queue status records intent only and does not insert into `food_aliases`.

## Post-Check Result

Post-check confirmed:

- `food_search_events` exists.
- `food_search_review_queue` exists.
- `food_search_events` count is `0`.
- `food_search_review_queue` count is `0`.
- RLS is enabled on both tables.

Policies confirmed:

- `food_search_events_admin_all`
- `food_search_events_insert_own`
- `food_search_events_select_own`
- `food_search_review_queue_admin_all`

## Existing Counts

Post-apply existing table counts remained unchanged:

| Table | Count |
| --- | ---: |
| `foods` | 2265 |
| `food_aliases` | 2890 |
| `food_diary_entries` | 155 |
| `favorite_products` | 6 |
| `recipes` | 14 |
| `recipe_ingredients` | 43 |

## Scope Not Changed

The apply did not change:

- Food Core rows;
- food aliases;
- diary snapshots;
- favorites;
- recipes;
- recipe ingredients;
- runtime search/resolver behavior;
- auth, workouts, progress, nutrition, or recipe runtime code.

## Next Step

The DB layer is ready for a separate runtime logging implementation phase.

Runtime logging must remain non-blocking and must not change resolver behavior. Privacy, retention, and metadata allowlist rules should be finalized before high-volume production logging.

## Final Status

Search Analytics/Admin Review DB layer is applied and ready. Production now has empty analytics/review tables with RLS and admin policies in place, while Food Core/downstream data counts remain unchanged.
