# Food Diary Multi-Add Flow Plan

- Date: 2026-09-03
- Branch: `master`
- HEAD: `2f1f2ea today premium product readiness map with owner ideas`
- Source readiness map: `reports/today-premium-product-readiness-map-with-owner-ideas-2026-09-02.md`
- Target package: `FOOD_DIARY_MULTI_ADD_FLOW_PLAN`
- Verdict: **FOOD_DIARY_MULTI_ADD_FLOW_PLAN_READY**

## Scope

Plan a future nutrition diary improvement: a multi-add flow where the user selects several foods, enters a weight for each item, previews KBJU, and saves the set with one action.

This is report-only planning. No runtime code was changed, no UI was changed, no config/dependency files were changed, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no secrets/API keys/JWTs were collected, no service-role keys were used, no Premium writes were enabled, no diary runtime writes were executed during this planning step, and no PR was created.

## Source Reviewed

- `reports/today-premium-product-readiness-map-with-owner-ideas-2026-09-02.md`
- `src/pages/FoodDiary.tsx`
- `src/pages/FoodSearch.tsx`
- `src/components/ProductSearch.tsx`
- `src/components/AddFoodToMealModal.tsx`
- `src/services/mealService.ts`
- `src/services/diaryCreateService.ts`
- `src/services/foodService.ts`
- `src/utils/diaryAddNavigation.ts`
- `src/utils/manualFoodFlow.ts`
- `src/utils/foodDiaryNavigation.ts`
- `src/types/index.ts`
- `src/utils/__tests__/diaryAddNavigation.test.ts`
- `src/services/__tests__/diaryCreateService.test.ts`
- `src/services/__tests__/mealService.diary-enforcement.test.ts`
- `src/components/__tests__/MealEntryUnitPresetsUI.test.tsx`

## 1. Current Flow

How product add works now:

- User opens `/nutrition`.
- `FoodDiary.tsx` renders the day, meal blocks, water, totals, and bottom actions.
- Tapping a meal runs `handleMealClick`, sets the meal type, and navigates to `/nutrition/search` with `{ mealType, selectedDate }`.
- `FoodSearch.tsx` renders search/favorites for one selected meal type.
- `ProductSearch.tsx` performs controlled search and calls `onSelect(food)` when a result is selected.
- `FoodSearch.tsx` hydrates the selected food through `foodService.hydrateFoodForDiarySelection`.
- If the food has suspicious zero KBJU, the flow blocks it with a user alert.
- The selected food opens `AddFoodToMealModal`.
- `AddFoodToMealModal` lets the user enter quantity/unit, shows calculated KBJU preview, and emits a single `MealEntry`.
- `FoodSearch.tsx` resolves/normalizes canonical food identity and calls `saveDiaryEntryForReturnToDiary`.
- `saveDiaryEntryForReturnToDiary` calls `mealService.addMealEntry`, waits for persistence, then returns navigation state back to `/nutrition`.
- `mealService.addMealEntry` enforces canonical diary creation through `DiaryCreateService` for canonical food entries.
- `DiaryCreateService` validates user scope, date, meal type, resolved canonical food, visible food, and `weight_g > 0`.
- `DiaryCreateService` builds the stored diary snapshot from canonical food values and weight, so client-provided nutrition is not trusted as source of truth.

Other current paths:

- `FoodDiary.tsx` still has an inline `ProductSearch` modal path and an `AddFoodToMealModal` path, though the main meal click path navigates to `/nutrition/search`.
- Barcode/camera flows add one food at a time.
- Recipe analyzer can create multiple `MealEntry` objects and save them with `Promise.all`, but that is a separate recipe-result flow and not the normal manual food search flow.
- Recent foods are stored in localStorage with `foodId`, `foodName`, `weight`, and `lastUsedAt`.

Why one-by-one is inconvenient:

- The user must search, open weight modal, enter amount, save, return, and repeat for every product.
- Multi-item meals such as breakfast bowls, salads, and cooked meals require too many navigation cycles.
- The user cannot see the whole meal composition before saving.
- Mobile friction is high because each item requires a modal and return.
- Editing a meal from memory is harder than selecting all products first and then entering weights in one pass.

