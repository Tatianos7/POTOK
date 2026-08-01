# Search Analytics / Admin Review DB Draft Fix

- Timestamp: 2026-08-01T00:00:00Z
- Reviewed finding: `reports/search-analytics-admin-review-sql-draft-review-2026-08-01.md`
- Updated SQL: `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- Updated contract: `reports/search-analytics-admin-review-db-draft-2026-08-01.md`
- Verdict: **SEARCH_ANALYTICS_ADMIN_REVIEW_DRAFT_FIXED_READY**

## Safety

- Draft files only.
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

## Fix

The blocker from SQL draft review was fixed:

- `food_search_events_selection_consistency_check` now enforces mutually exclusive event states.

Strict event contract:

- `query`: no flags, `selected_canonical_food_id = null`.
- `selection`: `selected_canonical_food_id is not null`, all flags false.
- `no_selection`: only `no_selection = true`, selected canonical is null.
- `not_found`: only `not_found = true`, `result_count = 0`, selected canonical is null.
- `ambiguous`: only `ambiguous = true`, selected canonical is null.

This prevents mixed analytics states such as:

- `query + not_found=true`;
- `query + selected_canonical_food_id`;
- `no_selection + ambiguous`;
- `ambiguous + not_found`;
- `selection + no_selection`.

## Manual-Review Contract Preserved

The draft still does not write to:

- `public.foods`;
- `public.food_aliases`;
- diary/favorites/recipes tables.

The draft still preserves:

- no automatic alias insertion;
- no automatic food creation;
- no silent canonical choice for ambiguous queries;
- admin approval only;
- approved queue status records intent only.

## Remaining Apply Notes

Before any apply step, still confirm:

- explicit owner approval;
- `public.food_search_events` does not already exist;
- `public.food_search_review_queue` does not already exist;
- `public.user_profiles.is_admin` exists;
- pre-apply counts for `foods`, `food_aliases`, `food_diary_entries`, `favorite_products`, `recipes`, and `recipe_ingredients`.

After any approved apply, confirm:

- both new tables exist;
- RLS policies exist;
- indexes exist;
- existing Food Core/downstream row counts are unchanged;
- no aliases or foods were inserted.

## Deferred

- Runtime logging service.
- Privacy/retention policy before high-volume logging.
- Admin UI.
- Approved alias apply workflow.
- Open Food Facts/barcode candidate persistence.

## Final Recommendation

The SQL draft is fixed and ready for a fresh apply-readiness review. Do not apply it until a separate explicit apply approval is given.
