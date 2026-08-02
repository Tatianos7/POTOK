# Admin-Approved Alias Apply Fixed Draft Apply Readiness

- Timestamp: 2026-08-02T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260802_admin_approved_alias_apply_draft.sql`
- Fix report: `reports/admin-approved-alias-apply-db-rpc-draft-fix-2026-08-02.md`
- Prior review: `reports/admin-approved-alias-apply-db-rpc-draft-review-2026-08-02.md`
- Review verdict: **ADMIN_APPROVED_ALIAS_APPLY_APPLY_READY**

## Safety

- Review only.
- Migration was not applied.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No aliases were added.
- No foods were created.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## Fixed Blocker Review

The prior P1 blockers are fixed.

Terminal applied state:

- `already_applied` is detected before the final queue update path.
- The RPC writes an audit row and returns early.
- Existing `applied_alias_id`, `alias_applied_by`, `alias_applied_at`, and terminal `alias_apply_result = 'applied'` remain untouched.

Canonical target source:

- The RPC now reads `foods.source`.
- Allowed targets are only:
  - `core`;
  - `brand`.
- `source='user'` is blocked with `invalid_canonical_source`.

## Result Checks

The new result values are present in both DB checks:

- `food_alias_apply_audit_result_check`
- `food_search_review_queue_alias_apply_result_check`

Included fixed values:

- `invalid_canonical_source`
- `missing_source_evidence`

Existing result contract remains complete:

- `applied`
- `duplicate_alias`
- `existing_alias_conflict`
- `orphan_canonical`
- `invalid_canonical_source`
- `not_approved`
- `ambiguous_alias`
- `missing_source_evidence`
- `already_applied`
- `permission_denied`
- `invalid_alias`
- `review_not_found`
- `insert_failed`

## Permission-Denied Audit

Authenticated non-admin attempts are audited:

- `source_review_id = null`;
- `applied_by = auth.uid()`;
- `result = 'permission_denied'`;
- `validation.review_id = p_review_id`.

Unauthenticated attempts return `permission_denied` without audit because no stable actor id exists.

Assessment: acceptable for apply.

## Ambiguous And Manual Rows

The draft now blocks unsafe source states:

- empty or null-equivalent `source_event_ids` returns `missing_source_evidence`;
- referenced `food_search_events.event_type = 'ambiguous'` returns `ambiguous_alias`;
- `metadata.event_type = 'ambiguous'` remains an additional guard.

Manual override for ambiguous/manual queue rows is deferred and is not part of this apply.

Assessment: acceptable for MVP apply.

## Security Definer Review

Status: apply-ready with pre-apply owner check.

Positive:

- RPC is `security definer`;
- `search_path = public, pg_temp`;
- admin check uses production-correct `public.user_profiles.id_user = auth.uid()`;
- `revoke all ... from public`;
- `grant execute ... to authenticated`;
- all mutation logic is inside explicit RPC call;
- no approved-status trigger exists.

Pre-apply must confirm:

- function owner will be a privileged DB role, not a low-privilege application role;
- `auth.uid()` works in production RPC context;
- `public.user_profiles.id_user` and `is_admin` exist.

## RLS/Audit Policies

Audit table:

- RLS is enabled.
- Admin select policy exists.
- Admin insert policy exists.
- Non-admin users have no read/update/delete policy.

The RPC has an explicit admin guard, which is the primary protection under `security definer`.

Assessment: apply-ready.

## Food Alias Schema Compatibility

Tracked schema contains required `food_aliases` fields:

- `id`;
- `canonical_food_id`;
- `alias`;
- `normalized_alias`;
- `source`;
- `verified`;
- `created_by_user_id`.

Tracked schema also contains:

- `unique (normalized_alias)`;
- `food_aliases_normalize_trigger`;
- `normalize_food_text(value text)`.

Pre-apply must validate the production schema, not only tracked files.

## No Automation / No Food Writes

No trigger from approved status was found.

The draft:

- does not create a trigger on `food_search_review_queue.status`;
- does not insert/update/delete `foods`;
- does not remap diary/favorites/recipes;
- does not recompute snapshots;
- does not insert aliases during migration apply.

The only `food_aliases` insert path is the explicit admin RPC after the migration is applied and later called.

## Apply Scope

This apply-ready verdict is for the DB draft only:

- create audit table;
- add nullable queue apply fields;
- create RPC;
- create policies/indexes/grants.

It is not approval to:

- call the RPC in production;
- create a real alias;
- create foods;
- enable runtime UI;
- run import/backfill/recompute.

## Pre-Apply Gate

Before applying, capture:

- explicit owner approval;
- confirm `public.user_profiles.id_user` exists;
- confirm `public.user_profiles.is_admin` exists;
- confirm `public.normalize_food_text(text)` exists;
- confirm `public.foods.source` exists;
- confirm shared source values exist or are expected: `core`, `brand`;
- confirm `public.food_aliases.normalized_alias` unique constraint/index exists;
- confirm `public.food_aliases` has `source`, `verified`, `created_by_user_id`;
- confirm `public.food_search_review_queue` exists;
- confirm no trigger currently writes aliases from review queue status;
- confirm function/table names do not already exist unless retrying a known partial apply.

Capture counts:

- `foods`;
- `food_aliases`;
- `food_search_review_queue`;
- `food_search_events`;
- `food_diary_entries`;
- `favorite_products`;
- `recipes`;
- `recipe_ingredients`.

Expected unchanged after applying this migration:

- all counts above.

## Post-Apply Validation

After apply, validate:

- `food_alias_apply_audit` exists;
- RLS enabled on `food_alias_apply_audit`;
- audit policies exist;
- queue apply columns exist;
- result checks include `invalid_canonical_source` and `missing_source_evidence`;
- RPC exists;
- RPC execute grant is only for `authenticated`;
- no trigger exists that inserts aliases from `food_search_review_queue.status`;
- `foods` count unchanged;
- `food_aliases` count unchanged;
- downstream counts unchanged;
- `food_alias_apply_audit` count is `0`;
- no aliases inserted by migration.

Do not run a real alias smoke in the apply validation step unless separately approved with a test row and cleanup plan.

## Residual Risks

| Risk | Status | Mitigation |
| --- | --- | --- |
| Function owner ambiguity | Apply gate | Confirm owner/role during apply |
| Production schema drift | Apply gate | Run exact pre-checks before apply |
| Real alias smoke mutates Food Core | Deferred | Separate approval and cleanup plan |
| Ambiguous manual override | Deferred | Separate workflow, not part of MVP |
| `food_aliases.source` provenance | Deferred | Current draft keeps provenance in audit |

## Final Recommendation

The fixed Admin-approved Alias Apply DB/RPC draft is ready for an owner-approved DB apply package. Apply only this draft, then run the pre/post validation above. Do not call the RPC, create aliases, create foods, change runtime code, import, backfill, or recompute in the same step.
