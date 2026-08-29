# Today Premium Today Mounted Async Tests Review

- Date: 2026-08-29
- Branch: `master`
- Reviewed source readiness: `TODAY_PREMIUM_TODAY_PLAN_DAY_MEAL_MOUNTED_ASYNC_TESTS_READY`
- Verdict: **TODAY_PREMIUM_TODAY_PLAN_DAY_MEAL_MOUNTED_ASYNC_TESTS_REVIEW_READY**

## Verdict

The `/today` plan/day/meal test-only mounted async/read-only coverage package is ready to commit.

No blocker was found. The package adds only a targeted test file and implementation report, keeps runtime/config/dependency files unchanged, uses committed Premium read-only fixtures/harness helpers, and records the current DOM/import-meta limitation honestly instead of presenting it as full browser or visual coverage.

Readiness marker: **READY_FOR_TODAY_PLAN_DAY_MEAL_MOUNTED_ASYNC_TESTS_COMMIT**.

## Files Reviewed

- `src/pages/__tests__/TodayMountedAsync.test.tsx`
- `reports/today-premium-today-mounted-async-tests-2026-08-29.md`

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

## Coverage Review

Confirmed coverage:

- default/mock `/today` plan/day/meal behavior;
- default static render does not execute Premium catalog service reads;
- default plan, day, and meal surfaces render expected mock content;
- disabled `Подтвердить день` action remains disabled/no-write;
- disabled `Добавить в дневник` action remains disabled/no-write;
- flag/source wiring for `isPremiumCatalogStagingReadMode()`;
- flag/source wiring for `premiumCatalogService.getActivePremiumPlans()`;
- flag/source wiring for `premiumCatalogService.getPremiumPlanDetail(plan.id)`;
- flag/source wiring for `premiumCatalogService.getPremiumMealSlots(selectedPlanDay.catalogDayId)`;
- flag/source wiring for `premiumCatalogService.getMealRecipeOptions(slot.id)`;
- flag/source wiring for `premiumCatalogService.getPremiumRecipeDetail(primaryOption.recipeId)`;
- adapter/fixture mapping for returned catalog day 1 and day 2;
- no days 3-14 synthesis as real catalog days;
- adapter/fixture mapping for breakfast, lunch, dinner, and snack;
- adapter/fixture mapping for recipe ingredients, steps, and hints;
- failed/missing recipe detail maps to safe empty arrays;
- fallback result contracts for `supabase_unavailable`, `read_failed`, and empty arrays;
- source fallback contracts for empty active plans, empty/incomplete plan detail, empty meal slots, and failed recipe detail;
- technical error strings are not rendered in default/fallback output;
- no-write/source guardrails for the Today runtime surface and adapter/service sources.

The tests use the committed Premium read-only fixture/harness package and do not require real staging data.

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

The no-write guardrail allows the single existing `.delete(` occurrence in `Today.tsx` only as local `Set.delete(productKey)` checkbox state.

## Tests / Build Review

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

Diff check:

```text
git diff --check
```

Result: passed.

## Blockers / Recommended Fixes

No blocker found.

Recommended but non-blocking:

- review and commit this test-only package separately;
- keep future Today mounted async tests focused on real async effect resolution once a DOM/Vite/browser harness is approved;
- avoid adding DOM dependencies or Vite config changes without a separate decision;
- keep replacements/shopping mounted async coverage as a separate test-only package;
- keep real staging auth/browser visual smoke as a separate package;
- keep source-level no-write guardrails in place for every Premium read-only test package.

## Readiness For Commit

**READY_FOR_TODAY_PLAN_DAY_MEAL_MOUNTED_ASYNC_TESTS_COMMIT**

The package can be committed as `/today` plan/day/meal test-only mounted async/read-only coverage. It should not be bundled with runtime code changes, config/dependency changes, real Supabase calls, staging auth/JWT/secrets, SQL, production config, replacements/shopping expansion, or write-path work.

## Final Verdict

**TODAY_PREMIUM_TODAY_PLAN_DAY_MEAL_MOUNTED_ASYNC_TESTS_REVIEW_READY**
