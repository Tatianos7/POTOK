# Today Premium Today Plan List Detail Read-Only Integration Review

- Date: 2026-08-29
- Branch: `master`
- Reviewed files:
  - `src/pages/Today.tsx`
  - `src/pages/__tests__/TodayPaidEntry.test.tsx`
  - `src/services/__tests__/premiumTodayAdapter.test.ts`
  - `src/pages/__tests__/PremiumRecipes.test.tsx`
  - `reports/today-premium-today-plan-list-detail-read-only-integration-2026-08-28.md`
- Source readiness:
  - `TODAY_PREMIUM_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_READY`
- Verdict: **TODAY_PREMIUM_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_REVIEW_READY**

## Verdict

The `/today` plan list/detail read-only integration is ready to commit.

No blocker was found. The integration is gated by `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, keeps default behavior on `demoPlans` / `buildDemoDays`, reads only active plans and plan detail through the reviewed Premium catalog service, and does not connect meal detail, replacements, or shopping to staging data.

Readiness marker: **READY_FOR_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_COMMIT**.

## Files Reviewed

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `src/pages/__tests__/PremiumRecipes.test.tsx`
- `reports/today-premium-today-plan-list-detail-read-only-integration-2026-08-28.md`

Scope files checked and unchanged:

- `src/pages/PremiumRecipes.tsx`
- `src/App.tsx`
- `src/utils/constants.ts`
- SQL and seed files

## Feature Flag Review

Confirmed:

- default mode remains `demoPlans` / `buildDemoDays`;
- staging catalog reads are gated by `isPremiumCatalogStagingReadMode()`;
- when the flag is not `staging_readonly`, `catalogPlans` is reset to `null`;
- staging read-only mode calls `premiumCatalogService.getActivePremiumPlans()`;
- staging read-only mode calls `premiumCatalogService.getPremiumPlanDetail(plan.id)`;
- no `getPremiumMealSlots()`, `getMealRecipeOptions()`, `getPremiumRecipeDetail()`, or `buildDerivedShoppingList()` calls were added to `/today`;
- auth, payment, entitlement, dashboard, and route behavior were not changed.

The flag remains opt-in. Without `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, the static render contract continues to show the existing mock plan list.

## Fallback Review

Confirmed:

- read failure falls back to `demoPlans`;
- empty active plan list falls back to `demoPlans`;
- missing or empty plan detail is skipped;
- if no catalog plan has usable detail/days, the page falls back to `demoPlans`;
- technical service errors are caught and are not rendered to the user;
- catalog-backed data is limited to `home` and `plan_detail` views;
- downstream day, meal, replacement, and shopping views continue to use mock data in this package.

This avoids a staging meal/replacement/shopping hybrid. A user can leave catalog plan detail for downstream views, but those views intentionally remain mock-only until a separate owner-approved package connects them.

Non-blocking implementation note:

- Changing `selectedPlanId` may trigger one extra plan/detail read because the effect depends on `selectedPlanId`. This is acceptable for the narrow first integration, but can be tightened during a later mounted async/browser test pass.

## UI Behavior Review

Confirmed:

- layout and copy were preserved;
- plan list remains functional;
- plan detail remains functional;
- plan detail maps over returned `selectedPlan.days`;
- days 3-14 are not synthesized as staging DB data;
- `Выбрать план` remains no-write;
- `Подтвердить день` remains disabled/no-write;
- `Добавить в дневник` remains disabled/no-write;
- replacement apply remains local-only;
- shopping checkbox state remains local-only.

The existing mock UI continues to render in default mode.

## Scope Review

Confirmed:

- meal detail staging recipe loading was not connected;
- replacement options from staging were not connected;
- shopping from staging was not connected;
- `src/pages/PremiumRecipes.tsx` was not changed;
- routes were not changed;
- paywall/dashboard/constants were not changed;
- SQL and seed files were not changed;
- no Supabase SQL was executed;
- staging was not mutated;
- production was not touched.

The `PremiumRecipes` test update only adjusts the previous `/today`-not-connected guardrail to the new approved scope and keeps `/premium-recipes` separate from the Today adapter.

## Read-Only Boundary Review

Confirmed:

- no `.insert(` calls;
- no `.update(` calls;
- no `.upsert(` calls;
- no `.rpc(` calls;
- no database `.delete(` calls;
- the only `.delete(` in `Today.tsx` remains the existing local `Set.delete(productKey)` checkbox state;
- no `user_premium_plan_selections` writes;
- no `user_premium_meal_selections` writes;
- no `food_diary_entries` writes;
- no workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI/runtime integration;
- no voice input;
- no production config or production query.

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

- add mounted async tests for real effect resolution under the feature flag;
- tighten duplicate catalog read behavior if it becomes noisy in browser tests;
- keep meal detail, replacements, and shopping as separate read-only packages;
- keep user Premium selection writes blocked until behavioral RLS tests are executed.

## Readiness For Commit

**READY_FOR_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_COMMIT**

The package can be committed as `/today` plan list/detail read-only staging integration. It should not be bundled with meal detail, replacement, shopping, database, production, or write-path work.

## Final Verdict

**TODAY_PREMIUM_TODAY_PLAN_LIST_DETAIL_READ_ONLY_INTEGRATION_REVIEW_READY**
