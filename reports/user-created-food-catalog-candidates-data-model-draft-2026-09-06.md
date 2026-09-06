# User-Created Food Catalog Candidates Data Model Draft

- Date: 2026-09-06
- Branch: `master`
- HEAD: `9eaaeba user created food catalog candidate flow plan`
- Source flow plan: `reports/user-created-food-catalog-candidate-flow-plan-2026-09-06.md`
- Source Open Food Facts strategy: `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- Source hybrid provider strategy: `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- SQL draft: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`
- Target package: `USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT`
- Verdict: **USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT_READY**

## Scope

Prepare a draft data model for the User-Created Food Catalog Candidate flow: the user's custom product remains a private food, while a separate catalog candidate row enters a review queue for possible promotion into the POTOK verified catalog.

This is draft/report-only work. Runtime code was not changed, UI was not changed, config/dependency files were not changed, API clients were not added, external providers were not connected, import was not executed, Supabase SQL was not executed, staging was not mutated, production was not touched, RLS behavior tests were not run, real table writes were not executed, secrets/API keys/JWTs were not collected, service-role keys were not used, RLS policies were not applied, Premium write paths were not touched, diary runtime writes were not executed, and no PR was created.

## Sources Reviewed

- `reports/user-created-food-catalog-candidate-flow-plan-2026-09-06.md`
- `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- current Food Core / `foods` / canonical / diary snapshot architecture references in source reports
- current manual/custom food paths in `foodService`, `diaryCreateService`, `mealService`, `CreateCustomProductPage`, `CreateBrandProductPage`, and `CreateCustomFoodModal`
- existing draft style from `reports/missing-food-review-queue-db-draft-2026-08-05.md`

## 1. Executive Summary

Recommended model:

- Keep private user foods in `public.foods` with `source='user'` and `created_by_user_id`.
- Add a separate future review table: `public.food_catalog_candidates`.
- Candidate rows are review artifacts, not diary sources and not verified catalog rows.
- A candidate can be created from a user private food, Open Food Facts record, or future provider import.
- Promotion into the shared POTOK verified catalog is explicit and review-controlled.
- Rejection or merge does not delete the user's private food.
- Historical diary snapshots are not recomputed.
- Premium uses only verified owner-approved catalog foods.

Draft deliverables:

- SQL draft file: `supabase/sql_drafts/user-created-food-catalog-candidates-draft-2026-09-06.sql`
- Report file: `reports/user-created-food-catalog-candidates-data-model-draft-2026-09-06.md`

## 2. Proposed Table

Proposed future table:

- `public.food_catalog_candidates`

Purpose:

- Store normalized candidate/review records from private user foods and future provider imports.
- Preserve source links and proposed nutrition data.
- Support duplicate review, language/quality review, approval, merge, and rejection.
- Keep unreviewed data out of public search and Premium.

Non-goals:

- Do not replace `public.foods`.
- Do not create diary entries.
- Do not create aliases.
- Do not auto-promote candidates.
- Do not run provider imports.
- Do not mutate historical diary snapshots.

## 3. Field Explanations

Identity and source fields:

- `id`: primary candidate id.
- `source_type`: candidate origin, such as `user_submission`, `open_food_facts`, or `provider_import`.
- `source_user_food_id`: private `public.foods.id` created for the user, required for `user_submission`.
- `created_by_user_id`: user who created the private food/submission, required for `user_submission`.

Proposed food fields:

- `proposed_name`: submitted product name.
- `proposed_brand`: optional submitted brand.
- `normalized_name`: normalized name for dedupe.
- `normalized_brand`: normalized brand for dedupe.
- `calories`, `protein`, `fat`, `carbs`: required per-100 g nutrition.
- `fiber`: optional per-100 g fiber.
- `barcode`: optional barcode, but important for branded products.

Review fields:

- `review_status`: lifecycle state.
- `review_reason`: why review is needed or what triggered triage.
- `duplicate_of_food_id`: existing verified food if candidate is merged/duplicate.
- `promoted_to_canonical_food_id`: verified canonical food created/linked after approval.
- `rejected_reason`: required when rejected.
- `admin_notes`: internal review notes.
- `reviewed_at`: review timestamp.
- `reviewed_by`: owner/admin reviewer id.

Scoring and language fields:

- `language_score`: confidence that display language is valid for POTOK.
- `quality_score`: overall candidate quality confidence.
- `nutrition_score`: nutrition completeness/sanity confidence.
- `duplicate_score`: duplicate/conflict risk.
- `barcode_conflict_status`: barcode conflict state.
- `ru_display_name`: reviewed Russian display name candidate.

Provider compatibility fields:

- `source_provider`: provider name, for example `open_food_facts`.
- `source_provider_product_id`: provider-side product id/code.

