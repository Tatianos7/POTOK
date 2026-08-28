# Today Premium Today Read-Only Staging Integration Plan

- Date: 2026-08-28
- Branch: `master`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Source readiness:
  - `TODAY_PREMIUM_READ_ONLY_CATALOG_SERVICE_COMMITTED`
  - `TODAY_PREMIUM_RECIPES_READ_ONLY_STAGING_INTEGRATION_COMMITTED`
- Source commits:
  - `52cfdec today premium read only catalog service`
  - `b2d8b16 today premium recipes read only staging integration`
- Verdict: **TODAY_PREMIUM_TODAY_READ_ONLY_STAGING_INTEGRATION_PLAN_READY**

## Scope

Prepare a read-only staging integration plan for `/today` using `premiumCatalogService`.

This is a plan/report only. No `/today` runtime code, `/premium-recipes` code, routes, paywall, dashboard cards, SQL files, seed files, Supabase data, staging schema, production config, user Premium selections, diary/workout rows, recipe import, shopping persistence, AI runtime, voice input, PR, commit, or push work was changed in this step.

## Current `/today` Audit

Route and runtime shape:

- `/today` renders `src/pages/Today.tsx`.
- The page is a local React state machine with views:
  - `home`;
  - `plan_detail`;
  - `day_detail`;
  - `meal_detail`;
  - `replace_meal`;
  - `shopping_list`.
- It does not import `premiumCatalogService`.
- It does not import the raw Supabase client.
- It does not call diary, workout, payment, AI, Coach, voice, or old runtime service paths.

Current plan data:

- `demoPlans` contains 4 local plans:
  - nutrition + training;
  - nutrition-only;
  - workout-focused;
  - time-saver.
- Each plan uses `buildDemoDays()`.
- `buildDemoDays()` creates 14 local days.
- Each day contains local macros, meals, optional workout summary, ingredients, portion hints, and steps.

Current plan/detail flow:

- `getInitialPlanId()` reads `planDetail` / `dayDetail` from URL params and falls back to the first demo plan.
- `openPlan(planId)` sets local `selectedPlanId`, resets day to `1`, and opens `plan_detail`.
- Plan detail maps `selectedPlan.days` and renders all 14 demo days.
- `Выбрать план` is displayed as the bottom CTA and currently has no mutation behavior.

Current day/detail flow:

- `getInitialDay()` reads `day` from URL params and limits it to `1..14`.
- `openDay(day)` sets local `selectedDay` and opens `day_detail`.
- Day detail reads `selectedPlanDay` from local plan days.
- It renders macros, meals, optional workout, day-state buttons, shopping-list entry, and disabled `Подтвердить день`.
- Day-state buttons update only local `dayState`.

Current meal/detail flow:

- `getInitialMealTitle()` reads `mealDetail` / `replaceMeal` from URL params and falls back to `Завтрак`.
- `openMeal(mealTitle)` sets local `selectedMealTitle` and opens `meal_detail`.
- `selectedMeal` is resolved from local meal overrides, selected day meals, or first meal fallback.
- Meal detail renders summary, calories, macro details, ingredients, no-scale hints, steps, replacement entry, and disabled `Добавить в дневник`.

Current replacement flow:

- `breakfastReplacementOptions` is local mock data.
- `replaceMealFilters` is local mock filter copy.
- `selectedReplacementId` is local state.
- `applyReplacement()` writes only local `mealOverrides` and returns to `meal_detail`.
- No `user_premium_meal_selections` write exists.

Current shopping flow:

- `shoppingGroups` is local mock data.
- `shoppingPeriods` supports `1`, `2`, `3`, and `7` days.
- `formatShoppingAmount()` multiplies local mock amounts by selected period.
- `boughtProducts` is local state only.
- Shopping checkbox toggles only local `boughtProducts`.
- No shopping source-of-truth persistence exists.

Existing test contracts:

- `src/pages/__tests__/TodayPaidEntry.test.tsx` asserts the local flow, disabled/no-write actions, shopping mock behavior, replacement local override, and absence of diary/workout/payment/AI/Coach/voice runtime paths.
- The current `/premium-recipes` integration has a test confirming `/today` is not connected to `premiumCatalogService`.

## Data Mapping

Use `premiumCatalogService` only as a read-only catalog source.

Planned mapping:

