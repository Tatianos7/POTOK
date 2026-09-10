# Food Diary Add Modal Unify Product Input Implementation Review

- Date: 2026-09-10
- Branch: `master`
- HEAD: `ceb88c1 food diary add modal unify product input plan`
- Reviewed implementation report: `reports/food-diary-add-modal-unify-product-input-implementation-2026-09-10.md`
- Target package: `FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_IMPLEMENTATION_REVIEW`
- Verdict: **FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_IMPLEMENTATION_REVIEW_READY**

## Scope

Review the `FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_IMPLEMENTATION` package before commit. The review checks the simplified `Добавить продукт` modal, unified `Ввод продукта` entry, optional brand field, private user food semantics, add-to-diary behavior, tests, and safety boundaries.

This is review-only. Runtime/UI code was not changed during this review, Supabase SQL was not executed, staging was not mutated, production was not touched, Open Food Facts integration was not added, API clients were not added, DB schema/RLS were not changed, Premium write paths were not touched, and no PR/commit was created.

## Executive Summary

No blocker was found for committing the implementation package.

The implementation matches the owner decision:

- the main modal no longer shows `Ввод марки продукта`;
- the main modal no longer shows `Ввод своего продукта`;
- the main modal now shows one unified `Ввод продукта` entry;
- the final modal order is `Найти продукт`, `Мои продукты`, `Ввод продукта`, `Анализатор рецепта`;
- `Ввод продукта` routes to the existing `/nutrition/create-custom-product` flow;
- `CreateCustomProductPage` now supports optional `Марка / бренд (необязательно)`;
- saved products still go through `foodService.createCustomFood`, which keeps `source='user'` and `created_by_user_id=current user`;
- old `/nutrition/create-brand-product` route and `CreateBrandProductPage` remain preserved.

The main non-blocker is test depth: focused modal tests cover the simplified modal and My Products behavior, but there is no submit-level test for `CreateCustomProductPage` proving optional brand is passed on save.

## Reviewed Files

- `src/components/AddProductModal.tsx`
- `src/pages/FoodDiary.tsx`
- `src/pages/CreateCustomProductPage.tsx`
- `src/components/__tests__/AddProductModal.test.tsx`
- `reports/food-diary-add-modal-unify-product-input-implementation-2026-09-10.md`

## Blocker Findings

No blockers.

## Non-Blocker Findings

### 1. Optional brand field lacks a focused submit-level test

Reference: `src/pages/CreateCustomProductPage.tsx`.

The code adds `brandName` state, renders `Марка / бренд (необязательно)`, trims the value, and passes `brand: brandName.trim() || null` into `foodService.createCustomFood`.

This is straightforward and consistent with existing service semantics, but the focused test suite currently does not submit the custom product form with and without brand.

Severity: non-blocker.

Recommended follow-up:

- add a focused page/component test that saves with an empty brand and expects `brand: null`;
- add a focused page/component test that saves with a filled brand and expects that value to reach `createCustomFood`.

### 2. Visual smoke was not completed in this review

The UI diff is small and automated tests/build pass, but this review did not complete interactive browser smoke. A prior visual smoke package documented that a controllable browser backend was unavailable in this environment.

Severity: non-blocker for code review; still recommended before production rollout.

## Modal Assessment

`src/components/AddProductModal.tsx` now builds four main actions:

1. `Найти продукт`
2. `Мои продукты`
3. `Ввод продукта`
4. `Анализатор рецепта`

Assessment:

- `Ввод марки продукта` is absent from the main modal.
- `Ввод своего продукта` is absent from the main modal.
- `Ввод продукта` is present.
- `Найти продукт` remains wired to the same external handler.
- `Мои продукты` still opens the existing in-modal My Products flow.
- `Анализатор рецепта` remains wired to the same external handler.
- My Products empty-state CTA now uses the same unified product input handler.

The old buttons were not renamed in place; they were replaced by a new visible modal entry as requested.

## Unified Product Input Assessment

`src/pages/FoodDiary.tsx` now passes `onProductInput` to `AddProductModal`.

Behavior:

- closes the add product modal;
- navigates to `/nutrition/create-custom-product`;
- preserves `selectedDate` in router state.