Audit fields:

- `created_at`: candidate creation time.
- `updated_at`: candidate update time.

## 4. Constraints

Draft constraints:

- `source_type` must be one of `user_submission`, `open_food_facts`, `provider_import`.
- `review_status` must be one of `pending`, `needs_review`, `approved`, `merged`, `rejected`.
- `proposed_name` must not be blank.
- Calories/protein/fat/carbs/fiber must be non-negative.
- All-zero KBJU is blocked.
- `user_submission` requires `source_user_food_id`.
- `user_submission` requires `created_by_user_id`.
- Provider/import candidates require provider provenance.
- `approved` requires `promoted_to_canonical_food_id`.
- `merged` requires `duplicate_of_food_id`.
- `rejected` requires `rejected_reason`.
- Final statuses require `reviewed_at` and `reviewed_by`.

Draft note:

- The SQL draft intentionally does not include a production-ready updated-at trigger. Add that only after confirming existing trigger helpers and migration conventions.

## 5. Status Lifecycle

Allowed statuses:

- `pending`: candidate created and waiting for review.
- `needs_review`: candidate has warnings, ambiguity, duplicate risk, language concern, barcode conflict, or suspicious nutrition.
- `approved`: candidate approved and linked to a promoted verified canonical food.
- `merged`: candidate resolved as duplicate/merge into an existing verified food.
- `rejected`: candidate rejected with a reason.

Lifecycle rules:

- New user-created candidates should start as `pending` or `needs_review`.
- Candidates are never visible as verified catalog entries while `pending`, `needs_review`, or `rejected`.
- `approved` requires a clear verified-catalog link.
- `merged` requires the target existing food.
- `rejected` must not delete the user's private food.
- Status changes should create an audit trail.

## 6. RLS / Privacy Draft

Privacy rules:

- Candidates are not public search records.
- Regular users should not read all candidates.
- Creating user may later see limited status for their own submission, but only through a redacted view or carefully scoped policy.
- Owner/admin can review all candidates.
- Service-role/admin review is required for promotion.
- Candidate records should not expose unnecessary user data.

RLS draft stance:

- The SQL draft enables RLS but leaves production policies commented.
- Admin policy is not applied because the current admin role model must be confirmed first.
- A possible admin predicate can use `public.user_profiles.id_user = auth.uid()` and `is_admin = true`, matching earlier draft patterns, but it must be validated against the current production schema.

Open questions before RLS apply:

- What is the canonical admin role source for this project now?
- Should regular users see review status of their own candidates?
- If yes, should this be a redacted view instead of direct table select?
- Should users be allowed to insert candidate rows directly, or should runtime use an RPC/service boundary?
- Which fields are safe to show back to users?

## 7. Indexes

Draft indexes:

- `review_status, created_at desc` for review queue sorting.
- `created_by_user_id` for owner/user submission lookup.
- `source_user_food_id` for linking candidate to private food.
- `normalized_name, normalized_brand` for exact duplicate checks.
- `barcode` partial index for barcode conflict checks.
- `duplicate_of_food_id` partial index for merge history.
- `promoted_to_canonical_food_id` partial index for approval history.
- `source_provider, source_provider_product_id` partial index for Open Food Facts/provider candidates.

Index intent:

- Support review queue performance.
- Support dedupe checks.
- Support provenance lookup.
- Avoid treating pending candidates as search catalog rows.

## 8. Dedupe Support

Dedupe inputs:

- Barcode.
- `normalized_name`.
- `normalized_brand`.
- Existing `canonical_food_id`.
- Existing aliases.
- Provider source and provider product id.

Rules:

- Duplicate barcode is a conflict/review signal, not an automatic merge.
- Exact normalized name + brand can suggest duplicate.
- Existing verified canonical food wins until review decides otherwise.
- Fuzzy matches are suggestions only.
- Pending candidates do not create aliases.
- Candidate approval/merge must be explicit.

## 9. Relation To Existing Foods Table

Current private food path:

- User-created food remains in `public.foods`.
- It uses `source='user'`.
- It uses `created_by_user_id=current user`.
- It remains available to the owner immediately.

Candidate relation:

- Candidate references `source_user_food_id`.
- Candidate is not the source of diary entries.
- Candidate does not give global visibility to the private food.
- Candidate does not alter `diaryCreateService`.

Promotion relation:

- Approval later creates or links a verified `public.foods` row.
- Merge later links candidate to an existing verified food.
- Private user food remains separate unless a future explicit user-facing migration is designed.
- Historical diary entries remain stable because snapshots were already stored.

## 10. Open Food Facts Compatibility

Compatibility rules:

