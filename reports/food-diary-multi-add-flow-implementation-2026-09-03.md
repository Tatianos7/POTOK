# Food Diary Multi-Add Flow Implementation

- Date: 2026-09-03
- Branch: `master`
- HEAD: `1f99d0c food diary multi add flow plan`
- Source plan: `reports/food-diary-multi-add-flow-plan-2026-09-03.md`
- Target package: `FOOD_DIARY_MULTI_ADD_FLOW_IMPLEMENTATION`
- Verdict: **FOOD_DIARY_MULTI_ADD_FLOW_IMPLEMENTATION_READY**

## Scope

Implement the Food Diary multi-add MVP inside the existing `/nutrition/search` flow.

Runtime/UI changes were limited to the nutrition diary add flow. No config/dependency files were changed, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no secrets/API keys/JWTs were collected, no service-role keys were used, no RLS policies were changed, no Premium writes were touched, no provider API clients were added, no AI/voice/payment work was added, and no PR was created.

## What Changed

Implemented a simplified plus-button multi-add flow on `/nutrition/search`, then moved the selected-products basket into a bottom cart sheet after owner screenshot review.

Changed runtime behavior:

- kept the existing single-add flow as the default path;
- added a `+` action beside search results and recent/favorite products;
- clicking a product card still opens the existing single-add modal;
- clicking `+` adds the product to the basket;
- replaced the previous mode toggle and heavy empty basket card with a compact hint;
- removed the expanded selected-products basket from the middle of the search screen;
- added a compact `Выбрано N` cart button inside the existing bottom action bar;
- added a cart bottom sheet for grams/unit editing, item removal, clearing, totals, and saving;
- added `Добавить ещё` inside the cart sheet so users can close the sheet and continue search without losing the basket;
- changed active search results to an overlay/dropdown under the search input;
- kept the search results/product lists as the primary screen content;
- selecting the same canonical food again does not create a duplicate row and highlights the existing row;
- each basket row supports editable display amount and display unit;
- each row shows weight and KBJU preview;
- the basket shows total calories, protein, fat, carbs, and selected count;
- rows can be removed;
- save is disabled when the basket is empty or any row is invalid;
- save loading blocks duplicate submits and row mutation;
- save errors keep the basket visible for retry;
- successful save returns to `/nutrition` with `selectedDate` and `mealType`;
- the returned meal is expanded in the diary.

## Files Changed

Runtime:

- `src/components/ProductCard.tsx`
- `src/components/ProductSearch.tsx`
- `src/components/FoodMultiAddCartButton.tsx`
- `src/components/FoodMultiAddCartSheet.tsx`
- `src/pages/FoodSearch.tsx`
- `src/pages/FoodDiary.tsx`
- `src/utils/diaryAddNavigation.ts`
- `src/utils/foodDiaryMultiAdd.ts`

Tests:

- `src/components/__tests__/ProductCardMultiAddAction.test.tsx`
- `src/components/__tests__/ProductSearchOverlay.test.tsx`
- `src/components/__tests__/FoodMultiAddCartButton.test.tsx`
- `src/components/__tests__/FoodMultiAddCartSheet.test.tsx`
- `src/utils/__tests__/foodDiaryMultiAdd.test.ts`
- `src/utils/__tests__/diaryAddNavigation.test.ts`

Report:

- `reports/food-diary-multi-add-flow-implementation-2026-09-03.md`

No package, dependency, SQL, RLS, Premium, payment, provider API, recipe import, or production files were changed for this package.

## UX Behavior

Default behavior remains single-add:

- user searches or taps a recent product;
- existing `AddFoodToMealModal` opens;
- user enters amount and saves one entry.

Multi-add behavior after owner screenshot review:

