# User-Created Food Catalog Candidates Data Model Draft Review

- Date: 2026-09-06
- Branch: `master`
- HEAD: `9eaaeba user created food catalog candidate flow plan`
- Reviewed report: `reports/user-created-food-catalog-candidates-data-model-draft-2026-09-06.md`
- Reviewed SQL draft: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`
- Target package: `USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT_REVIEW`
- Verdict: **USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT_REVIEW_READY**

## Scope

Review the User-Created Food Catalog Candidate Data Model Draft before any commit or apply. This review checks the SQL draft, report, constraints, RLS/privacy notes, promotion lifecycle, and compatibility with current Food Core / diary snapshot architecture.

This is review-only. Runtime code was not changed, UI was not changed, config/dependency files were not changed, API clients were not added, external providers were not connected, import was not executed, SQL was not executed, staging was not mutated, production was not touched, RLS behavior tests were not run, real table writes were not executed, secrets/API keys/JWTs were not collected, service-role keys were not used, RLS policies were not applied, Premium write paths were not touched, diary runtime writes were not executed, and no PR/commit was created.

## Executive Summary

The draft is sound as a **draft package** and matches the accepted product logic:

- private user food remains immediately available to the owner;
- catalog candidate is a separate review artifact;
- candidate is not a diary source;
- candidate is not a public search row;
- promotion to verified catalog is explicit;
- rejection/merge does not delete private user food;
- historical diary snapshots are not recomputed;
- Premium ignores unapproved candidates.

No blocker was found for committing the draft files as reviewable planning artifacts.

SQL apply readiness: **not apply-ready as-is**. Before any staging/production apply, the draft needs owner/admin decisions and at least one likely SQL adjustment around `source_user_food_id` delete behavior.

## Reviewed Files

- `reports/user-created-food-catalog-candidates-data-model-draft-2026-09-06.md`
- `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`
- `supabase/foods_schema.sql` as local Food Core schema reference
- `src/services/diaryCreateService.ts` as diary visibility/snapshot reference
- `src/services/foodService.ts` as private user food creation reference
- `reports/user-created-food-catalog-candidate-flow-plan-2026-09-06.md`
- `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- `reports/food-database-hybrid-provider-strategy-2026-09-05.md`

## Blocker Findings

No blockers for committing this package as a draft/review artifact.

No source draft files were modified during this review.

## Non-Blocker Findings

### 1. `source_user_food_id` delete behavior needs a pre-apply decision

Reference: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`, lines 24 and 88-92.

The draft uses:

- `source_user_food_id uuid null references public.foods(id) on delete set null`
- `source_type='user_submission'` requires `source_user_food_id is not null`

That combination can make deleting a referenced private user food fail, because `ON DELETE SET NULL` would violate the check constraint for a user-submission candidate.

Required before apply:

- choose `ON DELETE RESTRICT` if candidate audit must keep the source private food;
- or remove the strict not-null check and add a deleted-source status/field if user deletion should be allowed;
- or avoid FK enforcement and store `source_user_food_id` as nullable provenance only, after privacy/schema review.

Severity: non-blocker for draft commit, required fix/decision before SQL apply.

### 2. `approved` status requires same-step promotion/link

Reference: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`, lines 107-111.

The draft requires `promoted_to_canonical_food_id` whenever `review_status='approved'`.

This is valid if "approved" means "promotion already completed." It does not support a two-step lifecycle such as "approved by owner, pending catalog insertion."

Required before apply:

- confirm one-step approve/promote transaction is the intended lifecycle;
- or add a separate status such as `approved_pending_promotion` / `ready_for_promotion`.

Severity: lifecycle design decision, not a blocker if one-step approval is accepted.

### 3. Provider provenance constraint is intentionally loose

Reference: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`, lines 100-105.

The draft allows provider candidates when either `source_provider` or `source_provider_product_id` is present.

For Open Food Facts/provider import, stronger provenance will probably be needed later:

- require `source_provider` for all provider-derived rows;
- require provider product id/code when available;
- possibly add provider URL/payload hash fields before provider import work.

Severity: acceptable for user-submission MVP draft; should be tightened before provider candidate apply.

### 4. `created_by_user_id` intentionally has no FK

Reference: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`, line 25.

The field is `uuid null` without FK. This is acceptable as a conservative draft because user/admin schema and privacy rules still need review.

Before apply, choose one:

- FK to `auth.users(id)` with deletion behavior explicitly defined;
- FK to profile identity if that is the project standard;
- no FK for durable audit/redaction reasons.

Severity: open schema decision, not a blocker for draft.

### 5. Score range constraints can wait

Reference: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`, lines 46-49.

`language_score`, `quality_score`, `nutrition_score`, and `duplicate_score` have no `0..1` range constraints.

Recommendation:

- add range checks later if scores are normalized probabilities;
- leave unconstrained if scores may become weighted/ranked values.

Severity: optional improvement.

### 6. `updated_at` trigger is correctly deferred

Reference: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`, line 57 and checklist line 244.

The draft stores `updated_at` but does not add a trigger. The report explicitly says this should wait for trigger-helper review.

Severity: acceptable for draft; required before production-grade apply if updates are expected.

## Required Fixes Before Apply

Before any staging or production apply:

