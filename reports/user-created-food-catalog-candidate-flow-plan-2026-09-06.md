# User-Created Food Catalog Candidate Flow Plan

- Date: 2026-09-06
- Branch: `master`
- HEAD: `72c2002 open food facts license and import strategy`
- Source Open Food Facts strategy: `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- Source hybrid provider strategy: `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- Source missing-food plan: `reports/missing-food-from-calorizer-flow-plan-2026-09-05.md`
- Target package: `USER_CREATED_FOOD_CATALOG_CANDIDATE_FLOW_PLAN`
- Verdict: **USER_CREATED_FOOD_CATALOG_CANDIDATE_FLOW_PLAN_READY**

## Scope

Plan the future flow where a user-created food becomes immediately available to that user as a private food, while a separate catalog candidate/review item is created for possible promotion into the shared POTOK verified catalog.

This is report-only planning. Runtime code was not changed, UI was not changed, config/dependency files were not changed, API clients were not added, external providers were not connected, import was not executed, Supabase SQL was not executed, staging was not mutated, production was not touched, RLS behavior tests were not run, real table writes were not executed, secrets/API keys/JWTs were not collected, service-role keys were not used, RLS policies were not changed, Premium write paths were not touched, diary runtime writes were not executed, and no PR was created.

## Sources Reviewed

