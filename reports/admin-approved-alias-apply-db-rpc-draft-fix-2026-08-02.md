# Admin-Approved Alias Apply DB/RPC Draft Fix

- Timestamp: 2026-08-02T00:00:00Z
- Review finding: `reports/admin-approved-alias-apply-db-rpc-draft-review-2026-08-02.md`
- Updated SQL: `supabase/migration_drafts/20260802_admin_approved_alias_apply_draft.sql`
- Updated contract: `reports/admin-approved-alias-apply-db-rpc-draft-2026-08-02.md`
- Verdict: **ADMIN_APPROVED_ALIAS_APPLY_DRAFT_FIXED_READY**

## Safety

- Draft files only.
- Migration was not applied.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No aliases were added.
- No foods were created.
- No writes were made to production `foods`.
- No writes were made to production `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## Fixed P1: Terminal Applied State

The RPC now preserves terminal applied queue state.

Before:

- repeated RPC calls on an already-applied row could set `alias_apply_result = 'already_applied'`;
- this overwrote the row's terminal `applied` result.

After:

- when `applied_alias_id is not null`, the RPC:
  - inserts an audit row with `result = 'already_applied'`;
  - returns `already_applied`;
  - does not update queue apply fields.

The original `alias_apply_result = 'applied'`, `applied_alias_id`, `alias_applied_by`, and `alias_applied_at` stay intact.

## Fixed P1: Shared Canonical Target Only

The RPC now validates target food source.

Allowed canonical targets:

- `foods.source = 'core'`
- `foods.source = 'brand'`

Blocked target:

- `foods.source = 'user'`

New result:

- `invalid_canonical_source`

This result was added to:

- `food_alias_apply_audit_result_check`;
- `food_search_review_queue_alias_apply_result_check`;
- RPC return contract;
- draft report.

## Fixed P2: Permission-Denied Audit

Authenticated non-admin denied attempts are now audited.

Behavior:

- authenticated non-admin:
  - audit row is inserted with `source_review_id = null`;
  - `applied_by = auth.uid()`;
  - `result = 'permission_denied'`;
  - `validation.review_id = p_review_id`;
  - RPC returns `permission_denied`.
- unauthenticated:
  - RPC returns `permission_denied`;
  - no audit row is inserted because no stable actor id is available.

## Fixed P2: Source Evidence / Ambiguous Hardening

The RPC now blocks apply when the review row has no source search event evidence.

New result:

- `missing_source_evidence`

Behavior:

- `source_event_ids` empty or null-equivalent:
  - block apply;
  - audit `missing_source_evidence`;
  - do not insert alias.
- source events include `event_type = 'ambiguous'`:
  - block apply;
  - audit `ambiguous_alias`;
  - do not insert alias.
- `metadata.event_type = 'ambiguous'` remains an additional guard.

Manual override for ambiguous/manual rows remains deferred and must be designed separately.

## Updated Result Contract

RPC/audit/queue result values now include:

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

## Additional Hardening

Blank explicit alias overrides are normalized before validation:

- empty string or whitespace-only `p_alias` falls back to the review query;
- missing review rows fall back to `unknown` for audit shape only;
- audit rows are protected from blank `alias` / `normalized_alias` constraint failures.

## Preserved Safety Contract

The draft still:

- uses explicit RPC only;
- uses `security definer`;
- sets `search_path = public, pg_temp`;
- uses production-correct `user_profiles.id_user`;
- grants RPC execute only to `authenticated`;
- defines no trigger from approved status;
- writes no `foods`;
- does not insert aliases during migration;
- does not remap diary/favorites/recipes;
- does not run import/backfill/recompute.

## Pre-Apply Additions

Before any future apply, validate:

- `public.user_profiles.id_user` exists;
- `public.user_profiles.is_admin` exists;
- `public.normalize_food_text(text)` exists;
- `public.foods.source` exists;
- shared target source values are available: `core`, `brand`;
- `public.food_aliases.normalized_alias` unique constraint/index exists;
- no existing `food_alias_apply_audit` table unless retrying a known partial apply;
- no existing queue apply columns unless retrying a known partial apply;
- pre-apply counts for:
  - `foods`;
  - `food_aliases`;
  - `food_search_review_queue`;
  - diary/favorites/recipes tables.

Expected unchanged after applying this draft:

- `foods`;
- `food_aliases`;
- diary/favorites/recipes counts.

## Post-Apply Validation Additions

After any approved apply, validate:

- audit table exists;
- audit table RLS is enabled;
- audit policies exist;
- queue apply columns exist;
- RPC exists and has execute grant only for `authenticated`;
- no trigger exists that inserts aliases from `food_search_review_queue.status`;
- `foods` count unchanged;
- `food_aliases` count unchanged;
- no audit rows inserted by migration;
- no aliases inserted by migration.

## Remaining Deferred

- Apply-readiness review of the fixed draft.
- Owner apply package.
- Runtime `aliasApplyService`.
- Admin UI section inside Search Review/Data Quality.
- Approved-row production smoke with a temporary test alias only after explicit approval.
- Ambiguous/manual override workflow.
- Optional source semantics for `food_aliases.source = 'admin_review'`.

## Final Recommendation

The draft blockers from review are fixed. Run a fresh apply-readiness review before any owner apply step. Do not apply the migration, create aliases, or write Food Core data until that review passes and owner approval is explicit.