- `getActivePremiumPlans()`
  - `/today` plan list cards;
  - active plan filter;
  - plan title/subtitle/duration display.
- `getPremiumPlanDetail(planId)`
  - selected plan detail header;
  - staged day list when returned.
- `getPremiumPlanDays(planId)`
  - plan detail day rows;
  - available day navigation.
- `getPremiumPlanDay(planId, dayNumber)`
  - direct URL/day detail load fallback when one day is requested.
- `getPremiumMealSlots(dayId)`
  - day detail meal rows;
  - meal title/type, calories, macros, sort order.
- `getMealRecipeOptions(slotId)`
  - primary meal recipe;
  - replacement candidates.
- `getPremiumRecipeDetail(recipeId)`
  - meal detail ingredients, steps, and no-scale hints;
  - replacement detail preview if needed.
- `buildDerivedShoppingList(planId, dayRange)`
  - derived/read-only shopping groups for selected seeded days.

Do not read or write `user_premium_plan_selections` or `user_premium_meal_selections` in this integration.

## Adapter / Mappers Plan

Create a `/today` adapter layer before changing UI behavior.

Suggested file:

- `src/services/premiumTodayAdapter.ts`

Suggested responsibilities:

- convert `PremiumPlan` / `PremiumPlanDetail` DTOs into the current `DemoPlan`-compatible shape;
- convert `PremiumPlanDay` and `PremiumMealSlot` into the current day/meal display shape;
- convert `PremiumRecipeDetail` into current meal detail fields:
  - `summary`;
  - `calories`;
  - `macroDetails`;
  - `ingredients`;
  - `portionHints`;
  - `steps`;
- convert `PremiumMealRecipeOption[]` into `ReplacementOption[]`;
- convert `PremiumShoppingListItem[]` into `ShoppingGroup[]` or a minimal derived grouping;
- keep all mapping pure and unit-tested;
- return complete fallback-safe arrays/strings so UI rendering does not need raw Supabase rows.

Important adapter rule:

- do not synthesize all 14 days from staging if only 2 seeded days are returned.
- Either render only staging-returned days or fall back to the existing full mock plan as a whole.

## Feature Flag Behavior

