# Today Premium Today Mounted Async Tests

- Date: 2026-08-29
- Branch: `master`
- Source commits:
  - `ea890dc today premium read only mounted async test harness`
  - `7b3e6ca today premium recipes mounted async tests`
- Verdict: **TODAY_PREMIUM_TODAY_PLAN_DAY_MEAL_MOUNTED_ASYNC_TESTS_READY**

## Scope

Add test-only mounted async/read-only coverage for the `/today` plan/day/meal flow.

This package does not change runtime behavior, config, dependencies, routes, constants, SQL, seed files, Supabase data, staging, production, auth/JWT/secrets, visual smoke setup, or write paths.

## Files Changed

- `src/pages/__tests__/TodayMountedAsync.test.tsx`
- `reports/today-premium-today-mounted-async-tests-2026-08-29.md`

## Cases Covered

Covered in the new Today test-only suite:

- current mounted async harness limitation is explicit when no DOM exists;
- default `/today` render stays on `demoPlans` / `buildDemoDays`;
- default static render does not execute Premium catalog service reads;
- default plan/day/meal surfaces render expected mock content;
- day and meal no-write actions remain disabled;
- feature-flag source wiring exists for the approved read-only plan/day/meal path;
- fallback result contracts cover `supabase_unavailable`, `read_failed`, and empty arrays;
- technical strings are not visible in default/fallback output;
- source guardrails remain no-write.

## Plan / Day / Meal Coverage

Confirmed with fixtures and adapter assertions:

- active Premium plan fixture maps into the Today-compatible plan shape;
- returned catalog days are day 1 and day 2 only;
- days 3-14 are not synthesized as real catalog days;
- breakfast, lunch, dinner, and snack meal slots map in display order;
- primary recipe detail maps ingredients, preparation steps, and portion hints;
- failed/missing recipe detail maps to safe empty ingredient/step/hint arrays.

The test also checks `/today` source wiring for:

- `isPremiumCatalogStagingReadMode()`;
- `premiumCatalogService.getActivePremiumPlans()`;
- `premiumCatalogService.getPremiumPlanDetail(plan.id)`;
- `premiumCatalogService.getPremiumMealSlots(selectedPlanDay.catalogDayId)`;
- `premiumCatalogService.getMealRecipeOptions(slot.id)`;
- `premiumCatalogService.getPremiumRecipeDetail(primaryOption.recipeId)`;
- `buildTodayPlanFromPremiumCatalog()`;
- `mapPremiumMealSlotsToTodayMeals()`.

## Fallback Coverage

Confirmed:

- unavailable catalog result remains fallback-ready;
- read failure result remains fallback-ready;
- empty catalog array result remains fallback-ready;
- empty active plans fall back through the existing source contract;
- empty/incomplete plan detail is skipped/fallback-safe;
- empty meal slots clear catalog state and return to mock/demo;
- failed recipe detail is caught by the read-only effect path;
- technical errors are not rendered to users.

## No-Write Guardrails

Confirmed in source guardrails:

- no `.insert(` calls;
- no `.update(` calls;
- no `.upsert(` calls;
- no `.rpc(` calls;
- no database `.delete(` calls;
- the only `.delete(` in `Today.tsx` remains local `Set.delete(productKey)` checkbox state;
- no `user_premium_plan_selections`;
- no `user_premium_meal_selections`;
- no `food_diary_entries`;
- no workout writes;
- no `public.recipes`;
- no `recipe_ingredients`;
- no recipe import;
- no shopping persistence;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no AI runtime;
- no voice input;
- no payment/subscription runtime path.

## Limitations

The current `tsx --test` environment still has no DOM dependency such as `jsdom`, `happy-dom`, or `linkedom`.

Because of that:

- `renderMountedWithRouter()` records the controlled missing-DOM limitation;
- full mounted async React `useEffect` execution under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly` is not performed in this package;
- `import.meta.env` flag behavior is not overridden from this Node test context;
- no browser visual runner or real staging auth/session is used.

This is intentional for the package scope. The tests cover available source, fixture, adapter, fallback, static render, and no-write contracts without runtime/config/dependency changes.

## Tests / Build Result

Today mounted async targeted test:

```text
npx tsx --test src/pages/__tests__/TodayMountedAsync.test.tsx
```

Result: passed, `8` tests.

Premium recipes mounted async targeted test:

```text
npx tsx --test src/pages/__tests__/PremiumRecipesMountedAsync.test.tsx
```

Result: passed, `7` tests.

Harness/fixtures targeted test:

```text
npx tsx --test src/test/__tests__/premiumReadOnlyMountedAsyncHarness.test.ts
```

Result: passed, `7` tests.

Today existing targeted test:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed, `49` tests.

Premium recipes existing targeted test:

```text
npx tsx --test src/pages/__tests__/PremiumRecipes.test.tsx
```

Result: passed, `9` tests.

Catalog service targeted test:

```text
npx tsx --test src/services/__tests__/premiumCatalogService.test.ts
```

Result: passed, `4` tests.

Today adapter targeted test:

```text
npx tsx --test src/services/__tests__/premiumTodayAdapter.test.ts
```

Result: passed, `9` tests.

Build:

```text
npm run build
```

Result: passed.

Notes:

- Missing Vite Supabase env warning appeared in local tests and remains expected for fallback-safe mode.
- Existing React Router SSR `useLayoutEffect` warnings appeared in static render tests.
- Vite/Browserslist/chunk-size warnings appeared during build.
- No final test or build failure occurred.

## No Runtime / Supabase / Secrets Confirmation

Confirmed:

- no runtime code changes;
- no config/dependency changes;
- no real Supabase calls;
- no staging URL;
- no JWT/session/secrets collection;
- no service-role keys;
- no Supabase SQL execution;
- no staging mutation;
- no production query;
- no visual smoke run.

## Next Recommended Step

Recommended next package: **TODAY_PREMIUM_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS**.

Scope should remain test-only and staging-independent:

- cover `/today` replacements with fixture/service contracts and local-only apply;
- cover `/today` derived shopping with fixture/service contracts and local-only checkbox state;
- keep full DOM/Vite/browser runner setup as a separate owner-approved decision;
- keep no-write/source guardrails in place.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**TODAY_PREMIUM_TODAY_PLAN_DAY_MEAL_MOUNTED_ASYNC_TESTS_READY**