This matches the recommended safe MVP because the unified entry uses the existing custom product creation flow rather than adding a new route, search engine, or service layer.

## Optional Brand Assessment

`src/pages/CreateCustomProductPage.tsx` now renders:

- `Марка / бренд (необязательно)`;
- placeholder `Например: Домашний, Простоквашино`.

Save behavior:

- filled brand becomes `brand: brandName.trim()`;
- blank or whitespace brand becomes `brand: null`;
- save still calls `foodService.createCustomFood(user.id, data)`.

Service semantics:

- `createCustomFood` normalizes data;
- enforces `source: 'user'`;
- sets `created_by_user_id: userId`;
- delegates to `createUserFood`.

This keeps branded and non-branded user-created products private. It does not create verified catalog rows and does not write to Premium.

## Old Route Preservation Assessment

Old route/code preservation is intact:

- `/nutrition/create-brand-product` remains present in `src/App.tsx`;
- `CreateBrandProductPage` remains present;
- `foodService.createManualBrandedFood` remains present;
- old branded creation behavior is not aggressively deleted.

This is safe for possible direct route usage or later cleanup after a broader route/reference audit.

## Add-To-Diary Assessment

`CreateCustomProductPage` keeps the existing diary add behavior:

- nutrition validation remains unchanged;
- weight handling remains unchanged;
- meal category handling remains unchanged;
- optional favorite behavior remains unchanged;
- diary entry construction remains unchanged except that display name can now include brand metadata;
- save still calls `mealService.addMealEntry`;
- return navigation still goes back to `/nutrition` with the existing diary return state helper.

No add-to-diary behavior break was found in code review.

## Tests Assessment

Focused tests in `src/components/__tests__/AddProductModal.test.tsx` cover:

- old separate labels are absent from the main modal;
- new `Ввод продукта` label is present;
- modal order is correct;
- unified product input action handler is called;
- `Найти продукт` handler still works;
- `Мои продукты` handler still works;
- `Анализатор рецепта` handler still works;
- My Products empty/list/filtering and meal selector checks still pass.

Coverage gap:

- optional brand field on `CreateCustomProductPage` is not covered by a form submit test.

This is acceptable as a non-blocker for this small implementation, but should be added before deeper route cleanup or production smoke sign-off.

## Visual / UX Assessment

Static UI assessment:

- the main modal is visibly simpler: four buttons instead of five;
- the modal keeps the existing button style and layout;
- no broad redesign was introduced;
- optional brand appears as a normal compact field in the existing product creation form;
- fixed bottom save area was not changed.

Interactive browser visual smoke:

- not completed in this review;
- limitation is environment/browser-backend availability, not a known implementation defect.

## Safety Assessment

Safety boundary is preserved:

- runtime/UI changes are scoped to Food Diary add modal product input simplification;
- no unrelated UI redesign;
- no My Products behavior change;
- no search behavior change;
- no analyzer behavior change;
- no add-to-diary behavior change;
- no aggressive route/code deletion;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no Open Food Facts integration;
- no API clients;
- no API keys;
- no secrets;
- no DB schema changes;
- no RLS policy changes;
- no verified catalog auto-publish;
- no candidate queue creation;
- no Premium writes;
- no payment enforcement;
- no PR;
- no commit.

## Required Fixes

No required fixes before commit.

## Optional Improvements

- Add submit-level tests for `CreateCustomProductPage` with empty and filled optional brand.
- Run owner visual smoke in a browser environment.
- Later audit whether `/nutrition/create-brand-product` should remain, redirect to unified input, or be removed.
- Later update product docs/screenshots that still mention the two old modal entries.

## Verification

- `git diff --check`
  - Result: passed.
- `npx tsx --test src/components/__tests__/AddProductModal.test.tsx`
  - Result: passed, 6 tests.
- `npm run build`
  - Result: passed, with existing Vite/Browserslist/chunk-size warnings.

## Final Recommendation

Commit the implementation and this review report as the UI simplification package after verification passes.

Do not add `Не нашли продукт?` to search in this package. Do not apply SQL, write to Supabase, change RLS/schema, add Open Food Facts integration, create candidate queue behavior, or touch Premium write paths.

## Final Verdict

**FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_IMPLEMENTATION_REVIEW_READY**