- The same candidate table can support future Open Food Facts/provider submissions.
- `source_type`, `source_provider`, and `source_provider_product_id` preserve provider origin.
- Open Food Facts-derived candidates need attribution/provenance.
- Pure user submissions do not inherit ODbL unless copied from Open Food Facts or another provider.
- Provider-derived and user-entered data must not be mixed invisibly.

Recommended handling:

- `source_type='user_submission'` for pure user-created foods.
- `source_type='open_food_facts'` for Open Food Facts-derived candidates.
- `source_type='provider_import'` for other provider candidates.
- Keep provenance fields populated for any provider-derived candidate.

## 11. Promotion / Merge / Reject Behavior

Approve:

- Owner/admin validates language, nutrition, and duplicates.
- A verified catalog food is created or linked.
- Candidate status becomes `approved`.
- `promoted_to_canonical_food_id` is set.

Merge:

- Owner/admin decides candidate represents an existing verified food.
- Candidate status becomes `merged`.
- `duplicate_of_food_id` is set.
- No private user food deletion happens automatically.

Reject:

- Owner/admin rejects low-quality, duplicate, noisy, non-food, non-Russian, or unsafe candidate.
- Candidate status becomes `rejected`.
- `rejected_reason` is set.
- User's private food remains available unless separately removed by the user or abuse/safety process.

Always preserved:

- Candidate itself is never a diary source.
- Historical diary snapshots are not recomputed.
- Premium ignores pending/rejected/unapproved candidates.

## 12. Validation Checklist

Before future implementation:

- Confirm `public.foods.id` type and FK compatibility.
- Confirm UUID default helper availability.
- Confirm current admin role model.
- Confirm whether users can read limited own candidate status.
- Confirm whether candidate insert happens client-side or through a server/RPC boundary.
- Confirm no candidate rows are included in normal food search.
- Confirm Premium catalog ignores candidates.
- Confirm user private food visibility remains scoped.
- Confirm promotion does not mutate historical diary snapshots.
- Confirm provider provenance rules before Open Food Facts candidates are inserted.

## 13. Test Plan For Future Implementation

Future tests should cover:

- candidate created separately from private food;
- private food is visible only to owner;
- private food can be used by owner in diary;
- candidate is not visible in public search;
- pending candidate is ignored by Premium;
- rejected candidate is ignored by Premium;
- `approved` status requires `promoted_to_canonical_food_id`;
- `merged` status requires `duplicate_of_food_id`;
- rejected candidate requires `rejected_reason`;
- rejection does not delete private food;
- merge does not delete private food;
- historical diary snapshots remain stable after approval/rejection/merge;
- duplicate barcode candidate goes to review/conflict;
- duplicate normalized name + brand creates warning/review reason;
- provider-derived candidate preserves provenance.

RLS tests later:

- regular user cannot read all candidates;
- user cannot read another user's submission details;
- admin can review all candidates;
- non-admin cannot approve/merge/reject;
- candidate rows cannot be used as diary food sources.

## 14. Risks

Privacy leakage:

- Candidate review rows can accidentally expose user-created foods or user identity.

Accidental public visibility:

- Pending candidates must never appear as verified search results.

Bad data:

- User-entered KBJU can be wrong or per-serving values can be entered as per-100 g.

Duplicate/canonical conflicts:

- Weak dedupe can create duplicate verified foods or wrong merges.

Moderation workload:

- Candidate queue can grow faster than owner/admin review capacity.

RLS complexity:

- Review/admin policies need confirmed role model and behavioral tests.

Premium contamination:

- Pending/provider/user candidates must not feed Premium plans.

Provider provenance:

- Open Food Facts-derived candidates may trigger attribution and ODbL obligations.

## 15. Open Questions

Open questions:

- Should users see the review status of their own submissions?
- Should candidate creation be automatic after every custom-food save or opt-in copy?
- Should candidate creation happen in the same transaction as private food creation later?
- Should the review table store user id directly, or only source food id plus redacted metadata?
- Should owner/admin be able to edit proposed nutrition before approval?
- Should approved user submissions create aliases back to the submitted private food name?
- How should abuse/spam submissions be throttled?
- Should high-confidence candidates ever be batch-approved, or always manually reviewed?
- Where should Open Food Facts attribution live if provider candidates use the same table?

## 16. Recommended Next Step

Recommended next step:

- Commit this draft package.

Recommended later package:

- `USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT_REVIEW_READY`

Then choose:

- owner/admin review of the SQL draft;
- RLS/admin role model confirmation;
- or Open Food Facts RU sample audit before applying any schema.

Do not apply this SQL until owner approval, admin role confirmation, migration review, and RLS behavior test readiness.

## Safety Confirmation

Confirmed for this package:

- draft/report-only;
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
- no PR.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT_READY**