Use the existing flag:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
```

Default behavior:

- keep current `demoPlans`;
- keep `buildDemoDays()`;
- keep `shoppingGroups`;
- make no service calls.

Staging read-only behavior:

- only when flag is enabled, attempt catalog reads through `premiumCatalogService`;
- do not import raw Supabase in `Today.tsx`;
- do not change auth/payment/entitlement behavior;
- do not show internal read errors to users.

## Fallback Strategy

Fallback should be coarse and calm.

Use current mock data when:

- staging read mode is disabled;
- Supabase client is unavailable;
- catalog read returns `read_failed`;
- active plans are empty;
- plan detail is missing;
- selected plan has no days;
- selected day has no meal slots;
- recipe detail reads fail enough that meal detail would be incomplete.

Recommended first implementation:

- if plan list read fails or returns empty, keep all current `/today` behavior unchanged;
- if a selected staging plan has only days 1 and 2, show those two days only;
- if an attempted URL day is not present in staging data, redirect local state to the first available staging day or fall back to mock for that view;
- avoid partial hybrid states where plan list is staging but day detail silently pulls unrelated mock meals.

## Route / State Integration Plan

Do not change routes.

Keep existing views and local state names where possible:

- `todayView`;
- `selectedPlanId`;
- `selectedDay`;
- `selectedMealTitle`;
- `selectedReplacementId`;
- `mealOverrides`;
- `dayState`;
- `shoppingPeriod`;
- `boughtProducts`.

Plan list:

- phase 2 may replace the plan source with adapter output under flag.
- The default plan source remains `demoPlans`.
- `openPlan(planId)` stays local navigation only.
- `Выбрать план` remains no-write.

Plan detail:

- render days returned by staging adapter when in staging mode.
- Do not render days 3-14 as real DB data unless they exist.
- If product wants a 14-day shell, plan that as a separate UX decision with locked/unavailable placeholders.

Day detail:

- render staging day macros and meal slots when available.
- Keep day state local-only.
- Keep `Подтвердить день` disabled/no-write.

Meal detail:

- use primary option plus `getPremiumRecipeDetail()` for ingredients, hints, and steps.
- Keep `Добавить в дневник` disabled/no-write.

Replacement view:

- use `getMealRecipeOptions(slotId)` for primary/replacement options.
- Selecting and applying replacement updates only local UI state.
- Do not create or update `user_premium_meal_selections`.

Shopping list:

- keep mock or use `buildDerivedShoppingList()` in memory.
- Keep bought checkbox state local-only.
- Do not create `premium_shopping_items`, `user_premium_shopping_checks`, or any source-of-truth shopping table.

## No-Write Boundaries

Do not implement runtime writes:

- no `user_premium_plan_selections` insert/update/delete;
- no `user_premium_meal_selections` insert/update/delete;
- no `food_diary_entries` writes;
- no workout entry writes;
- no `public.recipes` writes;
- no `public.recipe_ingredients` writes;
- no recipe import;
- no shopping persistence;
- no AI/runtime rows;
- no voice input;
- no production config or production query;
- no Supabase SQL execution.

## Phases

Phase 1: Today adapter/mappers only

- Add pure mapper/adapter functions.
- Add unit tests for 2 seeded days, meal slots, primary recipe, replacements, and derived shopping shape.
- No UI behavior change.

Phase 2: plan list/detail read-only under flag

- Read active plans and plan days through `premiumCatalogService`.
- Use adapter output only when reads are complete enough for plan list/detail.
- Fall back to `demoPlans` on unavailable/error/empty.
- Keep `Выбрать план` no-write.

Phase 3: day/meal detail read-only under flag

- Read day rows and meal slots.
- Resolve primary recipe detail for meal detail.
- Preserve disabled `Подтвердить день` and `Добавить в дневник`.

Phase 4: replacements read-only

- Read allowed options through `getMealRecipeOptions(slotId)`.
- Map options into current replacement-card shape.
- Apply replacement only to local state.
- Do not write user meal selections.

Phase 5: shopping derived read-only

- Keep existing mock shopping list or derive in memory from catalog ingredients.
- Keep bought checkbox state local-only.
- No shopping persistence.

## Tests Plan

Targeted tests for future implementation:

- default mode uses `demoPlans`;
- default mode keeps `buildDemoDays()` and `shoppingGroups`;
- `staging_readonly` mode calls expected `premiumCatalogService` read functions;
- service unavailable/error falls back to `demoPlans`;
- empty active plan list falls back to `demoPlans`;
- 2 seeded days do not break plan detail/day detail UI;
- staging mode does not fake days 3-14 as DB data;
- `Выбрать план` remains no-write;
- `Подтвердить день` remains disabled/no-write;
- `Добавить в дневник` remains disabled/no-write;
- replacement apply updates only local `mealOverrides`;
- shopping list does not persist and does not call shopping services;
- source guardrail has no `.insert(`, `.update(`, `.upsert(`, `.delete(`, or `.rpc(` in `Today.tsx`;
- source guardrail has no forbidden writes to user selections, diary/workout, public recipes, shopping persistence, AI/runtime, or voice;
- `/premium-recipes` files are not changed by `/today` integration packages.

Suggested command set for future implementation:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
npx tsx --test src/pages/__tests__/PremiumRecipes.test.tsx
npx tsx --test src/services/__tests__/premiumCatalogService.test.ts
npm run build
git diff --check
```

## Risks

- Staging currently has only 2 seeded days for a 14-day plan.
- Staging labels are English/test-like.
- Seeded nutrition is not production-approved content.
- User selection behavioral RLS tests are still pending.
- User selection tables should remain unused by this read-only integration.
- Mixing staging plan data with mock day/meal data can confuse QA unless fallback is coarse and explicit in implementation.
- Mounted async behavior needs stronger browser/component tests if `/today` starts loading multiple service calls.

## Next Recommended Implementation Package

Recommended next package: `TODAY_PREMIUM_TODAY_READ_ONLY_ADAPTER_IMPLEMENTATION`.

Scope:

- implement pure `/today` adapter/mappers from `premiumCatalogService` DTOs to current UI shapes;
- add unit/source guardrail tests;
- do not change `/today` runtime data source yet;
- do not change `/premium-recipes`;
- do not execute Supabase SQL;
- do not touch staging or production.

## Verification

- `git diff --check`
  - Result: passed.
- Static audit only.
- No runtime code changes.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No `/premium-recipes` changes.

## Final Verdict

**TODAY_PREMIUM_TODAY_READ_ONLY_STAGING_INTEGRATION_PLAN_READY**