- user searches as usual;
- search results show a small `+` action;
- recent/favorite products also show a small `+` action;
- user clicks `+` to add products to the basket;
- selected products do not expand in the middle of the search screen;
- if the basket is empty, no bottom cart button is shown;
- if the basket has products, a compact `Выбрано N` button appears inside the bottom action bar;
- the bottom action bar keeps barcode, selected-count cart, and voice controls in one row;
- compact calories are shown as secondary cart-button text on wider screens only;
- if a product is already selected, the action shows an added/check state;
- active search results open as a dropdown over the screen content instead of pushing layout down;
- clicking `+` closes the overlay and updates the bottom cart count;
- clicking outside the search overlay or selecting a product through single-add closes the overlay;
- user opens the cart sheet from the bottom cart button;
- user can tap `Добавить ещё` in the cart sheet to close it and continue search while selected products remain in the basket;
- user edits amount/unit per product inside the sheet;
- invalid rows show inline copy;
- total KBJU updates as rows change;
- user taps `Сохранить`;
- all entries are saved, then the app returns to the diary.

## Validation Behavior

Validation is handled before save:

- empty quantity is invalid;
- zero quantity is invalid;
- negative quantity is invalid;
- non-finite quantity is invalid;
- converted `weight_g` must be greater than zero;
- canonical food identity must be resolvable;
- any invalid row blocks the whole basket save.

Duplicate behavior:

- the basket key prefers canonical food id;
- repeated selection of the same canonical food focuses/highlights the existing row;
- duplicate rows are not created in MVP.

## Save Behavior

The batch save uses the existing diary creation path:

- basket drafts are converted into `MealEntry` objects only after all-prevalidation;
- entries are saved sequentially through `mealService.addMealEntry`;
- `mealService.addMealEntry` continues to enforce canonical diary creation through the existing service layer;
- navigation success is returned only after all save calls resolve;
- if a save call rejects, no success navigation is returned and the basket remains visible.

Known save limitation:

- the MVP does not add transaction/rollback semantics. If a later sequential save fails after an earlier entry persisted, the UI does not claim package success, but true atomicity would require a separate backend/SQL/RPC design and was intentionally not added here.

## What Stayed Unchanged

Preserved:

- existing single-add flow;
- existing product card click behavior for single-add;
- existing `AddFoodToMealModal` behavior;
- existing canonical diary snapshot principle;
- existing `mealService.addMealEntry` write path;
- historical diary entries;
- manual custom food creation flow;
- barcode one-product behavior outside multi-add basket selection;
- recipe analyzer flow;
- Premium read-only/write boundaries;
- payment and entitlement behavior;
- provider API/runtime behavior.

## UX Simplification After Owner Screenshot Review

Owner screenshot review found the first MVP visually too heavy:

- the separate `Добавление нескольких продуктов` block added too much instruction text;
- the mode toggle made the flow feel more complex than normal search;
- the empty basket appeared as a large card before the user selected anything.

Simplification applied:

- removed the separate multi-add mode toggle;
- removed the large empty basket card;
- kept search as the main interaction;
- added clear `+` buttons beside products;
- kept an already-selected check/disabled state beside products;
- moved selected rows out of the search screen and into a bottom sheet.

## UX Overlay Search Results After Owner Feedback

Owner follow-up requested that search results should not move the basket.

Overlay behavior now:

- search remains at the top of `/nutrition/search`;
- empty search query does not render the overlay;
- active search query renders results as an absolute dropdown directly under the search input;
- the overlay uses a higher z-index and can temporarily cover the basket;
- the basket keeps its position under the search area;
- the overlay is height-limited and scrolls internally for longer result lists;
- results keep the `+` action on the right;
- product-card click still opens the existing single-add modal;
- `+` adds to the multi-add basket and closes the search query/overlay;
- duplicate `+` clicks do not create duplicate rows and use the added/check state.

## UX Bottom Cart Redesign After Owner Screenshot Review

Owner follow-up requested that selected products should not occupy the middle of the search screen.

Bottom cart behavior now:

- empty basket renders no bottom cart button;
- non-empty basket renders a fixed `Корзина · N` button above the existing bottom barcode/voice bar;
- the bottom button includes compact total calories;
- scroll content receives extra bottom padding while the button is visible;
- tapping the bottom button opens `Корзина приёма пищи`;
- the cart sheet contains selected rows, grams input, unit selector, row KBJU, remove action, totals, `Очистить`, and `Сохранить`;
- removing the last product closes the sheet and hides the bottom cart button;
- clearing the basket closes the sheet and hides the button;
- invalid row values keep save disabled;
- save errors keep the sheet open and editable.