Files/components involved today:

- `/nutrition` route: `src/pages/FoodDiary.tsx`
- `/nutrition/search` route: `src/pages/FoodSearch.tsx`
- search UI: `src/components/ProductSearch.tsx`
- weight/KBJU modal: `src/components/AddFoodToMealModal.tsx`
- diary save orchestration: `src/utils/diaryAddNavigation.ts`
- date return state: `src/utils/manualFoodFlow.ts`, `src/utils/foodDiaryNavigation.ts`
- food search/hydration: `src/services/foodService.ts`
- diary write service: `src/services/mealService.ts`
- canonical snapshot validation: `src/services/diaryCreateService.ts`
- data contracts: `src/types/index.ts`
- existing tests: `src/utils/__tests__/diaryAddNavigation.test.ts`, `src/services/__tests__/diaryCreateService.test.ts`, `src/services/__tests__/mealService.diary-enforcement.test.ts`, `src/components/__tests__/MealEntryUnitPresetsUI.test.tsx`

## 2. Proposed Multi-Add Flow

Recommended UX:

1. User opens food add for a selected meal.
2. User searches products from the same `/nutrition/search` context.
3. User taps multiple products to add them to a selection list/basket.
4. Selected products remain visible as a compact basket.
5. User moves to a weight step/section.
6. For every selected product, user enters `weight_g` or display amount/unit.
7. Each item shows its own KBJU preview.
8. The screen also shows total calories, protein, fat, carbs, and optionally total weight.
9. User taps `Сохранить`.
10. All valid entries are added to the selected meal with one explicit action.
11. App returns to `/nutrition` with the original `selectedDate` and expanded meal.

Important UX principle:

- selection and weighing should feel like building one meal, while storage can still create individual diary entries.

## 3. UX States

Empty selection:

- Show search and a quiet basket hint such as "Выберите продукты для приёма пищи".
- Save is disabled.
- Back returns to diary/search entry point without changes.

Selected products list:

- Show each selected item with display name, source badge if already used locally, default amount, and KBJU preview.
- Show total KBJU for the basket.
- Keep search available so the user can add more items without leaving the flow.

Remove selected product:

- Each selected row should have a remove action.
- Removing the last product returns to empty selection state.
- Removing an invalid product should clear the related validation error.

Duplicate selected product:

- Recommended default: selecting the same canonical food again focuses/highlights the existing row instead of adding a duplicate row.
- Alternative later: allow duplicates only through an explicit "add as separate row" action for real-world cases such as cooked/raw variants or split portions.
- Deduplication should use canonical food ID when available and fall back to stable food/search key only when needed.

Invalid weight:

- Weight must be greater than zero after unit conversion.
- Empty, zero, negative, and non-finite values should mark that row invalid.
- The invalid row should show a clear inline message.
- Save remains disabled until all rows are valid.

Partial invalid state:

- If one row is invalid, the whole package should be blocked by default.
- Do not save only valid rows unless a later product decision explicitly designs partial save.
- Show which rows need attention.

Save loading:

- Disable save and row controls that could change payload while saving.
- Keep a lightweight saving state, not a blocking full-screen state.
- Avoid duplicate submits.

Save success:

- Return to `/nutrition` for the selected date.
- Expand the target meal if feasible.
- Update recent foods with the saved weight for each product.
- Show success state only if the current design system has a lightweight toast/status pattern; otherwise returning with updated meal is enough.

Save error:

- Keep the basket visible.
- Show a product-facing error.
- Do not claim that entries were saved if any save failed.
- If any entries were already persisted before failure, the app needs an explicit product decision for rollback/retry/reconcile. For MVP, avoid optimistic success before the full batch completes.

Cancel/back behavior:

- Back from search with empty basket returns to previous screen.
- Back with non-empty basket should ask for confirmation or keep state while returning within the multi-add flow.
- Cancel discards unsaved basket.
- Existing single-add cancel behavior should remain unchanged.

