# Missing Food From Calorizer Flow Plan

- Date: 2026-09-05
- Branch: `master`
- HEAD: `0cbd498 food diary multi add flow implementation`
- Source readiness map: `reports/today-premium-product-readiness-map-with-owner-ideas-2026-09-02.md`
- Source multi-add implementation: `reports/food-diary-multi-add-flow-implementation-2026-09-03.md`
- Target package: `MISSING_FOOD_FROM_CALORIZER_FLOW_PLAN`
- Verdict: **MISSING_FOOD_FROM_CALORIZER_FLOW_PLAN_READY**

## Scope

Plan a future flow for adding a product that is missing from the food search / calorizer flow.

This is report-only planning. No runtime code was changed, no UI was changed, no config/dependency files were changed, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no secrets/API keys/JWTs were collected, no service-role keys were used, no RLS policies were changed, no Premium writes were touched, no diary runtime writes were executed during this planning step, and no PR was created.

## Source Reviewed

- `reports/today-premium-product-readiness-map-with-owner-ideas-2026-09-02.md`
- `reports/food-diary-multi-add-flow-implementation-2026-09-03.md`
- `src/pages/FoodSearch.tsx`
- `src/pages/FoodDiary.tsx`
- `src/components/ProductSearch.tsx`
- `src/components/AddProductModal.tsx`
- `src/components/CreateCustomFoodModal.tsx`
- `src/pages/CreateCustomProductPage.tsx`
- `src/pages/CreateBrandProductPage.tsx`
- `src/services/foodService.ts`
- `src/services/diaryCreateService.ts`
- `src/services/mealService.ts`
- `src/utils/manualFoodFlow.ts`
- `src/utils/diaryAddNavigation.ts`
- `src/utils/foodDiaryMultiAdd.ts`
- `src/utils/foodNormalizer.ts`
- `src/types/index.ts`
- `src/services/__tests__/foodService.manual-create.test.ts`
- `src/services/__tests__/diaryCreateService.test.ts`
- `src/services/__tests__/mealService.diary-enforcement.test.ts`
- `src/utils/__tests__/foodDiaryMultiAdd.test.ts`
- `src/utils/__tests__/diaryAddNavigation.test.ts`

## 1. Current Behavior

Current search behavior:

- User opens `/nutrition/search` from a selected meal in `FoodDiary.tsx`.
- `FoodSearch.tsx` renders the search input, recent/favorite foods, `ProductSearch`, single-add modal, and multi-add basket.
- `ProductSearch.tsx` searches through `foodService.search`.
- If results are empty, `ProductSearch.tsx` currently shows only `Продукты не найдены`.
- There is no direct empty-search CTA inside `/nutrition/search` that starts a missing-food creation flow.
- Product card click still opens the existing single-add modal.
- Product `+` adds an existing food to the multi-add basket.

Existing manual/custom food paths:

- `FoodDiary.tsx` has an add-product modal with actions for `Ввод марки продукта`, `Ввод своего продукта`, and `Анализатор рецепта`.
- `/nutrition/create-custom-product` creates a private user food through `foodService.createCustomFood`, then creates one diary entry.
- `/nutrition/create-brand-product` creates a private branded user food through `foodService.createManualBrandedFood`, then creates one diary entry.
- `CreateCustomFoodModal` also creates a user food through `foodService.createCustomFood` and returns it to `FoodDiary.tsx`, which opens the existing add-food modal.
- `manualFoodFlow.ts` currently only preserves `selectedDate` for return navigation.

Current data/service behavior:

- `foodService.createCustomFood` and `createManualBrandedFood` create `source='user'` foods.
- User foods include `created_by_user_id`.
- `createManualBrandedFood` keeps branded manual foods private and does not create shared `source='brand'` catalog rows.
- `foodService.loadUserFoodsFromSupabase` scopes user foods by `source='user'` and `created_by_user_id`.
- `foodService.getFoodByIdFresh` rejects another user's `source='user'` food when a session user is known.
- `diaryCreateService` allows canonical food writes only for shared `core` / `brand` foods or owned `source='user'` foods.
- `diaryCreateService` computes diary snapshots from canonical food values and `weight_g`.

Current gap:

- The product exists as separate manual creation screens, but the user who searches and gets no results does not get an obvious next action in the search empty state.
- The current create pages immediately write one diary entry, which is useful for single-add but not ideal as the shared base for search empty state and multi-add basket compatibility.

## 2. Product Goal

Goal:

- user searches for a product in the calorizer / food search;
- product is not found;
- user sees a clear `Добавить продукт` action;
- user enters product name, optional brand, KBJU per 100 g, and optionally the intended portion weight;
- product is saved as a private user-created food;
- the created food is immediately available to the same user in search, single-add, and multi-add;
- after creation, the user can add it to the diary without repeating search.

Product stance:

- missing-food creation is an explicit user action;
- user-created foods are private by default;
- public/global catalog publishing is not part of MVP;
- moderation/submission can be designed later as a separate flow.

## 3. UX Flow

Empty search result state:

- When the user has typed a query and no results are available, show product-facing empty copy.
- Add a clear CTA: `Добавить продукт`.
- Pre-fill the product name with the current search query.
- Keep the old empty message secondary, not as a dead end.

CTA behavior:

- `Добавить продукт` opens a missing-food form.
- The form can be a dedicated route or modal, but it should preserve `selectedDate`, `mealType`, and current search query.
- The action must not create a food automatically.

Product form:

- Name field is required and prefilled from search query when available.
- Brand is optional.
- KBJU fields are per 100 g.
- Fiber can be optional if the current data model supports it.
- Optional portion weight can be used for immediate diary add after creation.
- The form should show a compact KBJU preview for the entered portion if portion weight is present.

Validation:

- Inline validation should catch empty name, missing/invalid KBJU, negative values, all-zero KBJU, and suspicious high values.
- Duplicate warning should compare against existing user foods and catalog hits using normalized name and optional brand.
- Duplicate warning should not block if the user explicitly confirms they still want a private custom product.

Save:

- Save creates a private `source='user'` food for the current user.
- Save does not publish to shared `core` or `brand` catalog.
- Save does not create admin review rows in MVP unless a separate moderation feature is explicitly approved.

Return to diary/search:

- If opened from single-add search, after creating the food open the existing `AddFoodToMealModal` with the created food.
- If opened while building the multi-add basket, offer `Добавить в выбранное` or return to search with the created food available and selected.
- If a portion weight was entered and the user chose immediate add, use the existing diary creation path.
- Return navigation must preserve the original `selectedDate` and `mealType`.

Compatibility with single-add:

- Existing product card click -> `AddFoodToMealModal` behavior remains unchanged.
- Created food should flow into the same add modal as any other food.

Compatibility with multi-add basket:

- Existing product `+` behavior remains unchanged.
- Created food can be added as a new basket draft.
- Duplicate created food selection should follow the current multi-add dedupe/focus behavior.
- Multi-add save should continue to use existing canonical diary creation and all-prevalidation.

## 4. Data Rules

Required rules:

- Do not auto-create a food from arbitrary search text.
- Create food only after explicit user confirmation.
- User-created food must not enter the global catalog without moderation.
- MVP user-created food uses `source='user'`.
- MVP user-created food uses `created_by_user_id=current user`.
- User-created branded food remains `source='user'`; brand is an attribute, not shared catalog status.
- Preserve canonical rules: the created user food should be usable as its own canonical root when saved to the diary.
- Do not pollute stable/global catalog rows, aliases, or public search identity.
- Other users' private foods must not be searchable, readable, or addable.
- Diary snapshot principle remains: stored diary KBJU is computed from the created food values and `weight_g`, not from client preview totals.
- Historical diary entries are not recalculated if the user later edits a custom food.
- Do not touch Premium write paths.
- Do not mix this with recipe import, shopping persistence, AI, voice, payment, RLS, SQL, staging, or production work.

## 5. Required Fields

Recommended MVP fields:

- `name` required;
- `brand` optional;
- `calories` per 100 g required;
- `protein` per 100 g required;
- `fat` per 100 g required;
- `carbs` per 100 g required;
- `fiber` optional if supported by the current form and storage path;
- intended diary weight optional for immediate add;
- serving size later;
- barcode later;
- photo later;
- allergens/intolerances later;
- public catalog submission later.

Recommended copy:

- Tell the user the product is saved only for them.
- Avoid wording that implies the product is added to the shared catalog.
- Avoid technical terms such as SQL, RLS, staging, or policy in user-facing copy.

## 6. Validation

MVP validation should require:

- name is non-empty after trimming;
- calories is present, finite, and `>= 0`;
- protein is present, finite, and `>= 0`;
- fat is present, finite, and `>= 0`;
- carbs is present, finite, and `>= 0`;
- fiber, if present, is finite and `>= 0`;
- calories and macros stay within reasonable per-100 g limits;
- at least one of calories/protein/fat/carbs is non-zero under the existing `foodNormalizer` rule;
- no all-zero product is saved unless a later reviewed exception model is explicitly designed;
- suspicious values show warning/review copy instead of silently saving low-quality data;
- duplicate warning checks normalized name and optional normalized brand against current user foods and visible catalog foods.

