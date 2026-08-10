# Missing Food Owner Apply Smoke Food Cleanup Applied Final Status

- Timestamp: 2026-08-10T00:00:00Z
- Owner cleanup package: `reports/missing-food-owner-apply-smoke-food-cleanup-owner-package-2026-08-10.md`
- Cleanup plan: `reports/missing-food-owner-apply-smoke-food-cleanup-plan-2026-08-09.md`
- Target food: `812e6711-4e99-4d1e-8b88-5a4b011b1ad3`
- Target draft: `b65055c5-1283-46fd-ba69-de7f395eae88`
- Verdict: **SMOKE_FOOD_CLEANUP_APPLIED_READY**

## Safety

- This is a final status report only.
- Cleanup was run manually by the owner in Supabase production.
- Production DB schema was not changed by Codex.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- RPC was not called by Codex.
- No foods were created by Codex.
- No aliases were added by Codex.
- No import/backfill/recompute was run.
- No PR was created.

## Apply Result

Owner production cleanup status:

- Pre-check: PASS.
- Cleanup transaction result: Success. No rows returned.
- Post-check: PASS.

Cleanup target:

- deleted food: `812e6711-4e99-4d1e-8b88-5a4b011b1ad3`;
- reset draft: `b65055c5-1283-46fd-ba69-de7f395eae88`.

## Confirmed Object State

Post-check confirmed:

- smoke food `812e6711-4e99-4d1e-8b88-5a4b011b1ad3` was deleted;
- draft `b65055c5-1283-46fd-ba69-de7f395eae88` was reset to `ready_for_owner_apply`;
- `applied_food_id` was cleared;
- `applied_by` was cleared;
- `applied_at` was cleared.

The draft remains available for a future corrected owner-approved apply path after fresh review/pre-check.

## Final Counts

Final production counts after cleanup:

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

Expected cleanup effect:

- `foods` returned to `2266`;
- `food_aliases` stayed `2890`;
- `food_alias_apply_audit` stayed `0`;
- `food_missing_food_drafts` stayed `1`;
- diary/favorites/recipes/search counts stayed unchanged.

## Confirmed Boundaries

Cleanup confirmed:

- no foods were created;
- no aliases were created;
- `food_aliases` unchanged;
- `food_alias_apply_audit` unchanged;
- diary/favorites/recipes/search counts unchanged;
- owner-apply RPC was not called during cleanup;
- Alias Apply RPC was not called;
- no import/backfill/recompute was run.

## Current Status

The smoke-created food cleanup is complete. Production no longer contains the imperfect smoke food `Сырники ки`, and the linked draft is back in `ready_for_owner_apply` with all apply-tracking fields cleared.

## Deferred

- Corrected draft review before any future owner apply.
- Fresh duplicate/pre-check before creating a corrected core food.
- Future owner-approved apply only through `public.apply_owner_approved_missing_food_draft(...)`.
- Alias follow-up only through Admin-approved Alias Apply after a canonical food exists.

## Final Status

Smoke-created food rollback/delete is applied and ready. The cleanup restored Food Core counts, preserved aliases and audit rows, reset the draft safely, and kept the no-RPC/no-import/no-backfill/no-recompute boundary for Codex.