## 4. Data / Write-Path Constraints

Must preserve:

- Do not break existing single-add flow.
- Keep current canonical diary creation path.
- Use the existing diary snapshot principle: persisted KBJU should be computed from canonical food and weight, not trusted from client preview.
- Validate every entry separately.
- If one entry is invalid, do not partially save the package without an explicit later product decision.
- Do not change historical entries.
- Do not create new foods automatically from this flow.
- Do not touch Premium write paths.
- Do not mix this with Premium selections, Premium shopping, recipe import, AI, voice, payment, RLS, SQL, staging, or production work.

Write-path planning notes for later implementation:

- The first implementation can call existing `mealService.addMealEntry` sequentially per validated item.
- A batch helper may be introduced later as an application-level orchestration wrapper, not a DB schema change.
- Avoid `Promise.all` as the default for MVP if it makes partial failure harder to explain or reconcile.
- Prefer all-prevalidation before save:
  - user present;
  - meal type present;
  - selected date valid;
  - canonical food ID resolved;
  - food visible;
  - converted weight greater than zero;
  - display unit and amount valid.
- If later code needs stronger atomicity, it should be a separate backend/SQL/RPC design with owner approval, not part of this first UX plan.

## 5. Implementation Options

Option A: minimal UI extension inside current add-food flow.

Shape:

- Extend `/nutrition/search` to support a multi-select basket.
- Keep `ProductSearch` as the search result component.
- Add selected basket state in `FoodSearch.tsx`.
- Reuse nutrition calculation logic from `AddFoodToMealModal` or extract small pure helpers later.
- Save basket by looping through existing `mealService.addMealEntry` after prevalidation.
- Preserve the current single-add modal path as the default quick action or an explicit "add one" path.

Pros:

- smallest route surface;
- preserves existing navigation model;
- lower implementation risk;
- easier to keep single-add working;
- no SQL changes required for MVP;
- no Premium dependency.

Cons:

- `FoodSearch.tsx` may become more complex;
- mobile layout needs careful basket/keyboard handling;
- shared quantity/preview logic may need extraction to avoid duplication.

Risk:

- medium, mostly UI state and validation complexity.

Recommendation:

- recommended MVP path.

Option B: separate multi-add screen/modal.

Shape:

- Add a dedicated multi-add screen or modal for selecting products and entering weights.
- Keep existing `/nutrition/search` as one-by-one flow.
- Route or modal can be opened from meal block as "Добавить несколько".
- Save uses existing diary entry creation service per item.

Pros:

- cleaner separation from current single-add flow;
- easier to design a focused two-step UX;
- less risk of disturbing current search behavior.

Cons:

- more new UI surface;
- more navigation/back-state complexity;
- more tests required;
- potential duplication of search and weight UI;
- may feel heavier for quick meals.

Risk:

- medium-high because it creates a larger new flow.

Recommendation:

- consider later if Option A becomes too cramped or if owner wants a clearly separate "meal builder" experience.

## 6. Recommended MVP

Recommended MVP:

- preserve existing single-add flow;
- add a multi-select basket to the current `/nutrition/search` flow;
- let the user select multiple foods;
- let the user enter/edit weight for each selected product in one basket/weight section;
- show per-row and total KBJU preview;
- validate all rows before save;
- batch save through existing `mealService.addMealEntry` logic;
- avoid SQL changes in the first implementation if possible;
- avoid partial save unless explicitly designed later;
- return to `/nutrition` with the selected date after successful full save.

Important implementation stance:

- MVP should be a UX/application orchestration layer over the existing canonical diary write path, not a new persistence model.

## 7. Files Likely To Change Later

Likely runtime files:

- `src/pages/FoodSearch.tsx`
- `src/pages/FoodDiary.tsx`
- `src/components/ProductSearch.tsx`
- `src/components/AddFoodToMealModal.tsx`
- possible new component: `src/components/FoodMultiAddBasket.tsx`
- possible new component: `src/components/FoodMultiAddWeightList.tsx`
- possible new utility: `src/utils/foodDiaryMultiAdd.ts`
- possible utility extraction from `AddFoodToMealModal` for nutrient preview
- `src/utils/diaryAddNavigation.ts`
- `src/services/mealService.ts` only if a small orchestration helper is needed
- `src/types/index.ts` only if a basket draft type is promoted beyond component-local type

