# Admin-Approved Alias Apply DB/RPC Draft Review

- Timestamp: 2026-08-02T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260802_admin_approved_alias_apply_draft.sql`
- Reviewed report: `reports/admin-approved-alias-apply-db-rpc-draft-2026-08-02.md`
- Prior verdict: `ADMIN_APPROVED_ALIAS_APPLY_DRAFT_READY`
- Review verdict: **ADMIN_APPROVED_ALIAS_APPLY_REQUIRES_FIXES**

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

## Summary

The draft is directionally correct:

- uses explicit RPC instead of service-only validation;
- uses `security definer` with fixed `search_path = public, pg_temp`;
- uses production-correct `user_profiles.id_user`;
- defines no trigger from approved queue status;
- writes no `foods`;
- inserts `food_aliases` only inside explicit admin RPC;
- adds audit and queue tracking structure.

However, apply is not ready yet. Three fixes are required before owner apply.

## P1 Blocker: Applied Queue State Can Be Overwritten

Finding:

- The RPC detects already-applied rows:
  - `elsif v_review.applied_alias_id is not null then`
  - `v_result := 'already_applied'`
- But the final queue update still runs for every result:
  - `alias_apply_result = v_result`
  - `alias_apply_error = v_error`

Impact:

- A row with `alias_apply_result = 'applied'` can be changed to `already_applied` by a repeated RPC call.
- The queue loses its terminal applied state even though `applied_alias_id` remains set.
- This conflicts with the intended contract that applied rows are terminal/read-only.

Required fix:

- If `applied_alias_id is not null`, return/audit `already_applied` without changing queue apply fields; or
- preserve `alias_apply_result = 'applied'`, `alias_apply_error = null`, `alias_applied_by`, and `alias_applied_at` for already-applied rows.

Recommended behavior:

- Keep the existing applied state untouched.
- Insert audit row with `result = 'already_applied'`.
- Return `already_applied` to the caller.

## P1 Blocker: Canonical Target Source Is Not Restricted

Finding:

- The RPC validates only that `suggested_canonical_food_id` exists in `foods`.
- It does not check `foods.source`.

Impact:

- A global `food_aliases` row could be created for a `source='user'` food if such a target reaches an approved queue row.
- Public alias lookup could then point a shared alias at user-owned food data.
- This violates the clean shared-catalog/manual-review boundary.

Required fix:

- Fetch target food source during canonical validation.
- Allow only shared targets:
  - `source in ('core', 'brand')`
- Block `source='user'` with a structured result such as:
  - `invalid_canonical_source`
  - or reuse `orphan_canonical` with a precise error message.

Recommended fix:

- Add a distinct result: `invalid_canonical_source`.
- Add it to:
  - audit result check;
  - queue result check;
  - RPC return contract;
  - report.

## P2 Fix: Permission-Denied Attempts Are Not Audited

Finding:

- The RPC returns `permission_denied` before inserting into `food_alias_apply_audit`.

Impact:

- Most admin-validation failures are audited.
- `review_not_found` is audited.
- But non-admin/unauthenticated attempts are not audited, despite the draft saying the audit table records every apply attempt.

Required decision:

- Either update the contract to explicitly exclude permission-denied attempts from audit; or
- audit denied attempts with:
  - `source_review_id = null`;
  - `applied_by = auth.uid()` when present;
  - `result = 'permission_denied'`;
  - `validation` containing `review_id`.

Recommended fix:

- Audit authenticated non-admin denied attempts.
- For unauthenticated calls, returning `permission_denied` without audit is acceptable if documented.

## P2 Fix: Ambiguous Guard Depends On Best-Effort Metadata

Finding:

- Ambiguous blocking checks:
  - referenced `food_search_events` where `event_type = 'ambiguous'`;
  - `v_review.metadata->>'event_type' = 'ambiguous'`.

Assessment:

- This works for rows created by the current Admin Review MVP service.
- It is weaker for manually inserted/edited queue rows where `source_event_ids` is empty and metadata is missing.

Recommended fix before apply or runtime integration:

- Require source evidence for apply, or explicitly mark manual rows as allowed.
- Safer MVP:
  - block rows with empty `source_event_ids` unless admin passes a later explicit manual override flow;
  - keep ambiguous override deferred.

This is less urgent than the first two blockers but should be resolved before enabling UI.

## Security Definer Review

Status: mostly acceptable after fixes.

Positive:

- Function is `security definer`.
- `search_path` is fixed to `public, pg_temp`.
- Function name and table references are schema-qualified where it matters.
- `execute` is revoked from `public`.
- `execute` is granted only to `authenticated`.
- Explicit admin guard uses `public.user_profiles.id_user`.

Pre-apply requirement:

- Confirm function owner will not be a low-privilege role.
- Confirm `auth.uid()` is available in the execution context.
- Confirm `public.normalize_food_text(text)` exists in production.

## RLS/Audit Table Policies

Status: acceptable with noted permission-denied audit decision.

Audit table:

- RLS enabled.
- Admin select policy exists.
- Admin insert policy exists.
- No non-admin select/update/delete policy exists.

Note:

- The `security definer` RPC may bypass ordinary caller RLS depending on function owner/table owner. The explicit admin guard is therefore the primary protection.

## Duplicate/Conflict/Orphan/Status Checks

Status:

- duplicate same target: covered;
- existing alias different target: covered;
- orphan canonical: covered by explicit exists check and FK exception handling;
- not approved: covered;
- already applied: detected, but queue state handling needs P1 fix;
- ambiguous: covered for current service-generated rows, needs hardening for manual rows;
- invalid blank alias: covered.

## Food Aliases Schema Compatibility

Expected fields are present in tracked schema:

- `id`;
- `canonical_food_id`;
- `alias`;
- `normalized_alias`;
- `source`;
- `verified`;
- `created_by_user_id`.

Compatibility notes:

- `unique (normalized_alias)` exists in tracked schema.
- `food_aliases_normalize_trigger` exists in tracked schema.
- `normalize_food_text` exists in tracked schema.
- Existing tracked admin policy examples still mention `user_profiles.user_id`, but this draft correctly uses `id_user`.

Pre-apply must validate production, not only tracked files.

## No Trigger From Approved Status

Status: pass.

No trigger/function was found that automatically inserts aliases when `food_search_review_queue.status` becomes `approved`.

The only alias insert path in the draft is inside:

- `public.apply_admin_approved_food_alias(...)`

## No Writes To Foods

Status: pass.

The draft:

- selects from `foods`;
- references `foods` through FKs;
- never inserts/updates/deletes `foods`.

## Pre/Post Validation Plan Review

Current plan is mostly good but should add checks for the required fixes.

Add pre-apply checks:

- confirm `foods.source` exists and has expected values;
- confirm no existing `food_alias_apply_audit` table;
- confirm no existing queue apply columns;
- confirm `food_aliases.source` has no restrictive check that rejects selected source value;
- capture `food_search_review_queue` count.

Add post-apply checks:

- confirm audit table policies;
- confirm RPC grants;
- confirm no trigger exists on `food_search_review_queue` that writes aliases;
- confirm `foods` count unchanged;
- confirm `food_aliases` count unchanged;
- confirm no audit rows were inserted by migration.

## Required Fix List

Must fix before apply:

- Preserve terminal applied queue state on repeated RPC calls.
- Restrict canonical targets to shared foods, not `source='user'`.

Should fix before apply or explicitly document:

- Decide whether permission-denied attempts are audited.
- Harden ambiguous/manual-row behavior.

## Final Recommendation

Do not apply the current draft yet.

Update the SQL draft, then run a fresh apply-readiness review. The architecture is good, but the current version needs the terminal-state and canonical-source fixes before it is safe for production apply.
