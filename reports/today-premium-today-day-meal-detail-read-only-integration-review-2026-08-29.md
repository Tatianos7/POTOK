# Today Premium Today Day Meal Detail Read-Only Integration Review

- Date: 2026-08-29
- Branch: `master`
- Reviewed files:
  - `src/pages/Today.tsx`
  - `src/services/premiumTodayAdapter.ts`
  - `src/services/__tests__/premiumTodayAdapter.test.ts`
  - `src/pages/__tests__/TodayPaidEntry.test.tsx`
  - `reports/today-premium-today-day-meal-detail-read-only-integration-2026-08-29.md`
- Source readiness:
  - `TODAY_PREMIUM_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_READY`
- Verdict: **TODAY_PREMIUM_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_REVIEW_READY**

## Verdict

The `/today` day detail and meal detail read-only staging integration is ready to commit.

No blocker was found. The implementation keeps default `/today` behavior on `demoPlans` / `buildDemoDays`, uses Premium catalog reads only under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, connects day meal slots and primary recipe detail in read-only mode, and does not connect replacement persistence or shopping persistence.

Readiness marker: **READY_FOR_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_COMMIT**.

## Files Reviewed

- `src/pages/Today.tsx`
- `src/services/premiumTodayAdapter.ts`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-today-day-meal-detail-read-only-integration-2026-08-29.md`

Scope files checked and unchanged:

- `src/pages/PremiumRecipes.tsx`
- `src/App.tsx`
- `src/utils/constants.ts`
- SQL and seed files

## Feature Flag Review

Confirmed:

- default mode remains `demoPlans` / `buildDemoDays`;
- default mode has no approved Premium catalog read path active;
- staging reads are gated by `isPremiumCatalogStagingReadMode()`;
- staging read-only mode keeps catalog-backed plan/day data active for `home`, `plan_detail`, `day_detail`, and `meal_detail`;
- day/meal reads only run when `todayView` is `day_detail` or `meal_detail`;
- the flag does not change auth, payment, entitlement, dashboard, routes, or production configuration.

The integration remains opt-in through:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
```

## Day Detail Review

Confirmed:

- catalog-backed day detail reads meal slots through `premiumCatalogService.getPremiumMealSlots(selectedPlanDay.catalogDayId)`;
- `premiumTodayAdapter.mapPremiumMealSlotsToTodayMeals()` maps meal slots into the existing Today meal card shape;
- adapter metadata carries `catalogDayId` without exposing raw Supabase rows to the render surface;
- day detail renders `selectedPlanDayForRender`;
- breakfast/lunch/dinner/snack can render from staging meal slots when loaded;
- `dayState` remains local-only;
- `Подтвердить день` remains disabled/no-write;
- days 3-14 are not synthesized as staging DB data.

## Meal Detail Review

Confirmed:

- meal detail resolves the selected meal from mapped staging meals when a catalog day is active;
- primary meal option is read through `premiumCatalogService.getMealRecipeOptions(slot.id)`;
- the primary option is selected with `option.optionType === 'primary'`;
- recipe detail is read through `premiumCatalogService.getPremiumRecipeDetail(primaryOption.recipeId)`;
- ingredients, steps, and hints are mapped through `premiumTodayAdapter`;
- meal slot calories/macros remain the displayed meal summary values;
- `Добавить в дневник` remains disabled/no-write;
- technical read errors are caught and are not rendered to users.

## Fallback Review

Confirmed:

- read mode disabled keeps the existing mock flow;
- empty active plans fall back to `demoPlans`;
- empty or unusable plan detail falls back to `demoPlans`;
- empty meal slots clear catalog state and fall back to mock plan data;
- meal option read failures fall back safely;
- recipe detail read failures or missing recipe detail fall back safely;
- empty mapped meals fall back safely;
- no technical `read_failed` / `supabase_unavailable` strings are rendered to users.

Non-blocking note:

- the static tests verify source-level contracts. A later browser/mounted async test pass would give stronger confidence around effect timing and real promise resolution under the flag.

## Scope Review

Confirmed:

- replacement staging integration is not connected;
- replacement view still uses local `breakfastReplacementOptions`;
- replacement apply remains local-only through `mealOverrides`;
- shopping staging integration is not connected;
- shopping remains local/mock through `shoppingGroups` and local checkbox state;
- `/premium-recipes` runtime was not changed;
- routes, constants, paywall, and dashboard behavior were not changed;
- SQL and seed files were not changed;
- no Supabase SQL was executed;
- staging was not mutated;
- production was not touched.

## Read-Only Boundary Review

Confirmed:

- no `.insert(` calls;
- no `.update(` calls;
- no `.upsert(` calls;
- no `.rpc(` calls;
- no database `.delete(` calls;
- the only `.delete(` in `Today.tsx` remains existing local `Set.delete(productKey)` checkbox state;
- no `user_premium_plan_selections` writes;
- no `user_premium_meal_selections` writes;
- no `food_diary_entries` writes;
- no workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI/runtime integration;
- no voice input;
- no production config or query.

## Tests / Build Review

Today targeted test:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed.

Catalog adapter targeted test:

```text
npx tsx --test src/services/__tests__/premiumTodayAdapter.test.ts
```

Result: passed.

Catalog service targeted test:

```text
npx tsx --test src/services/__tests__/premiumCatalogService.test.ts
```

Result: passed.

Premium recipes targeted test:

```text
npx tsx --test src/pages/__tests__/PremiumRecipes.test.tsx
```

Result: passed.

Build:

```text
npm run build
```

Result: passed.

Notes:

- Missing Vite Supabase env warning appeared in local tests and is expected for fallback-safe mode.
- Existing React Router SSR `useLayoutEffect` warnings appeared in static render tests.
- Vite/Browserslist/chunk-size warnings appeared during build.
- No final test or build failure remained.

Diff check:

```text
git diff --check
```

Result: passed.

## Blockers / Recommended Fixes

No blocker found.

Recommended but non-blocking before broader `/today` rollout:

- add mounted async tests for actual catalog day/meal load behavior under the feature flag;
- keep replacement staging integration as a separate package;
- keep shopping derived read-only integration as a separate package;
- keep user Premium selection writes blocked until behavioral RLS tests are executed.

## Readiness For Commit

**READY_FOR_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_COMMIT**

The package can be committed as `/today` day detail and meal detail read-only staging integration. It should not be bundled with replacement, shopping, database, production, or write-path work.

## Final Verdict

**TODAY_PREMIUM_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_REVIEW_READY**