Existing validation reuse:

- `getInvalidFoodMacroReason`, `getInvalidFoodMacroMessage`, and `assertValidFoodMacros` already cover missing/invalid/negative/all-zero KBJU.
- `validateNutrition` already identifies suspicious high nutrition values.
- A later implementation should reuse these helpers instead of duplicating ad hoc numeric parsing.

## 7. Implementation Options

Option A: use existing manual/custom food flow if present.

Shape:

- Link empty search CTA to the existing custom/brand product form.
- Pass `selectedDate`, `mealType`, and prefilled `name` through route state.
- After save, return to the originating search/add context.

Pros:

- lowest implementation size;
- reuses existing service path and validation;
- avoids new SQL/config/dependency work;
- keeps manual branded food private as already tested.

Cons:

- current create pages also choose meal type and immediately write one diary entry;
- pages may need route-state cleanup to preserve the original meal context;
- not as smooth for multi-add basket unless the form can return a created food without immediate diary write.

Risk:

- medium, mostly navigation and accidental immediate-write behavior.

Recommendation:

- reuse service/validation pieces, but adjust the UX integration rather than blindly routing to the old page behavior.

Option B: add dedicated `Add missing food` form from search empty state.

Shape:

- Add a small missing-food form/modal launched from `/nutrition/search`.
- Prefill name from the search query.
- Save only the private user food first.
- After creation, open single-add modal or add to multi-add basket depending on user intent.

Pros:

- best fit for the search empty state;
- separates product creation from diary entry creation;
- easiest to support both single-add and multi-add;
- avoids forcing the user to reselect meal/date.

Cons:

- adds new UI surface and tests;
- needs careful duplicate warning;
- needs clear save states and retry behavior.

Risk:

- medium, but lower product risk than immediate diary-write pages for this specific flow.

Recommendation:

- recommended MVP path if implementation can stay small and reuse `foodService.createCustomFood` plus existing validation helpers.

Option C: defer global catalog submission/moderation to later.

Shape:

- MVP creates private user foods only.
- Later, a separate moderation/admin package can allow users to submit candidates for shared catalog review.

Pros:

- protects public catalog quality;
- avoids moderation/RLS/admin workflow expansion in this package;
- keeps MVP shippable.

Cons:

- duplicate private foods may accumulate;
- high-quality user additions do not improve the shared catalog immediately.

Risk:

- low for MVP, with future data-quality debt.

Recommendation:

- do this for MVP. Do not publish to the global catalog now.

## 8. Recommended MVP

Recommended MVP:

- private user-created food only;
- launch from `/nutrition/search` empty state with `Добавить продукт`;
- prefill name from the current search query;
- save product as `source='user'` with `created_by_user_id=current user`;
- make it immediately available to the same user;
- after creation, open the existing single-add modal by default;
- allow an explicit `Добавить в выбранное` path for multi-add if the basket exists or if the user clicked from basket-building context;
- do not publish to global catalog;
- do not add admin approval/moderation unless already in a separate approved package;
- do not change SQL unless the current schema lacks fields required for existing `foodService.createCustomFood`;
- preserve existing single-add and multi-add behavior.

Recommended first implementation shape:

- add empty-state CTA to `ProductSearch` or parent `FoodSearch`;
- add a small missing-food form component or adapt `CreateCustomFoodModal`;
- reuse `foodNormalizer` validation;
- call `foodService.createCustomFood`;
- then pass the created food into existing `handleSelect` or `addFoodToMultiAddBasket`;
- keep route state/date/meal type intact through `manualFoodFlow` or a small route-state helper.

## 9. Files Likely To Change Later

Likely runtime files:

- `src/pages/FoodSearch.tsx`
- `src/components/ProductSearch.tsx`
- `src/components/CreateCustomFoodModal.tsx`
- possible new component: `src/components/MissingFoodForm.tsx`
- possible new component: `src/components/MissingFoodEmptyState.tsx`
- `src/pages/CreateCustomProductPage.tsx` only if route-state reuse is chosen;
- `src/pages/CreateBrandProductPage.tsx` only if branded route-state reuse is chosen;
- `src/utils/manualFoodFlow.ts`
- `src/utils/foodNormalizer.ts` only if validation helpers need small extensions;
- `src/services/foodService.ts` only if current create/duplicate helpers need a small orchestration method;
- `src/types/index.ts` only if a new form draft type is promoted;
- `src/utils/foodDiaryMultiAdd.ts` only if created-food basket handoff needs pure helper support.

