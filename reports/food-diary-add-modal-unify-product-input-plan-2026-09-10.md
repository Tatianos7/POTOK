# Food Diary Add Modal Unify Product Input Plan

- Date: 2026-09-10
- Branch: `master`
- HEAD: `11bcbe2 my products flow visual smoke browser blocker`
- Source plan: `reports/my-products-entry-from-food-diary-add-modal-mvp-plan-2026-09-07.md`
- Target package: `FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_PLAN`
- Verdict: **FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_PLAN_READY**

## Scope

Plan the implementation package for simplifying the main Food Diary `Добавить продукт` modal in POTOK. The owner decision is to merge `Ввод марки продукта` and `Ввод своего продукта` into one clearer entry: `Ввод продукта`.

This is plan/report-only. Runtime code was not changed, UI was not changed, Supabase SQL was not executed, staging was not mutated, production was not touched, Open Food Facts integration was not added, API clients were not added, Premium write paths were not touched, and no PR/commit was created.

## 1. Product Goal

The goal is to reduce choice overload in the main diary add modal while preserving the working product creation behavior.

Product goals:

- reduce the number of buttons in the modal;
- remove confusion between `Ввод марки продукта` and `Ввод своего продукта`;
- keep one understandable product creation entry: `Ввод продукта`;
- avoid breaking existing brand/custom product creation;
- preserve simple UX and the current diary add path;
- keep `Найти продукт`, `Мои продукты`, and `Анализатор рецепта` distinct.

## 2. Current Behavior Audit

Current modal actions are rendered by `src/components/AddProductModal.tsx`.

Current order:

1. `Найти продукт`
2. `Мои продукты`
3. `Ввод марки продукта`
4. `Ввод своего продукта`
5. `Анализатор рецепта`

`Найти продукт`:

- handler is passed from `src/pages/FoodDiary.tsx`;
- closes the modal;
- navigates to `/nutrition/search` with `selectedDate` in router state;
- uses the existing normal food search route.

`Мои продукты`:

- opens the real My Products view inside `AddProductModal`;
- loads foods through `foodService.getUserFoods(user.id)`;
- filters to `source === 'user'` and `created_by_user_id === current user` through `filterVisibleUserFoods`;
- uses existing add-to-diary behavior by selecting meal type, selecting a food, opening `AddFoodToMealModal`, and saving through the existing Food Diary add handler.

`Ввод марки продукта`:

- handler is passed from `src/pages/FoodDiary.tsx`;
- closes the modal;
- navigates to `/nutrition/create-brand-product` with `selectedDate` in router state;
- route renders `src/pages/CreateBrandProductPage.tsx`;
- page collects `Название марки`, `Название продукта`, nutrition per 100 g/ml/portion, weight, meal category, and optional favorite flag;
- save path calls `foodService.createManualBrandedFood(user.id, data)`;
- `createManualBrandedFood` delegates to `createCustomFood`, so the saved row remains a private user-owned food with `source='user'` and `created_by_user_id=current user`;
- the `brand` field is stored as an attribute and must not be interpreted as shared `source='brand'` catalog promotion;
- after creating the food, the page can add it to favorites if requested, creates a diary `MealEntry`, saves through `mealService.addMealEntry`, and navigates back to `/nutrition`.

`Ввод своего продукта`:

- handler is passed from `src/pages/FoodDiary.tsx`;
- closes the modal;
- navigates to `/nutrition/create-custom-product` with `selectedDate` in router state;
- route renders `src/pages/CreateCustomProductPage.tsx`;
- page collects `Название продукта`, nutrition per 100 g/ml/portion, weight, meal category, and optional favorite flag;
- save path calls `foodService.createCustomFood(user.id, data)` with `brand: null`;
- saved row is a private user-owned food with `source='user'` and `created_by_user_id=current user`;
- after creating the food, the page can add it to favorites if requested, creates a diary `MealEntry`, saves through `mealService.addMealEntry`, and navigates back to `/nutrition`.

Current data differences:

- branded flow accepts and stores an optional `brand` value;
- custom flow explicitly stores `brand: null`;
- both flows store private `source='user'` foods owned by the current user;
- neither flow creates verified catalog rows;
- neither flow should publish to Premium plans automatically.

Current UI differences:

- branded flow header is `ДОБАВИТЬ ПРОДУКТ` and includes `Название марки`;
- custom flow header is `ДОБАВИТЬ СВОЙ ПРОДУКТ` and omits brand;
- both flows contain similar nutrition, weight, meal category, favorite, and save sections.

Current test coverage:

- `src/components/__tests__/AddProductModal.test.tsx` currently asserts the five-button modal order;
- it verifies `Найти продукт`, `Мои продукты`, `Ввод марки продукта`, `Ввод своего продукта`, and `Анализатор рецепта` labels and handlers;
- it verifies My Products empty/list/filtering and meal selector markup;
- there is no focused test yet for a unified `Ввод продукта` entry;
- future implementation must update modal tests intentionally because old separate labels should no longer appear in the main modal.

## 3. Recommended Target UX

Target modal order:

1. `Найти продукт`
2. `Мои продукты`
3. `Ввод продукта`
4. `Анализатор рецепта`

`Ввод продукта` should open one product creation flow.

Recommended fields inside the unified flow:

- product name;
- brand/mark as optional;
- calories per 100 g;
- protein per 100 g;
- fat per 100 g;
- carbs per 100 g;
- fiber as optional if the current flow already supports it;
- barcode as optional if the current flow already supports it;
- weight/add-to-diary only if the current flow already supports it.

Do not add a `Не нашли продукт?` CTA in search in this package. First simplify the main modal.

## 4. Data Interpretation

If brand/mark is filled:

- the product is interpreted as a user-created branded/private product;
- `brand` is stored as product metadata;
- it still remains `source='user'`.

If brand/mark is not filled:

- the product is interpreted as a normal private user product;
- `brand` is stored as `null`.

For both cases:

- `source='user'`;
- `created_by_user_id=current user`;
- the product appears in `Мои продукты`;
- the product does not become verified catalog;
- the product does not enter Premium plans;
- the product does not become shared/public automatically;
- candidate queue or owner/admin review remains a later phase.

## 5. Safe Implementation Options

### Option A: One Button To Existing Custom Product Flow

One `Ввод продукта` button opens the safest existing custom product flow, and that flow gains an optional brand field.

Recommended if:

- the custom product route is the simpler and safer base;
- adding optional `brand` can reuse existing `foodService.createCustomFood`;
- diary add, favorite, validation, and return navigation can remain unchanged.

Why this is the preferred MVP:

- one visible entry for users;
- minimal modal/navigation change;
- no schema/RLS changes;
- no need to delete old branded route immediately;
- branded/private behavior is preserved by storing optional `brand` while keeping `source='user'`.

### Option B: One Button Opens A Mini-Choice

One `Ввод продукта` button opens an internal choice:

- `С маркой`
- `Без марки`

Not recommended for MVP because it mostly moves the same confusion one level deeper instead of removing it.

### Option C: Fully Merge Routes And Services

Fully merge `CreateBrandProductPage` and `CreateCustomProductPage` into one route/component/service flow.

Use only if audit confirms it is safe, because this has a larger blast radius:

- route assumptions may differ;
- existing navigation may still use old routes;
- tests and analytics/tracking may rely on old route names or labels;
- deleting code too early can break deep links or other entry points.

## 6. Recommended MVP

Recommended MVP:

- replace the two main modal entries `Ввод марки продукта` and `Ввод своего продукта` with one entry `Ввод продукта`;
- route `Ввод продукта` to the safest existing product creation page;
- make brand/mark optional in that unified creation UI;
- preserve `source='user'` and `created_by_user_id=current user`;
- keep existing old routes/handlers in code if they are still referenced elsewhere, but stop showing both old buttons in the main modal;
- avoid aggressive deletion in the first implementation package;
- do not make SQL, DB schema, RLS, Premium, or Open Food Facts changes.

Recommended target order:

1. `Найти продукт`
2. `Мои продукты`
3. `Ввод продукта`
4. `Анализатор рецепта`

## 7. Tests Later

Future focused tests should cover:

- main add modal no longer shows `Ввод марки продукта`;
- main add modal no longer shows `Ввод своего продукта`;
- main add modal shows `Ввод продукта`;
- modal order is `Найти продукт`, `Мои продукты`, `Ввод продукта`, `Анализатор рецепта`;
- `Найти продукт` still opens existing food search;
- `Мои продукты` still opens the private list flow;
- `Анализатор рецепта` still opens the existing recipe analyzer flow;
- `Ввод продукта` opens the selected product creation flow;
- product can be saved without brand;
- product can be saved with brand;
- saved product appears in `Мои продукты`;
- saved product remains `source='user'`;
- saved product keeps `created_by_user_id=current user`;
- old add-to-diary behavior is not broken;
- no verified catalog auto-publish happens;
- private products do not enter Premium plans.

## 8. Risks

Risks:

- existing brand product flow may have assumptions that differ from the custom flow;
- analytics, tracking, screenshots, or docs may rely on old button labels;
- existing tests currently assert old separate labels and must be updated deliberately;
- old routes may still be used outside the main modal;
- hiding old buttons should not remove working route/component code until all entry points are audited;
- users may expect brand input to remain discoverable, so the optional brand field needs clear but compact labeling.

Mitigations:

- implement as a small UI simplification package after this plan;
- first update only the main modal entry and the safest product creation UI;
- preserve old route handlers internally until they are confirmed unused;
- keep My Products, search, analyzer, and diary add behavior unchanged;
- add focused tests for old-label removal and new unified entry.

## 9. Recommendation

Proceed with a separate UI simplification implementation package after this plan.

Recommended implementation direction:

- do not delete old flows aggressively;
- replace/hide the two old product input entries only in the main modal;
- add one `Ввод продукта` entry;
- route it to the safest existing custom product creation flow;
- make brand optional so the same flow supports both branded and non-branded private foods;
- keep data semantics private: `source='user'`, `created_by_user_id=current user`;
- defer internal route/service consolidation until after smoke and owner review.

Do not apply SQL, change Supabase schema/RLS, add Open Food Facts integration, touch Premium write paths, or change production/staging in this package.

## Safety Confirmation

Confirmed for this package:

- plan/report-only;
- no runtime code changes;
- no UI changes;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no Open Food Facts integration;
- no API clients;
- no API keys;
- no secrets;
- no DB writes;
- no DB schema changes;
- no RLS policy changes;
- no Premium writes;
- no payment enforcement;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_PLAN_READY**
