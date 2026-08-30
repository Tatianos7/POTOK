# Today Premium Today Replacements Shopping Mounted Async Tests Review

- Date: 2026-08-30
- Branch: `master`
- Reviewed source readiness: `TODAY_PREMIUM_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_READY`
- Verdict: **TODAY_PREMIUM_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_REVIEW_READY**

## Verdict

The `/today` replacements/shopping test-only mounted async/read-only coverage package is ready to commit.

No blocker was found. The package adds only a targeted test file and implementation report, keeps runtime/config/dependency files unchanged, uses committed Premium read-only fixtures/harness helpers, and records the current DOM/import-meta limitation honestly instead of presenting it as full browser or visual coverage.

Readiness marker: **READY_FOR_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_COMMIT**.

## Files Reviewed

- `src/pages/__tests__/TodayReplacementsShoppingMountedAsync.test.tsx`
- `reports/today-premium-today-replacements-shopping-mounted-async-tests-2026-08-29.md`

Scope files checked:

- `src/pages/Today.tsx`
- `src/services/premiumCatalogService.ts`
- `src/services/premiumTodayAdapter.ts`
- `src/App.tsx`
- `src/utils/constants.ts`
- `package.json`
- `package-lock.json`
- Vite config path
- SQL and seed paths

Existing unrelated dirty/untracked files remain outside this review package.

## Test-Only Scope Review

Confirmed:

- changed package files are test/report only;
- `src/pages/Today.tsx` was not changed;
- `src/services/premiumCatalogService.ts` was not changed;
- `src/services/premiumTodayAdapter.ts` was not changed;
- routes/constants were not changed;
- env/Vite config was not changed;
- package/dependency files were not changed;
- SQL and seed files were not changed by this package;
- no production config was changed.

The package does not alter `/today` runtime behavior.

## Replacements Coverage Review

Confirmed coverage:

- source/read wiring for `premiumCatalogService.getMealRecipeOptions(selectedMeal.catalogSlotId)`;
- source/read wiring for `premiumCatalogService.getPremiumRecipeDetail(option.recipeId)`;
- replacement option mapping through `mapMealRecipeOptionsToReplacementOptions()`;
- primary/replacement fixture shape preserves `optionType`, `recipeId`, label/note, macros, and ingredient detail;
- replacement card-compatible data shape is covered through adapter output;
- empty/null replacement options map to empty fallback-ready arrays;
- `supabase_unavailable` and `read_failed` replacement result contracts are covered;
- failed/missing replacement recipe detail is safe because option metadata can still map without detail;
- `applyReplacement()` remains a local `mealOverrides` state contract;
- no `user_premium_meal_selections` write path appears.

## Shopping Coverage Review

Confirmed coverage:

- source/read wiring for `premiumCatalogService.buildDerivedShoppingList(selectedPlan.id, { startDay, endDay })`;
- source day range uses `selectedDay` and `shoppingPeriod`;
- shopping periods `1`, `2`, `3`, and `7` are covered/documented;
- derived shopping fixture maps through `mapDerivedShoppingListToShoppingGroups()`;
- grouped/in-memory shopping shape uses title `Список`;
- mapped products preserve names, gram units, recipe ids, display amounts, and `isDerivedCatalogAmount`;
- empty derived shopping maps to an empty fallback-ready group list;
- `supabase_unavailable` and `read_failed` derived shopping result contracts are covered;
- checkbox contract remains local `boughtProducts` React state;
- no shopping persistence appears;
- no `premium_shopping_items` or `user_premium_shopping_checks` path appears.

## Fallback / Technical Errors Review

Confirmed:

- `supabase_unavailable` fallback result shape is covered;
- `read_failed` fallback result shape is covered;
- empty replacement options fallback is covered;
- empty derived shopping fallback is covered;
- replacement read failures return quietly to mock replacement options;
- shopping read failures return quietly to mock shopping groups;
- technical strings are not rendered in default replacement or shopping output:
  - `read_failed`;
  - `supabase_unavailable`;
  - `stack`;
  - `Supabase error`.

## No-Write Guardrails Review

Confirmed by source guardrails:

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

## Limitation Review

Confirmed the implementation report honestly records:

- no `jsdom`, `happy-dom`, or `linkedom` dependency exists in the current `tsx --test` environment;
- no dependency was added in this package;
- `renderMountedWithRouter()` records a controlled missing-DOM limitation when no DOM exists;
- true mounted async React `useEffect` execution under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly` is not performed in this package;
- the `import.meta.env` flag cannot be safely overridden from the current Node `tsx --test` context without runtime dependency injection or a Vite/browser test runner;
- this package is not reported as full browser or visual coverage;
- follow-up for DOM/Vite/browser-capable mounted async coverage remains separate.

This is acceptable for the current narrow test-only package because the limitation is explicit and no runtime/config/dependency changes were made to force testability.

## Safety Review

Confirmed:

- no real Supabase calls;
- no staging URL;
- no JWT/session/secrets collection;
- no service-role key usage;
- no network calls;
- no SQL execution;
- no staging mutation;
- no production query;
- no user Premium selection writes;
- no diary/workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no AI runtime;
- no voice input.

The package remains test-only and staging-independent.

## Tests / Build Review

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

Diff check:

```text
git diff --check
```

Result: passed.

## Blockers / Recommended Fixes

No blocker found.

Recommended but non-blocking:

- review and commit this test-only package separately;
- keep full DOM/Vite/browser runner setup as a separate owner-approved decision;
- keep real staging auth/browser visual smoke as a separate package;
- keep future replacements/shopping mounted async tests focused on actual effect resolution once a DOM/Vite/browser harness is approved;
- keep source-level no-write guardrails in place for every Premium read-only test package.

## Readiness For Commit

**READY_FOR_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_COMMIT**

The package can be committed as `/today` replacements/shopping test-only mounted async/read-only coverage. It should not be bundled with runtime code changes, config/dependency changes, real Supabase calls, staging auth/JWT/secrets, SQL, production config, DOM/Vite setup changes, or write-path work.

## Final Verdict

**TODAY_PREMIUM_TODAY_REPLACEMENTS_SHOPPING_MOUNTED_ASYNC_TESTS_REVIEW_READY**