- decide and fix `source_user_food_id` FK/delete behavior;
- confirm whether approval is one-step or two-step;
- confirm admin role model before writing live policies;
- decide whether users can read limited status of their own submissions;
- decide whether candidate creation is direct client insert, RPC, edge/service boundary, or admin/service orchestration;
- confirm score semantics before adding range constraints;
- add/update `updated_at` trigger if mutable review rows are expected;
- run RLS behavior tests before enabling runtime writes.

## Optional Improvements

Optional draft improvements:

- add provider URL and provider payload hash fields before Open Food Facts/provider import work;
- add a redacted user-facing status view instead of direct user select on the candidate table;
- add `reviewed_by` FK after admin identity is confirmed;
- add `candidate_version` or immutable review-event table if audit/history needs to be stronger;
- add partial indexes by review status for large queues later;
- add a unique provider identity constraint only after provider semantics are stable.

## SQL Apply Readiness Assessment

Current status: **not apply-ready as-is**.

Reasons:

- The draft says not to apply without owner approval, schema review, admin role confirmation, and RLS behavior tests.
- RLS is enabled but live policies are commented.
- The `source_user_food_id` delete behavior requires a product/schema decision.
- Promotion lifecycle needs confirmation before approval tooling is built.

The SQL is appropriate as a draft artifact for review.

## RLS / Privacy Assessment

The RLS stance is cautious and mostly correct:

- RLS is enabled in the draft.
- Production policies are commented.
- Draft comments state that candidates are not public search records.
- Draft comments warn that regular users should not read all candidates.
- Admin policy is held until admin role model confirmation.

Important implication:

- If applied exactly as written, regular authenticated clients would not be able to read/insert candidate rows because RLS has no active policies.
- That is safer than accidental public exposure, but runtime candidate creation would require service-role/admin orchestration or later policies/RPC.

Recommendation:

- Prefer an RPC/service boundary for candidate creation later, especially if candidate rows include admin notes, duplicate internals, provider provenance, or reviewer metadata.
- If users can see status, expose a redacted view rather than the raw table.

## Promotion Lifecycle Assessment

The lifecycle matches the product strategy:

- `pending` and `needs_review` stay out of search/Premium.
- `approved` requires a verified canonical food link.
- `merged` requires an existing duplicate target.
- `rejected` requires a reason.
- Candidate itself is never a diary source.

Main lifecycle decision:

- If owner/admin approval and catalog promotion must be separate actions, add a separate intermediate status before apply.
- If approval always happens in the same transaction as creating/linking verified food, the current constraint is acceptable.

## Compatibility With Food Core / Diary / Premium

Food Core:

- Local schema references confirm `public.foods.id` is `uuid`, and `created_by_user_id` / `canonical_food_id` are uuid fields.
- Candidate FK references to `public.foods(id)` are structurally compatible with the local schema.
- The draft does not add global visibility to `source='user'` foods.

Diary:

- `diaryCreateService` uses canonical food visibility and allows shared `core`/`brand` foods or owned `source='user'` foods.
- Candidate rows are not used as diary sources.
- Snapshot behavior remains stable because diary entries continue to store calculated values from canonical food plus weight.

Premium:

- Pending/rejected/unapproved candidates are not Premium content.
- Premium remains tied to verified owner-approved catalog content.
- No Premium write path is introduced.

Open Food Facts/provider strategy:

- `source_type` supports `open_food_facts` and `provider_import`.
- Provider provenance fields exist.
- Raw provider payload storage is not introduced.
- ODbL/attribution obligations can be tracked later, but provider fields likely need strengthening before provider import implementation.

## Index Assessment

The proposed indexes are sufficient for review/dedupe MVP:

- `review_status, created_at desc` supports queue views.
- `created_by_user_id` supports user-submission lookup.
- `source_user_food_id` supports private-food linkage.
- `normalized_name, normalized_brand` supports exact duplicate checks.
- `barcode` supports barcode conflict checks.
- `duplicate_of_food_id` supports merge history.
- `promoted_to_canonical_food_id` supports promotion lookup.
- `source_provider, source_provider_product_id` supports provider provenance lookup.

Future high-volume improvements can wait until real query patterns are known.

## Validation Checklist

Checked:

- table name: OK;
- required fields: OK;
- field types: broadly OK with `public.foods.id uuid` local compatibility;
- FK references: OK structurally, delete behavior needs decision;
- check constraints: mostly OK;
- indexes: sufficient for MVP;
- comments: clear;
- transaction wrapper: present;
- RLS draft section: cautious, not production policy;
- future apply checklist: present and useful;
- product logic alignment: OK;
- diary snapshot compatibility: OK;
- Premium separation: OK.

## Final Recommendation

Commit the draft/review package after this review if the owner wants to preserve the planning state.

Do not apply the SQL yet.

Before any apply, prepare a revised apply-ready migration that resolves the `source_user_food_id` delete behavior, confirms the approval lifecycle, confirms admin/RLS policy model, and adds only the minimal policies/RPC boundary needed for the first runtime implementation.

## Safety Confirmation

Confirmed for this review:

- review-only;
- no runtime code changes;
- no UI changes;
- no config/dependency changes;
- no API clients added;
- no external provider connection;
- no import execution;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no real table writes;
- no secrets/API keys/JWT collection;
- no service-role keys;
- no RLS policy changes applied;
- no Premium writes;
- no diary runtime writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT_REVIEW_READY**
