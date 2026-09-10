# Food Diary Add Modal Unify Product Input Implementation

- Date: 2026-09-10
- Branch: `master`
- HEAD: `ceb88c1 food diary add modal unify product input plan`
- Source plan: `reports/food-diary-add-modal-unify-product-input-plan-2026-09-10.md`
- Target package: `FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_IMPLEMENTATION`
- Verdict: **FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_IMPLEMENTATION_READY**

## Scope

Implement the UI/runtime simplification for the main Food Diary `Добавить продукт` modal: replace the two separate entries `Ввод марки продукта` and `Ввод своего продукта` with one entry, `Ввод продукта`.

Runtime/UI changes were limited to the Food Diary add modal product input simplification and the existing custom product creation page. Supabase SQL was not executed, staging was not mutated, production was not touched, Open Food Facts integration was not added, API clients were not added, DB schema/RLS were not changed, Premium write paths were not touched, and no PR/commit was created.

## What Changed

- The main `Добавить продукт` modal now shows one product input entry: `Ввод продукта`.
- The separate visible modal entries `Ввод марки продукта` and `Ввод своего продукта` were removed from the main modal action list.
- `Ввод продукта` routes to the existing `/nutrition/create-custom-product` flow.
- The existing custom product creation page now includes a compact optional `Марка / бренд (необязательно)` field.
- When the optional brand field is filled, it is passed to `foodService.createCustomFood`.
- When the optional brand field is empty, the product is saved with `brand: null`.
- Old `/nutrition/create-brand-product` route and `CreateBrandProductPage` code were preserved.

## Files Changed

- `src/components/AddProductModal.tsx`
- `src/pages/FoodDiary.tsx`
- `src/pages/CreateCustomProductPage.tsx`
- `src/components/__tests__/AddProductModal.test.tsx`
- `reports/food-diary-add-modal-unify-product-input-implementation-2026-09-10.md`

## Final Modal Order

1. `Найти продукт`
2. `Мои продукты`
3. `Ввод продукта`
4. `Анализатор рецепта`

Unchanged surrounding behavior:

- `Найти продукт` still uses the existing food search navigation.
- `Мои продукты` still opens the private user foods list flow.
- `Анализатор рецепта` still opens the existing recipe analyzer route.
- My Products meal selector, filtering, and add-to-diary flow were not changed.

## Product Input Route

`Ввод продукта` routes to:

- `/nutrition/create-custom-product`

Navigation still passes:

- `selectedDate` in router state.

The page uses the existing save path:

- `foodService.createCustomFood(user.id, data)`;
- `mealService.addMealEntry(user.id, selectedDate, category, entry)`;
- return navigation to `/nutrition` with the existing diary return state helper.

## Optional Brand Handling

The unified product flow now has:

- label: `Марка / бренд (необязательно)`;
- placeholder: `Например: Домашний, Простоквашино`.

Data behavior:

- filled brand is saved as product `brand` metadata;
- empty brand is saved as `null`;
- both cases remain private user foods;
- both cases use `source='user'`;
- both cases keep `created_by_user_id=current user`;
- neither case creates a verified catalog row;
- neither case enters Premium plans automatically.

## Preserved Old Routes / Code

The implementation did not delete:

- `/nutrition/create-brand-product`;
- `src/pages/CreateBrandProductPage.tsx`;
- `foodService.createManualBrandedFood`.

These remain available for any existing direct route usage or future cleanup after a broader route/reference audit.

## Tests / Checks Result

- `git diff --check`
  - Result: passed.
- `npx tsx --test src/components/__tests__/AddProductModal.test.tsx`
  - Result: passed, 6 tests.
- `npm run build`
  - Result: passed, with existing Vite/Browserslist/chunk-size warnings.

## Known Limitations

- No browser visual smoke was completed in this package.
- The old brand product route is preserved and may still be reachable directly.
- Focused tests cover modal labels/order/handlers and My Products behavior, but do not submit the full custom product page form.
- A future route cleanup can decide whether `/nutrition/create-brand-product` should stay, redirect, or be removed.

## Final Recommendation

Proceed to owner visual smoke for the simplified modal:

- confirm the modal feels less crowded;
- confirm `Ввод продукта` is understandable;
- confirm optional brand is discoverable but not noisy;
- confirm search, My Products, analyzer, and diary add flows still behave as expected.

Do not add a `Не нашли продукт?` CTA to search until this main modal simplification is approved.

## Safety Confirmation

Confirmed for this package:

- runtime/UI changes only for Food Diary add modal product input simplification;
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

## Final Verdict

**FOOD_DIARY_ADD_MODAL_UNIFY_PRODUCT_INPUT_IMPLEMENTATION_READY**
