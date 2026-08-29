# Today Premium Today Plan List Detail Read-Only Integration

- Date: 2026-08-28
- Branch: `master`
- Source readiness:
  - `TODAY_PREMIUM_TODAY_READ_ONLY_ADAPTER_COMMITTED`
  - `TODAY_PREMIUM_READ_ONLY_CATALOG_SERVICE_COMMITTED`
- Source commits:
  - `5fce76c today premium today read only adapter`
  - `52cfdec today premium read only catalog service`
- Verdict: **TODAY_PREMIUM_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_READY**

## Scope

Connected only the `/today` plan list and plan detail source to Premium staging catalog data in read-only mode behind the existing feature flag.

No Supabase SQL execution, staging mutation, production change, user Premium selection write, diary/workout write, `public.recipes` write, recipe import, meal detail staging integration, replacement staging integration, shopping persistence, AI runtime, voice input, PR, commit, or push work was done.

## Files Changed

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `src/pages/__tests__/PremiumRecipes.test.tsx`
- `reports/today-premium-today-plan-list-detail-read-only-integration-2026-08-28.md`

Confirmed unchanged:

- `src/pages/PremiumRecipes.tsx`
- `src/App.tsx`
- `src/utils/constants.ts`
- SQL and seed files

## Feature Flag Behavior

Flag:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
```

Default behavior:

- `/today` keeps `demoPlans`;
- `buildDemoDays()` remains the default 14-day mock source;
- no Premium catalog service calls are made before the flag check;
- existing no-goal and existing-goal mock behavior remains intact.

Staging read-only behavior:

- when the flag is enabled and a goal exists, `/today` attempts `premiumCatalogService.getActivePremiumPlans()`;
- for each active plan, it attempts `premiumCatalogService.getPremiumPlanDetail(plan.id)`;
- successful plan/day catalog DTOs are mapped through `buildTodayPlanFromPremiumCatalog()`;
- catalog-backed data is used only for `home` and `plan_detail` views.

## Fallback Behavior

Fallback remains coarse and full-screen-safe:

- if staging read mode is disabled, the page uses `demoPlans`;
- if active plan read fails or returns empty data, the page uses `demoPlans`;
- if plan detail read fails, is missing, or has no days, that catalog plan is skipped;
- if no catalog plan is complete enough for plan list/detail, the page uses `demoPlans`;
- if the selected catalog plan/day is unavailable, local state falls back to the first available mapped plan/day;
- technical read errors are swallowed and are not shown to the user.

## Plan List / Detail Behavior

Implemented behavior:

- home plan list uses catalog-mapped plans only under the staging read-only flag;
- default home plan list still renders the existing POTOK mock plans;
- plan detail renders the days returned by the catalog adapter;
- the implementation does not synthesize days 3-14 from staging data when only day 1/day 2 are returned;
- if a user leaves plan detail for day, meal, replacement, or shopping views, those downstream views continue to use mock data in this package.

Not implemented in this package:

- meal detail staging recipe loading;
- replacement options from staging;
- shopping derivation from staging;
- user plan selection writes;
- user meal selection writes.

## No-Write Confirmation

Confirmed:

- no `.insert(` calls;
- no `.update(` calls;
- no `.upsert(` calls;
- no `.rpc(` calls;
- the only `.delete(` in `Today.tsx` remains the existing local `Set.delete(productKey)` checkbox state;
- no `user_premium_plan_selections`;
- no `user_premium_meal_selections`;
- no `food_diary_entries`;
- no workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI/runtime integration;
- no production config or production query.

Buttons remain no-write:

- `Выбрать план`;
- `Подтвердить день`;
- `Добавить в дневник`;
- replacement apply remains local-only.

## Tests Run

Today targeted test:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed.

Coverage added/confirmed:

- default mode keeps `demoPlans`;
- staging read-only mode calls `getActivePremiumPlans()`;
- staging read-only mode calls `getPremiumPlanDetail(plan.id)`;
- adapter output can drive plan list/detail;
- catalog source is limited to `home` and `plan_detail`;
- downstream day/meal/replacement/shopping views are not connected to staging in this package;
- read failure or empty catalog falls back to `demoPlans`;
- no days 3-14 are synthesized as staging data;
- disabled/no-write actions remain guarded;
- no forbidden mutation/write surfaces are present.

Adapter targeted test:

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

Result: passed after removing an unused test variable.

Notes:

- Missing Vite Supabase env warning appeared in local tests and is expected for fallback-safe mode.
- Existing React Router SSR `useLayoutEffect` warnings appeared in static render tests.
- Vite/Browserslist/chunk-size warnings appeared during build.
- No final test or build failure remained.

## `/premium-recipes` Confirmation

Confirmed:

- `src/pages/PremiumRecipes.tsx` was not changed;
- `/premium-recipes` remains on its existing read-only integration path;
- `/premium-recipes` does not import `premiumTodayAdapter`;
- route, paywall, dashboard, and constants files were not changed.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_REVIEW`.

Scope:

- review the `/today` plan list/detail read-only integration before commit;
- verify the feature flag and fallback boundaries;
- keep meal detail, replacements, shopping, and all user writes out of scope;
- keep Supabase SQL, staging mutation, and production changes out of scope.

## Verification

- `git diff --check`
  - Result: passed.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No `/premium-recipes` runtime change.

## Final Verdict

**TODAY_PREMIUM_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_READY**
