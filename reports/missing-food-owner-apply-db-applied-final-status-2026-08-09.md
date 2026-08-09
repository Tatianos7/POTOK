# Missing Food Owner Apply DB Applied Final Status

- Timestamp: 2026-08-09T00:00:00Z
- Applied SQL: `supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql`
- Owner apply package: `reports/missing-food-owner-apply-owner-package-2026-08-09.md`
- Apply-readiness review: `reports/missing-food-owner-apply-db-draft-review-2026-08-09.md`
- Verdict: **MISSING_FOOD_OWNER_APPLY_DB_APPLIED_READY**

## Safety

- This is a final status report only.
- Migration was applied manually by the owner in Supabase production.
- Production DB schema was not changed by Codex.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- RPC was not called by Codex.
- No foods were created by Codex.
- No aliases were added by Codex.
- No import/backfill/recompute was run.
- No PR was created.

## Apply Result

Owner production apply status:

- Pre-check: PASS.
- Migration result: Success. No rows returned.
- Post-check: PASS.

Installed RPC:

- `public.apply_owner_approved_missing_food_draft(draft_id uuid)`

Migration apply created only the RPC/function layer. It did not create foods, aliases, draft rows, search rows, review rows, diary rows, favorites, recipes, or recipe ingredients.

## Confirmed RPC Contract

Post-check confirmed:

- RPC exists:
  - `public.apply_owner_approved_missing_food_draft(draft_id uuid)`
- RPC uses admin gate through:
  - `public.user_profiles.id_user = auth.uid()`
  - `is_admin = true`
- RPC validates:
  - `status = 'ready_for_owner_apply'`
  - draft `applied_food_id`, `applied_by`, and `applied_at` are null before apply
  - `source = 'core'`
  - `unit = 'g'`
- RPC can insert into `foods` only on explicit future RPC call.
- RPC marks the selected draft applied only after successful food insert.
- RPC does not insert into `food_aliases`.
- RPC does not call Alias Apply.
- RPC does not touch diary/favorites/recipes.
- No trigger from draft status to food creation was added.
- No import/backfill/recompute path was added.

## Final Counts

Post-apply counts were unchanged:

| Table | Count |
| --- | ---: |
| `favorite_products` | 7 |
| `food_alias_apply_audit` | 0 |
| `food_aliases` | 2890 |
| `food_diary_entries` | 168 |
| `food_missing_food_drafts` | 1 |
| `food_missing_review_queue` | 3 |
| `food_search_events` | 100 |
| `food_search_review_queue` | 2 |
| `foods` | 2266 |
| `recipe_ingredients` | 47 |
| `recipes` | 15 |

Confirmed:

- `foods` unchanged.
- `food_aliases` unchanged.
- `food_missing_food_drafts` unchanged.
- `food_missing_review_queue` unchanged.
- Search/review counts unchanged.
- Diary/favorites/recipes counts unchanged.
- No food was created by migration apply.
- No alias was created by migration apply.
- No draft was marked applied by migration apply.

## Current Boundary

The DB is now ready for a future owner-approved food creation package, but no food creation has occurred yet.

A future food creation step must still:

- approve one exact `draft_id`;
- run draft-specific pre-checks;
- call `public.apply_owner_approved_missing_food_draft(...)` exactly once;
- validate `foods +1`;
- validate `food_aliases` unchanged;
- validate selected draft `applied_*` fields;
- avoid import/backfill/recompute.

Alias follow-up remains separate and must use Admin-approved Alias Apply only after a canonical food exists and the alias itself is safe.

## Deferred

- First owner-approved missing-food creation call/package.
- Production smoke for one reviewed food creation.
- Post-food-creation Alias Apply follow-up, if appropriate.
- Stable food id policy.
- Dedicated audit table for owner food creation attempts.

## Final Status

Owner-approved Missing Food Apply DB/RPC layer is applied and ready. Production now has the explicit RPC installed, while all Food Core and related data counts stayed unchanged and no foods or aliases were created.