## UX Bottom Bar Cart Polish After Owner Feedback

Owner follow-up found that the previous bottom cart button still felt too independent and visually heavy.

Polish applied:

- replaced the standalone large floating cart button with a compact inline button inside the bottom action bar;
- changed the button label from `Корзина · N` to `Выбрано N`;
- kept the button hidden while the basket is empty;
- kept barcode and voice controls visible in the same bottom bar so the cart does not cover them;
- kept compact kcal as secondary text only on wider screens to avoid crowding narrow mobile viewports;
- kept search/product list bottom padding so lower products are not hidden behind the fixed bottom bar;
- added `Добавить ещё` inside `Корзина приёма пищи`;
- `Добавить ещё` closes the sheet and preserves selected products, allowing the user to continue searching and adding more items;
- clearing/removing all products still hides the cart button;
- `Сохранить` remains the primary action inside the sheet, while `Добавить ещё` and `Очистить` remain secondary actions.

## Tests And Results

Passed:

- `npx tsx --test src/components/__tests__/ProductCardMultiAddAction.test.tsx`
  - Result: passed, `2` tests.
- `npx tsx --test src/components/__tests__/ProductSearchOverlay.test.tsx`
  - Result: passed, `1` test.
- `npx tsx --test src/components/__tests__/FoodMultiAddCartButton.test.tsx`
  - Result: passed, `2` tests.
- `npx tsx --test src/components/__tests__/FoodMultiAddCartSheet.test.tsx`
  - Result: passed, `3` tests.
- `npx tsx --test src/utils/__tests__/foodDiaryMultiAdd.test.ts`
  - Result: passed, `7` tests.
- `npx tsx --test src/utils/__tests__/diaryAddNavigation.test.ts`
  - Result: passed, `5` tests.
- `npx tsx --test src/services/__tests__/diaryCreateService.test.ts`
  - Result: passed, `12` tests.
- `npx tsx --test src/services/__tests__/mealService.diary-enforcement.test.ts`
  - Result: passed, `10` tests.
- `npx tsx --test src/components/__tests__/MealEntryUnitPresetsUI.test.tsx`
  - Result: passed, `1` test.
- `npx tsx --test src/pages/__tests__/FoodDiaryProgressEntry.test.ts`
  - Result: passed, `2` tests.
- `npm run build`
  - Result: passed.
- `git diff --check`
  - Result: passed.

Observed out-of-scope existing test failure:

- `npx tsx --test src/services/__tests__/foodService.search-mapping.test.ts`
  - Result: failed, `24` passed / `1` failed.
  - Failing case: `UI search path keeps production salt row visible when Supabase row has no aliases`.
  - Observed mismatch: current ranking returned `garlic_salt` before `salt`.
  - Scope note: this package did not change `src/services/foodService.ts` or search ranking logic. The failure is recorded as an unrelated/out-of-scope food search ranking issue, not a confirmed multi-add regression.

Known non-failing warnings:

- local Supabase env warning in fallback-safe tests;
- Vite/Browserslist/baseline data age warnings;
- existing chunk-size and dynamic/static import warnings during build.

## Known Limitations

- no browser visual smoke was performed in this step;
- no transaction-level batch insert was added;
- no group undo was added;
- no partial save product flow was designed;
- true duplicate rows for the same canonical food remain out of scope;
- very large baskets are not specially capped in this MVP;
- existing recent-food storage remains localStorage-based;
- one out-of-scope food search ranking test is still failing separately.

## Safety Confirmation

Confirmed for this package:

- no config/dependency changes;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no secrets/API keys/JWT collection;
- no service-role keys;
- no RLS policy changes;
- no Premium writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR.

## Final Verdict

**FOOD_DIARY_MULTI_ADD_FLOW_IMPLEMENTATION_READY**
