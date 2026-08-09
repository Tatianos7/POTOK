# Missing Food Owner Apply Production Smoke

- Timestamp: 2026-08-09T00:00:00Z
- DB status: `reports/missing-food-owner-apply-db-applied-final-status-2026-08-09.md`
- Runtime/UI status: `reports/missing-food-owner-apply-runtime-ui-2026-08-09.md`
- Smoke source: owner manual app-session smoke test in production `/admin/missing-food-review`
- Verdict: **MISSING_FOOD_OWNER_APPLY_PRODUCTION_SMOKE_PASS**

## Safety

- This is a production smoke status report only.
- Smoke was performed manually by the owner from an authenticated app session.
- Production DB schema was not changed by Codex.
- Runtime code was not changed by Codex in this status update.
- Storage buckets and policies were not changed.
- RPC was not called by Codex.
- No additional foods were created by Codex.
- No aliases were added by Codex.
- Alias Apply RPC was not called by Codex.
- No import/backfill/recompute was run.
- No PR was created.

## Smoke Result

Owner production app-session smoke passed.

Action tested:

- `/admin/missing-food-review`
- `Owner apply food`
- explicit UI confirmation accepted by owner

Applied draft:

| Field | Value |
| --- | --- |
| `id` | `b65055c5-1283-46fd-ba69-de7f395eae88` |
| `status` | `applied` |
| `applied_food_id` | `812e6711-4e99-4d1e-8b88-5a4b011b1ad3` |
| `applied_by` | filled |
| `applied_at` | `2026-08-09 18:16:46 UTC` |

Created food:

| Field | Value |
| --- | --- |
| `id` | `812e6711-4e99-4d1e-8b88-5a4b011b1ad3` |
| `name` | `Сырники ки` |
| `normalized_name` | `сырники ки` |
| `category` | `desserts` |
| `source` | `core` |
| `unit` | `g` |
| `calories` | 220 |
| `protein` | 14 |
| `fat` | 8 |
| `carbs` | 23 |
| `fiber` | `null` |
| `data_source` | `manual_test` |

## Data Integrity

Counts after smoke:

| Table | Count |
| --- | ---: |
| `foods` | 2267 |
| `food_aliases` | 2890 |
| `food_alias_apply_audit` | 0 |
| `food_missing_food_drafts` | 1 |

Confirmed:

- app-session owner apply works;
- exactly one food was created;
- selected draft was marked `applied`;
- `applied_food_id`, `applied_by`, and `applied_at` were filled;
- `food_aliases` stayed unchanged;
- `food_alias_apply_audit` stayed `0`;
- Alias Apply was not called;
- no direct UI writes to `foods` or `food_aliases` exist;
- food creation happened only through `public.apply_owner_approved_missing_food_draft(...)`.

## Contract Confirmed

The smoke confirms the intended end-to-end owner-approved path:

```text
ready_for_owner_apply draft -> app-session Owner apply food -> explicit RPC -> one core food -> draft applied
```

The smoke also confirms the safety boundary:

- missing-food draft apply does not create aliases;
- missing-food draft apply does not call Admin-approved Alias Apply;
- missing-food draft apply does not run import/backfill/recompute;
- alias follow-up remains a separate reviewed action, if needed.

## Deferred

- Post-food-creation Alias Apply follow-up, if the original query is a safe alias.
- Stable food id policy for owner-created missing foods.
- Dedicated audit table for owner food creation attempts.
- Cleanup/remediation package only if owner later decides the smoke food should not remain.

## Final Status

Owner-approved Missing Food Apply is production-smoke-passed. The authenticated admin UI can create one reviewed `core` food through the installed RPC, mark the draft applied, and preserve the no-alias/no-import/no-recompute boundary.
