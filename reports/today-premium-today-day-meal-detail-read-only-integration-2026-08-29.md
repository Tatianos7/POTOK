# Today Premium Today Day Meal Detail Read-Only Integration

- Date: 2026-08-29
- Branch: `master`
- Source commits:
  - `d224c24 today premium today plan list detail read only integration`
  - `5fce76c today premium today read only adapter`
  - `52cfdec today premium read only catalog service`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **TODAY_PREMIUM_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_READY**

## Scope

Connected `/today` day detail and meal detail to Premium catalog data in read-only mode under the existing feature flag.

This package does not execute Supabase SQL, mutate staging, touch production, create user Premium selections, write diary/workout rows, write `public.recipes`, import recipes, persist shopping data, add AI/runtime rows, add voice input, create a PR, or commit/push changes.

## Files Changed

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/premiumTodayAdapter.ts`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `reports/today-premium-today-day-meal-detail-read-only-integration-2026-08-29.md`

Unchanged by this package:

- `src/pages/PremiumRecipes.tsx`
- `src/App.tsx`
- `src/utils/constants.ts`
- SQL and seed files

## Feature Flag Behavior

The integration uses the existing flag:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
```

Default behavior remains mock-only:

- `demoPlans` / `buildDemoDays()` stay as the source;
- no Premium catalog service reads are attempted outside the approved staging read-only path;
- existing `/today` copy/layout remains intact.

Staging read-only behavior:

- plan list/detail continue to read through `getActivePremiumPlans()` and `getPremiumPlanDetail()`;
- day detail and meal detail now keep the catalog plan active for those views;
- day detail reads meal slots through `getPremiumMealSlots(dayId)`;
- meal detail resolves the primary option through `getMealRecipeOptions(slotId)`;
- meal detail reads ingredients, steps, and hints through `getPremiumRecipeDetail(recipeId)`;
- mapping is handled through `premiumTodayAdapter`.

The flag does not change auth, payment, entitlement, dashboard, routes, or production configuration.

## Day Detail Behavior

When a catalog-backed plan is active and the user opens a seeded day:

- `/today` requests meal slots for the selected Premium plan day id;
- meal slots are mapped into the existing Today meal card shape;
- breakfast, lunch, dinner, and snack rows can render from staging data;
- daily calories/macros/workout summary continue to come from the mapped Premium plan day;
- `Подтвердить день` remains disabled and no-write;
- `dayState` remains local-only.

Days 3-14 are not synthesized as DB data. Only returned Premium days are treated as staging catalog days.

## Meal Detail Behavior

When a catalog-backed day has loaded meal slots:

- the selected meal resolves from the mapped staging meal slot;
- the service reads primary meal recipe options;
- the service reads the selected primary recipe detail;
- ingredients map to the existing ingredients list;
- recipe hints map to `portionHints`;
- recipe steps map to preparation steps;
- meal slot calories/macros remain the displayed meal macro summary;
- `Добавить в дневник` remains disabled and no-write.

Replacement option reads are not connected in this package.

## Fallback Behavior

Fallback remains calm and non-technical:

- disabled read mode keeps the existing mock flow;
- unavailable Supabase/client reads fall back to `demoPlans`;
- empty active plans fall back to `demoPlans`;
- empty plan detail falls back to `demoPlans`;
- empty meal slots fall back to the mock plan source;
- meal option or recipe detail read failures fall back safely;
- technical errors are caught and not shown to users.

The implementation avoids treating days 3-14 as staging data when only day 1/day 2 are seeded.

## No-Write Confirmation

Confirmed boundaries:

- no `user_premium_plan_selections` writes;
- no `user_premium_meal_selections` writes;
- no `food_diary_entries` writes;
- no workout writes;
- no `public.recipes` writes;
- no `recipe_ingredients` writes;
- no recipe import;
- no shopping persistence;
- no `premium_shopping_items` or `user_premium_shopping_checks`;
- no AI/runtime integration;
- no voice input;
- no production config/query.

The only `.delete(` in `Today.tsx` remains the existing local `Set.delete(productKey)` checkbox state for mock shopping.

## Replacements And Shopping

Confirmed not connected to staging in this package:

- replacement view still uses local `breakfastReplacementOptions`;
- replacement apply only updates local `mealOverrides`;
- shopping list still uses local `shoppingGroups`;
- shopping checkbox state remains local-only;
- no derived staging shopping list is used yet.

## Tests Run

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

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_REVIEW`.

Scope:

- review `/today` day detail and meal detail read-only staging integration;
- confirm replacements and shopping remain mock/local-only;
- confirm `/premium-recipes`, routes, dashboard, SQL, staging, and production remain unchanged;
- keep user Premium selection writes blocked until behavioral RLS tests are executed.

## Verification

- `git diff --check`
  - Result: passed.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No `/premium-recipes` changes.
- No replacement staging integration.
- No shopping staging integration.

## Final Verdict

**TODAY_PREMIUM_TODAY_DAY_MEAL_DETAIL_READ_ONLY_INTEGRATION_READY**
