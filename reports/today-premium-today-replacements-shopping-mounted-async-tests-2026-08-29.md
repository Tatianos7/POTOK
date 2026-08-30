# Today Premium Today Replacements Shopping Mounted Async Tests

- Date: 2026-08-30
- Branch: `master`
- Source commits:
  - `ea890dc today premium read only mounted async test harness`
  - `7b3e6ca today premium recipes mounted async tests`
  - `182c85e today premium today mounted async tests`
- Verdict: **TODAY_PREMIUM_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_READY**

## Scope

Add test-only mounted async/read-only coverage for the `/today` replacements and shopping flow.

This package does not change runtime behavior, config, dependencies, routes, constants, SQL, seed files, Supabase data, staging, production, auth/JWT/secrets, visual smoke setup, or write paths.

## Files Changed

- `src/pages/__tests__/TodayReplacementsShoppingMountedAsync.test.tsx`
- `reports/today-premium-today-replacements-shopping-mounted-async-tests-2026-08-29.md`

## Replacements Coverage

Covered in the new Today replacements/shopping test-only suite:

- current mounted async harness limitation is explicit when no DOM exists;
- default replacement view renders mock `breakfastReplacementOptions`;
- default static render does not execute replacement catalog reads;
- source wiring uses `premiumCatalogService.getMealRecipeOptions(selectedMeal.catalogSlotId)`;
- source wiring loads replacement recipe details through `premiumCatalogService.getPremiumRecipeDetail(option.recipeId)`;
- replacement options are mapped through `mapMealRecipeOptionsToReplacementOptions()`;
- fixture primary and replacement entries preserve `optionType`, `recipeId`, labels, macros, and ingredient details;
- empty/null replacement mapping returns an empty, fallback-ready array;
- failed replacement recipe detail remains safe because the mapper can render option metadata without detail;
- `applyReplacement()` remains a local `mealOverrides` state contract;
- no `user_premium_meal_selections` write path exists.

## Shopping Coverage

Covered:

- default shopping view renders mock `shoppingGroups`;
- default static render does not execute derived shopping catalog reads;
- source wiring uses `premiumCatalogService.buildDerivedShoppingList(selectedPlan.id, { startDay, endDay })`;
- source day range uses `selectedDay` and `shoppingPeriod`;
- shopping periods `1`, `2`, `3`, and `7` are present in the source/UI contract;
- derived shopping fixture maps through `mapDerivedShoppingListToShoppingGroups()`;
- mapped shopping remains grouped/in-memory with title `Список`;
- mapped products preserve names, gram units, recipe ids, display amounts, and `isDerivedCatalogAmount`;
- empty derived shopping maps to an empty, fallback-ready group list;
- checkbox behavior remains local `boughtProducts` React state;
- no `premium_shopping_items` or `user_premium_shopping_checks` path exists.

## Fallback Coverage

Confirmed:

- `supabase_unavailable` fallback result shape remains covered;
- `read_failed` fallback result shape remains covered;
- empty replacement options are fallback-ready;
- empty derived shopping is fallback-ready;
- replacement option read failures return quietly to mock replacement options;
- derived shopping failures return quietly to mock shopping groups;
- technical strings are not rendered in default replacement or shopping output:
  - `read_failed`;
  - `supabase_unavailable`;
  - `stack`;
  - `Supabase error`.

## Local-Only / No-Write Guardrails

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
- no voice input.

## Limitations

The current `tsx --test` environment still has no DOM dependency such as `jsdom`, `happy-dom`, or `linkedom`.

Because of that:

- `renderMountedWithRouter()` records the controlled missing-DOM limitation;
- full mounted async React `useEffect` execution under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly` is not performed in this package;
- `import.meta.env` flag behavior is not overridden from this Node test context;
- no browser visual runner or real staging auth/session is used.

This is intentional for the package scope. The tests cover available source, fixture, adapter, fallback, static render, and no-write contracts without runtime/config/dependency changes.

## Tests / Build Result

Today replacements/shopping mounted async targeted test:

```text
npx tsx --test src/pages/__tests__/TodayReplacementsShoppingMountedAsync.test.tsx
```

Result: passed, `9` tests.

Today plan/day/meal mounted async targeted test:

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

Recommended next package: **TODAY_PREMIUM_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_REVIEW**.

Scope should remain review-only:

- verify this test-only package before commit;
- keep runtime/config/dependency files unchanged;
- keep full DOM/Vite/browser runner setup as a separate owner-approved decision;
- keep real staging auth/browser visual smoke as a separate package;
- keep no-write/source guardrails in place.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**TODAY_PREMIUM_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_READY**