Likely tests:

- new or updated `src/components/__tests__/ProductSearchMissingFoodEmptyState.test.tsx`
- new `src/components/__tests__/MissingFoodForm.test.tsx`
- new or updated `src/pages/__tests__/FoodSearchMissingFoodFlow.test.tsx`
- updated `src/services/__tests__/foodService.manual-create.test.ts`
- existing `src/services/__tests__/diaryCreateService.test.ts`
- existing `src/services/__tests__/mealService.diary-enforcement.test.ts`
- existing `src/utils/__tests__/foodDiaryMultiAdd.test.ts`
- existing `src/utils/__tests__/diaryAddNavigation.test.ts`

Files that should not change in the first implementation unless separately approved:

- package/dependency files;
- Supabase SQL/migrations;
- RLS policies;
- Premium Today files;
- payment/entitlement files;
- provider API clients;
- food search ranking logic beyond the empty-state CTA and duplicate warning.

## 10. Test Plan For Implementation

Later implementation should test:

- empty search shows `Добавить продукт` CTA;
- CTA pre-fills product name from the search query;
- form validates required name;
- form validates calories/protein/fat/carbs required values;
- negative and non-finite values are blocked;
- all-zero KBJU is blocked;
- suspicious high values show warning/review behavior according to product decision;
- duplicate warning appears for matching user food;
- duplicate warning appears for matching visible catalog food;
- save creates `source='user'` food;
- created food has `created_by_user_id` for the current user;
- save does not create `source='core'` or shared `source='brand'` rows;
- created product can be added through existing single-add modal;
- created product can be added to the multi-add basket;
- multi-add duplicate behavior still focuses/dedupes created food;
- diary snapshot uses created food macros and weight;
- existing search results still work;
- existing product card click still opens single-add;
- existing product `+` still adds to multi-add;
- selected date and meal type are preserved;
- save error keeps the form available for retry.

Service/contract tests should keep proving:

- other users' private foods are not visible/addable;
- canonical food root rules are preserved;
- `weight_g > 0` remains required for diary writes;
- client preview KBJU is not trusted as stored diary snapshot;
- no global catalog pollution occurs.

## 11. Risks

Food data quality:

- User-entered KBJU can be inaccurate. Validation and clear copy reduce but do not eliminate this risk.

Zero macros:

- All-zero products create misleading diary data. MVP should continue blocking all-zero KBJU.

Duplicates:

- Users may create foods that already exist under another spelling or brand. MVP needs duplicate warning, not silent blocking.

Moderation:

- Publishing to a shared catalog requires separate admin/review rules and must not be hidden inside this UX package.

User mistakes:

- Wrong units or per-serving data entered as per-100 g can distort diary totals. Copy should make the per-100 g basis obvious.

Privacy/user scope:

- User-created foods must remain private to the creating user unless explicitly submitted and approved later.

Future merge into canonical catalog:

- Merging private foods into a public canonical catalog requires a separate identity, alias, moderation, and historical-entry policy.

Multi-add handoff:

- Created food should not be lost when returning to search or closing a form during basket-building.

Partial diary writes:

- Creating a food and then failing to add it to diary can leave a valid private food without a diary entry. This is acceptable if the UI explains retry/add behavior clearly.

## 12. Recommended Next Implementation Package

Recommended next package:

- **MISSING_FOOD_FROM_CALORIZER_FLOW_IMPLEMENTATION_READY**

Suggested scope for that later package:

- add `Добавить продукт` CTA to search empty state;
- build or adapt a missing-food form using existing validation;
- create private user food only;
- hand the created food to existing single-add or multi-add flow;
- add focused tests for empty state, validation, private creation, single-add, multi-add, snapshot, duplicate warning, and regression of existing search;
- do not change SQL/RLS/config/dependencies;
- do not touch Premium write paths.

## Safety Confirmation

Confirmed for this package:

- report-only;
- no runtime code changes;
- no UI changes;
- no config/dependency changes;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no secrets/API keys/JWT collection;
- no service-role keys;
- no RLS policy changes;
- no Premium writes;
- no diary runtime writes during this planning step;
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

**MISSING_FOOD_FROM_CALORIZER_FLOW_PLAN_READY**
