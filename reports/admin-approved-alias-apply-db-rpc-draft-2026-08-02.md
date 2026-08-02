# Admin-Approved Alias Apply DB/RPC Draft

- Timestamp: 2026-08-02T00:00:00Z
- Basis: `reports/admin-panel-alias-apply-integration-audit-2026-08-02.md`
- Draft SQL: `supabase/migration_drafts/20260802_admin_approved_alias_apply_draft.sql`
- Scope: DB/RPC draft for explicit admin-approved alias application from Search Review
- Verdict: **ADMIN_APPROVED_ALIAS_APPLY_DRAFT_READY**

## Safety

- Draft only.
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

## Design Decision

Use an explicit DB RPC for Alias Apply:

- `public.apply_admin_approved_food_alias(review_queue_id, alias, comment)`

Reason:

- validation, insert, audit, and queue update must happen in one transaction;
- frontend/service checks alone are not enough for duplicate/race safety;
- approval status must not create aliases automatically;
- the database can enforce admin-only execution and return a structured result.

The draft defines no trigger from `food_search_review_queue.status`. An approved row remains only an intent until an admin explicitly calls the RPC.

## Draft Summary

The draft adds:

- `public.food_alias_apply_audit`
- apply tracking columns on `public.food_search_review_queue`
- `public.apply_admin_approved_food_alias(...)`

It does not add triggers that write aliases.

It does not write to:

- `public.foods`;
- diary entries;
- favorites;
- recipes;
- recipe ingredients.

The only future write to `public.food_aliases` is inside the explicit admin RPC and only after all validations pass.

## Apply Flow Contract

Approved-row flow:

1. Admin reviews a `not_found` Search Analytics item.
2. Admin creates/updates a queue row in `food_search_review_queue`.
3. Admin approves the row with `suggested_canonical_food_id`.
4. Admin clicks an explicit `Apply alias` action in Admin Panel/Search Review.
5. RPC validates the row and candidate.
6. RPC inserts exactly one `food_aliases` row if validation passes.
7. RPC records an audit row.
8. RPC updates queue apply result metadata.

Blocked rows do not insert aliases.

## Validation Rules

The RPC validates:

- current user is authenticated admin;
- production admin lookup uses `user_profiles.id_user = auth.uid()`;
- review row exists;
- review row status is `approved`;
- review row has not already applied an alias;
- approved row has `suggested_canonical_food_id`;
- suggested canonical food exists in `foods.id`;
- alias text is non-blank;
- normalized alias is non-blank via `normalize_food_text`;
- source review events are not `ambiguous`;
- existing `food_aliases.normalized_alias` duplicate is blocked;
- existing alias mapped to another canonical food is blocked as conflict.

The RPC returns:

- `applied`
- `duplicate_alias`
- `existing_alias_conflict`
- `orphan_canonical`
- `not_approved`
- `ambiguous_alias`
- `already_applied`
- `permission_denied`
- `invalid_alias`
- `review_not_found`
- `insert_failed`

## Alias Insert Contract

On success, the draft inserts one row into `food_aliases`:

- `canonical_food_id = approved suggested_canonical_food_id`
- `alias = explicit alias argument or review query`
- `source = 'core'`
- `verified = true`
- `created_by_user_id = current admin id`

The existing `food_aliases_normalize_trigger` remains responsible for writing `normalized_alias`.

Open note before apply:

- `source = 'core'` is conservative for the current schema because existing `food_aliases.source` has no dedicated `admin_review` source contract.
- If product wants source-level provenance, keep provenance in `food_alias_apply_audit` first or draft a separate source semantics change.

## Audit Trail

`food_alias_apply_audit` records every apply attempt:

- `source_review_id`
- `alias_id`
- `alias`
- `normalized_alias`
- `canonical_food_id`
- `applied_by`
- `applied_at`
- `result`
- `error`
- `validation`
- `comment`

Successful apply rows require:

- `source_review_id`;
- `alias_id`;
- `canonical_food_id`;
- `applied_by`;
- no error.