- `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- `reports/missing-food-from-calorizer-flow-plan-2026-09-05.md`
- `src/services/foodService.ts`
- `src/services/diaryCreateService.ts`
- `src/services/mealService.ts`
- `src/pages/CreateCustomProductPage.tsx`
- `src/pages/CreateBrandProductPage.tsx`
- `src/components/CreateCustomFoodModal.tsx`
- `src/pages/FoodDiary.tsx`
- `src/pages/FoodSearch.tsx`
- `src/utils/manualFoodFlow.ts`
- `src/utils/foodNormalizer.ts`
- `src/types/index.ts`
- `src/services/__tests__/foodService.manual-create.test.ts`
- `src/services/__tests__/diaryCreateService.test.ts`
- `src/services/__tests__/mealService.diary-enforcement.test.ts`

## 1. Executive Summary

Recommended product rule:

- A user-created food should be available to the creating user immediately.
- The shared POTOK verified catalog must not be polluted automatically.
- A separate catalog candidate/review item should be created from the user's submitted data.
- Promotion into the shared catalog happens only after validation, dedupe, language/quality review, and owner/admin approval.
- Premium Today / `Мой Поток` uses only owner-approved verified catalog foods, not raw user submissions.

Current architecture fit:

- POTOK already has a private user food path using `source='user'` and `created_by_user_id`.
- `diaryCreateService` already allows diary creation for owned private user foods and rejects non-visible private foods.
- Diary snapshots are calculated from canonical food values plus `weight_g`, which fits immediate private diary use.
- The missing piece is a separate candidate/review layer that copies or references the user submission without making it globally visible.

## 2. Product Goal

The goal is to:

- give the user a fast way to add a missing product;
- make that product usable immediately in their own diary and search;
- avoid creating low-quality or duplicate rows in the shared catalog;
- gradually build POTOK's own verified food database from real user demand;
- preserve trust in KBJU, search results, and Premium plans;
- give owner/admins a controlled review queue for candidate promotion.

The product should feel helpful to the user and careful for the catalog: "your product is saved" is immediate; "POTOK may add it to the shared base" is reviewed.

## 3. Recommended Flow

Recommended future flow:

1. User opens missing-food/custom-food form from search, calorizer, or diary add.
2. User enters:
   - name;
   - optional brand;
   - calories/protein/fat/carbs per 100 g;
   - optional fiber;
   - optional barcode.
3. App validates required fields and nutrition sanity.
4. App creates a private owned food:
   - `source='user'`;
   - `created_by_user_id=current user`;
   - visible only to this user.
5. App creates a separate catalog candidate/review draft from the same proposed data.
6. Diary add uses the private owned food through the existing canonical/snapshot-safe path.
7. Catalog candidate is not visible to all users and is not treated as verified catalog.
8. Owner/admin later reviews the candidate and can approve, reject, merge, or request correction.

Important separation:

- The private user food is a user feature.
- The catalog candidate is a catalog-growth/review artifact.
- The verified catalog row is created only after approval.

## 4. Data Separation

### A. Private User Food

Purpose:

- Immediate user value for tracking a missing product.

Visibility:

- Only the creating user.

Ownership:

- Owned by `created_by_user_id`.

Can be used in diary:

- Yes, by the owner, through existing canonical/snapshot-safe diary creation.

Can appear in search:

- Yes, only for the owner.

Can appear in Premium:

- Not in shared Premium plans.
- Later possible only for personal replacements after Premium write/RLS readiness.

Review status:

- No global review required for private use.

Risks:

- User-entered KBJU may be wrong.
- Duplicate private foods may accumulate.

### B. Catalog Candidate / Review Queue

Purpose:

- Capture user demand and proposed food data for possible shared catalog growth.

Visibility:

- Owner/admin/review tools only.
- Not visible as a verified catalog row.

Ownership:

- Created from a user submission, linked to `source_user_food_id` and `created_by_user_id`.

Can be used in diary:

- No. Candidate itself is not a diary source.

Can appear in search:

- Not as a normal product.
- Later it may appear only in admin/review surfaces.

Can appear in Premium:

- No.

Review status:

- `pending`, `needs_review`, `approved`, `merged`, `rejected`, or similar future statuses.

Risks:

- Moderation workload.
- Duplicate submissions.
- Privacy leakage if candidate surfaces expose user data too broadly.

### C. Verified POTOK Catalog

Purpose:

- Trusted shared food database for search, diary adds, recipes, and Premium content.

Visibility:

- Shared according to product/search rules.

Ownership:

- POTOK-owned/approved catalog content with review provenance.

Can be used in diary:

- Yes, through canonical food and diary snapshot creation.

Can appear in search:

- Yes, as normal POTOK product results.

Can appear in Premium:

- Yes, only when owner-approved and content-ready.

Review status:

- Verified/promoted.

Risks:

- Incorrect promotion can damage trust, duplicate identity, and Premium content quality.

## 5. Candidate Fields

Future candidate fields, no SQL in this report:

- `candidate_id`
- `source_user_food_id`
- `created_by_user_id`
- `proposed_name`
- `proposed_brand`
- `normalized_name`
- `normalized_brand`
- `calories`
- `protein`
- `fat`
- `carbs`
- `fiber`
- `barcode`
- `source='user_submission'`
- `review_status`
- `review_reason`
- `duplicate_of_food_id`
- `promoted_to_canonical_food_id`
- `rejected_reason`
- `created_at`
- `reviewed_at`
- `reviewed_by`

Possible later extensions:

- `language_score`
- `quality_score`
- `nutrition_score`
- `duplicate_score`
- `barcode_conflict_status`
- `ru_display_name`
- `admin_notes`
- `source_provider`
- `source_provider_product_id`

## 6. Validation Rules

MVP private creation validation:

- Name is required after trim.
- Calories/protein/fat/carbs are required.
- Numeric values must be finite.
- Negative values are blocked.
- All-zero KBJU is blocked.
- Existing `foodNormalizer` macro validation should be reused.
- Barcode format is validated if barcode is present.

Candidate review validation:

- Suspicious high or low values should mark candidate as `needs_review`.
- Duplicate normalized name + brand should show warning or candidate reason.
- Duplicate barcode should go to conflict review.
- Russian display name quality should be checked before global promotion.
- Ukrainian/Polish/mixed-language/noisy names must not auto-promote.
- Owner/admin review is required before shared catalog visibility.

Promotion validation:

- Candidate must pass dedupe against verified catalog.
- Candidate must have a clean Russian display name.
- Candidate must have acceptable per-100 g nutrition.
- Candidate must have a canonical identity decision.
- Candidate must not rely on unreviewed user notes as source of truth.

## 7. UX Rules

User-facing copy after private save:

- `Продукт сохранён для вас`

Optional secondary copy:

- `Мы проверим данные и сможем добавить продукт в общую базу POTOK`

Copy rules:

- Do not promise automatic publication.
- Do not say the product is already in the common catalog.
- Do not expose technical terms such as SQL, RLS, staging, policies, candidate table, or review_status.
- If candidate is rejected later, the user's private product remains available unless the user deletes it or an abuse/safety policy requires action.
- If candidate is approved later, do not silently rewrite historical diary entries.

Recommended user experience:

- Saving a custom product should feel complete even if catalog review never happens.
- Review submission should be framed as "help improve POTOK" rather than a requirement to use the product.
- If the user enters low-quality data, the app should explain what to fix before private save when possible.

## 8. Admin / Review Flow

Future owner/admin review should include:

- candidate list with filters by date, status, duplicate risk, barcode conflict, and language quality;
- proposed name, brand, barcode, and nutrition;
- link to source private food id without exposing unnecessary user details;
- duplicate suggestions by barcode and normalized name/brand;
- language warnings for Ukrainian/Polish/mixed/noisy display names;
- nutrition warnings for suspicious values;
- actions:
  - approve as new verified food;
  - merge with existing verified food;
  - reject;
  - request correction later;
  - mark as duplicate;
- audit trail:
  - who reviewed;
  - when reviewed;
  - decision reason;
  - promoted canonical food id;
  - rejected reason.

Review principles:

- Approval creates or links a verified catalog food.
- Merge should not delete the user's private food automatically.
- Rejection should not delete the user's private food automatically.
- Candidate data should be immutable enough for audit, with correction handled as a new version or explicit review edit.

## 9. Relation To Open Food Facts

Shared concepts:

- Open Food Facts candidates and user-created candidates can use similar review concepts: quality, language, dedupe, status, provenance, promotion.
- Both must pass quality/language/dedupe rules before catalog promotion.

Important differences:

- Open Food Facts-derived data requires attribution/provenance and may trigger ODbL obligations.
- Pure user-entered data does not inherit ODbL unless copied from Open Food Facts or another provider result.
- Provider-derived and user-entered data must not be mixed invisibly.
- If a user saves an Open Food Facts/provider-backed result as a private food, provenance must remain clear.

POTOK rule:

- Keep `source='user_submission'` candidates separate from `source='open_food_facts'` or provider candidates.
- Shared review UI may be reused, but provenance and legal obligations must stay distinct.

## 10. Relation To Diary

Diary rules:

- Diary entry creation must use the existing canonical/snapshot-safe path.
- Private user food can be used immediately by its owner.
- Catalog candidate itself is not used directly as a diary source.
- Stored diary KBJU must continue to be calculated from canonical food values and `weight_g`.
- Client preview values must not become stored diary source of truth.
- If candidate is later promoted, historical diary entries are not recomputed.
- Do not silently migrate user diary entries from private food to promoted verified food.

Current fit:

- `diaryCreateService` already distinguishes shared `core`/`brand` foods from owned `source='user'` foods.
- This supports immediate diary usage while preserving user scope.

## 11. Relation To Premium

Premium rules:

- Premium Today uses only verified owner-approved foods.
- User-created candidates cannot enter Premium plans until approved.
- User private foods do not change shared Premium plans.
- User private foods may later be used for personal Premium replacements only after Premium write/RLS readiness.
- No Premium writes are part of this package.
- Candidate creation does not unblock Premium write paths, payment, entitlement, or production rollout.

## 12. Implementation Options

### Option A: Create Private User Food Only, No Candidate

Shape:

- Keep current private `source='user'` food creation.
- Do not create catalog candidate.

Pros:

- Safest and simplest.
- Current architecture already supports much of it.
- No moderation workload.

Cons:

- POTOK catalog does not grow from user submissions.
- Owner loses signal about missing products.
- Duplicate private foods remain isolated.

Risks:

- Product misses the owner-approved catalog-growth goal.

Recommendation:

- Not enough for the confirmed owner decision.

### Option B: Create Private User Food + Catalog Candidate

Shape:

- Create owned private food for immediate use.
- Create separate review candidate linked to the private food.
- Candidate remains hidden from public catalog until review.

Pros:

- Satisfies immediate user value.
- Protects verified catalog quality.
- Creates a structured catalog-growth pipeline.
- Preserves user scope and diary snapshot behavior.
- Aligns with Open Food Facts/provider candidate strategy.

Cons:

- Requires future data model, review status, and admin tooling.
- Adds moderation workload.
- Needs duplicate/language/quality scoring.

Risks:

- Candidate queue can grow faster than review capacity.
- Public visibility bugs would be serious and need RLS/visibility tests.

Recommendation:

- Recommended MVP direction.

### Option C: Create Private User Food And Immediately Auto-Publish To Catalog

Shape:

- User-created product becomes visible to all users immediately.

Pros:

- Fastest apparent catalog growth.
- Other users benefit immediately.

Cons:

- Pollutes shared catalog.
- Allows bad KBJU and duplicate names into normal search.
- Can contaminate Premium content.
- Weakens user trust.

Risks:

- Privacy leakage.
- Canonical identity conflicts.
- Incorrect data used by many users.

Recommendation:

- Not recommended.

## 13. Recommended MVP

Recommended MVP:

- Create private user food immediately.
- Create catalog candidate only as a separate review item.
- Do not give the candidate automatic global visibility.
- Do not allow candidate into Premium.
- Do not apply SQL until a data model draft is approved.
- Do not mix provider-derived data and pure user-entered data.
- Do not include photos in MVP.
- Keep current single-add and multi-add diary flows compatible.
- Keep diary writes on the existing canonical/snapshot-safe path.

Suggested implementation order later:

1. Data model draft for catalog candidates, no apply.
2. Draft RLS/visibility plan for candidate review, no apply.
3. Runtime implementation behind existing custom-food flow.
4. Admin review MVP.
5. Promotion/merge flow only after tests and owner approval.

## 14. Test Plan For Future Implementation

Future tests should cover:

- creating custom food creates private owned `source='user'` food;
- created food is usable by owner in diary;
- created food is not visible to another user;
- catalog candidate is created separately;
- candidate links to `source_user_food_id`;
- candidate is not visible as verified catalog;
- invalid KBJU is blocked;
- all-zero KBJU is blocked;
- duplicate normalized name + brand warning works;
- duplicate barcode goes to conflict review;
- Russian display name quality gates automatic promotion;
- Ukrainian/Polish/mixed-language/noisy names are not auto-promoted;
- approval/promotion later creates or links verified catalog food;
- merge links candidate to existing verified food;
- rejection does not delete user's private food;
- diary snapshot remains stable after candidate approval/rejection;
- Premium catalog queries ignore pending/rejected candidates.

Service/contract tests should prove:

- private food visibility remains scoped by `created_by_user_id`;
- candidate visibility remains admin/review-only;
- verified catalog promotion is explicit;
- no public catalog row is created during private food creation unless review approves;
- no provider/ODbL provenance is lost if a candidate is provider-backed.

## 15. Risks

Bad user-entered data:

- Users can enter wrong KBJU or per-serving values as per-100 g.

Duplicate submissions:

- Many users may submit the same product with spelling/brand differences.

Moderation workload:

- Review queue can grow faster than owner/admin capacity.

Privacy leakage:

- Candidate rows must not expose private user-created foods or user identity broadly.

Accidental public visibility:

- Pending candidates must not appear as verified catalog search results.

Premium contamination:

- Pending or rejected candidates must not feed Premium plans.

Canonical identity conflicts:

- Incorrect promotion/merge can create duplicate canonical roots or wrong aliases.

User expectation:

- Users may expect their product to appear publicly immediately unless copy is clear.

Provider contamination:

- Provider-derived data must not be treated as pure user-entered data if user copied/selects external data.

## 16. Recommended Next Step

Recommended next step after this report:

- Commit this report.

Then choose one next planning package:

- `USER_CREATED_FOOD_CATALOG_CANDIDATE_DATA_MODEL_DRAFT_READY` for candidate/review schema planning; or
- `OPEN_FOOD_FACTS_RU_SAMPLE_AUDIT_READY` for a small official-export sample audit with no DB writes.

Recommended sequence:

- Data model draft first if the owner wants to implement user-created candidate flow soon.
- Open Food Facts RU sample audit first if the owner wants to validate provider data quality before schema work.

## Safety Confirmation

Confirmed for this package:

- report-only;
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
- no RLS policy changes;
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

**USER_CREATED_FOOD_CATALOG_CANDIDATE_FLOW_PLAN_READY**