Likely tests:

- `src/pages/__tests__/FoodDiaryProgressEntry.test.ts`
- new or updated `src/pages/__tests__/FoodSearchMultiAdd.test.tsx`
- new or updated `src/components/__tests__/MealEntryUnitPresetsUI.test.tsx`
- new `src/utils/__tests__/foodDiaryMultiAdd.test.ts`
- updated `src/utils/__tests__/diaryAddNavigation.test.ts`
- existing `src/services/__tests__/diaryCreateService.test.ts`
- existing `src/services/__tests__/mealService.diary-enforcement.test.ts`

Files that should not change for the first plan/implementation unless separately approved:

- package/dependency files;
- Supabase SQL/migrations;
- RLS policies;
- Premium Today files;
- payment/entitlement files;
- provider API clients.

## 8. Test Plan For Later Implementation

Later implementation should test:

- selecting multiple products from search;
- selecting multiple products from recent/favorites if included in scope;
- entering weights for each selected product;
- unit/display amount conversion per row;
- per-row KBJU preview;
- total KBJU preview;
- invalid empty/zero/negative weights block save;
- partial invalid basket blocks save;
- removing a selected product updates totals;
- selecting a duplicate product focuses or updates the existing row according to chosen policy;
- save creates multiple entries through existing diary creation logic;
- save waits for all entries before returning success;
- no partial save is reported as success unless explicitly designed;
- failed save keeps basket available for retry;
- existing single-add still works;
- barcode/manual custom product/recipe analyzer paths are not regressed if out of scope;
- selected date and meal type are preserved;
- mobile layout does not overflow and bottom actions do not hide rows.

Service/contract tests should keep proving:

- canonical food ID is required;
- `weight_g > 0` is required;
- client nutrition preview is not trusted as stored snapshot;
- user scope validation remains enforced;
- invisible private foods are rejected;
- idempotency behavior is preserved.

## 9. Risks

Validation complexity:

- multiple rows can each have different units, amounts, canonical IDs, and visibility status.

Duplicate products:

- users may intentionally or accidentally select the same product more than once.
- MVP should default to dedupe/focus to avoid confusing duplicate diary rows.

Partial failure:

- saving entries one by one can persist some rows before a later row fails.
- MVP should prevalidate all rows and avoid claiming success until all writes complete.
- true transaction semantics would require a separate backend/SQL design and is not part of the first package.

Undo/edit behavior:

- after multi-save, users may expect undo for the whole group.
- MVP can rely on existing per-entry edit/delete, but should not promise group undo unless built.

Mobile layout:

- basket rows plus keyboard plus bottom actions can crowd the screen.
- basket should use stable compact rows and avoid horizontal overflow.

Performance:

- very large selections can make search and preview noisy.
- MVP should consider a practical soft limit, for example 10-15 selected products, with product copy if reached.

Existing flow regression:

- current single-add path is valuable for quick entries and must stay intact.

Recent foods:

- multi-save should update recent foods for each saved item, but not flood or duplicate recents.

Idempotency:

- current default key uses date, meal type, and food ID; duplicates of the same food in one meal may overwrite or replay.
- This supports the recommended dedupe default. If true duplicate rows are allowed later, idempotency key design must be revisited separately.

## 10. Recommended Next Implementation Package

Recommended next package:

- **FOOD_DIARY_MULTI_ADD_FLOW_IMPLEMENTATION_READY**

Suggested scope for that later package:

- implement the minimal multi-select basket in `/nutrition/search`;
- keep single-add behavior available;
- use existing canonical diary entry creation per item;
- add focused tests for selection, weights, preview, invalid state, remove, save, and single-add regression;
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

**FOOD_DIARY_MULTI_ADD_FLOW_PLAN_READY**