Review-not-found attempts can still be audited without a valid `source_review_id`.

## Review Queue Tracking

The draft adds these nullable fields to `food_search_review_queue`:

- `applied_alias_id`
- `alias_applied_by`
- `alias_applied_at`
- `alias_apply_result`
- `alias_apply_error`

These fields record apply result only. They do not change the existing review statuses:

- `pending`
- `approved`
- `rejected`
- `snoozed`

No new queue status is introduced in this draft.

## RLS/Admin Contract

Audit table:

- admin can select;
- admin can insert;
- non-admin has no policy.

RPC:

- `security definer`;
- explicit admin guard inside the function;
- uses production-correct `public.user_profiles.id_user = auth.uid()`;
- execution granted only to `authenticated`.

Pre-apply must still confirm:

- `public.user_profiles.id_user` exists;
- `public.user_profiles.is_admin` exists;
- `public.normalize_food_text(text)` exists;
- `public.food_search_review_queue` exists;
- `public.food_aliases` exists and has `unique (normalized_alias)`.

## No Auto-Alias Rules

The draft preserves:

- no automatic alias insertion from search analytics;
- no automatic food creation;
- no silent canonical for ambiguous events;
- no trigger from approved status;
- no writes to `foods`;
- no diary/favorites/recipes remap;
- no historical snapshot recompute.

Approved review rows are still inert until explicit admin apply.

## Pre-Apply Gate

Before applying later, capture:

- explicit owner approval;
- current `foods` count;
- current `food_aliases` count;
- current `food_search_review_queue` count;
- current `food_alias_apply_audit` existence check;
- confirm no duplicate alias remediation is bundled;
- confirm no Food Core import/backfill/recompute is bundled.

Expected unchanged counts after DB apply:

- `foods`: unchanged;
- `food_aliases`: unchanged;
- diary/favorites/recipes counts: unchanged.

## Post-Apply Validation

After an approved DB apply, validate:

- `food_alias_apply_audit` exists;
- RLS is enabled on `food_alias_apply_audit`;
- expected audit policies exist;
- queue apply columns exist;
- RPC exists;
- no trigger exists on `food_search_review_queue` that inserts aliases;
- `foods` count unchanged;
- `food_aliases` count unchanged;
- no aliases inserted during migration.

Do not test the RPC against production by inserting a real alias unless a separate owner-approved smoke row and cleanup plan exists.

## Runtime Plan Later

After approved DB apply:

- add `aliasApplyService`;
- show approved rows with validation/apply state inside Admin Panel Search Review/Data Quality;
- call RPC only from explicit admin action;
- render duplicate/conflict/orphan/ambiguous errors;
- keep Search Review queue approval separate from alias apply;
- add targeted service/UI tests.

Do not change resolver/ranking/diary writes in the Alias Apply MVP.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Approved row accidentally creates alias | High | No status trigger; explicit RPC only |
| Duplicate alias race | High | DB unique constraint plus RPC transaction/exception handling |
| Existing alias points elsewhere | High | Block as `existing_alias_conflict` |
| Orphan canonical target | High | FK plus explicit `foods.id` validation |
| Ambiguous query silently canonicalized | High | Block source events with `event_type = 'ambiguous'` |
| Wrong admin profile column | High | Use and pre-check `user_profiles.id_user` |
| Provenance lost | Medium | Audit table records source review, admin, result, validation |
| Source semantics unclear | Medium | Use `source='core'` for current schema; keep review provenance in audit |

## Deferred

- Admin UI implementation.
- Runtime `aliasApplyService`.
- Production smoke with a temporary approved test row.
- Optional `food_aliases.source = 'admin_review'` semantics, if product wants explicit source values.
- Batch alias apply.
- Ambiguous alias override workflow.
- Open Food Facts/barcode candidate apply workflow.

## Final Recommendation

The DB/RPC draft is ready for owner review. Do not apply it until a separate apply-readiness review confirms the production schema and pre/post validation plan. Alias creation must remain explicit, admin-approved, audited, and separate from Search Review approval.
