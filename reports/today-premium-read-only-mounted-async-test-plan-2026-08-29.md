# Today Premium Read-Only Mounted Async Test Plan

- Date: 2026-08-29
- Branch: `master`
- Source final status commit: `f8b9160 today premium read only runtime final status`
- Target package: `TODAY_PREMIUM_READ_ONLY_MOUNTED_ASYNC_TEST_IMPLEMENTATION`
- Verdict: **TODAY_PREMIUM_READ_ONLY_MOUNTED_ASYNC_TEST_PLAN_READY**

## Scope

Prepare a plan for mounted async/browser-style tests covering Premium read-only flag-enabled flows.

This is a plan/report only. No tests were written, no runtime code was changed, no visual smoke was run, no real staging auth/JWT/secrets were used, no Supabase SQL was executed, staging was not mutated, production was not touched, and no PR was created.

## Current Test Audit

`src/pages/__tests__/TodayPaidEntry.test.tsx`:

- uses `renderToStaticMarkup` with `MemoryRouter`;
- verifies default `/today` mock/demo states;
- verifies source-level feature flag and service-call wiring;
- verifies plan/day/meal/replacement/shopping read-only guardrails through static source assertions;
- verifies disabled/no-write actions and absence of forbidden runtime paths;
- does not mount React effects in a browser-like DOM.

`src/pages/__tests__/PremiumRecipes.test.tsx`:

- uses `renderToStaticMarkup` with `MemoryRouter`;
- verifies default mock recipe library and detail;
- verifies feature flag service-call source wiring;
- verifies catalog recipe mapper output;
- verifies disabled add-to-plan/add-to-diary actions;
- verifies no DB write/runtime paths in source;
- does not execute async `useEffect` service reads.

`src/services/__tests__/premiumCatalogService.test.ts`:

- verifies read-only service exports;
- verifies source has no mutation methods or forbidden write surfaces;
- verifies typed fallback result when Supabase client is missing;
- verifies DTO mapper stability;
- does not call real Supabase.

`src/services/__tests__/premiumTodayAdapter.test.ts`:

- verifies pure adapter/mappers;
- verifies two seeded days are not expanded into days 3-14;
- verifies meal slot, recipe detail, replacement, and shopping mappings;
- verifies adapter source purity/read-only boundaries;
- does not mount `/today`.

## Runtime Surface Audit

`src/pages/PremiumRecipes.tsx`:

- starts with `mockPremiumRecipes`;
- gates catalog reads through `isPremiumCatalogStagingReadMode()`;
- calls `premiumCatalogService.getPremiumRecipeLibrary()` for library reads;
- calls `premiumCatalogService.getPremiumRecipeDetail(selectedRecipeId)` for detail reads;
- maps catalog data through `mapCatalogRecipeToPremiumRecipe()`;
- keeps technical errors quiet by leaving mock/current state intact.

`src/pages/Today.tsx`:

- starts with local `demoPlans`, `buildDemoDays`, mock replacement options, and mock shopping groups;
- gates catalog reads through `isPremiumCatalogStagingReadMode()`;
- loads active plan/detail data through `getActivePremiumPlans()` and `getPremiumPlanDetail()`;
- loads day/meal data through `getPremiumMealSlots()`, `getMealRecipeOptions()`, and `getPremiumRecipeDetail()`;
- loads replacement options through `getMealRecipeOptions()` and recipe detail reads;
- loads derived shopping through `buildDerivedShoppingList()`;
- falls back to mock/demo state on unavailable/error/empty data;
- keeps selection, day state, replacement apply, and shopping checkboxes local-only.

`src/services/premiumCatalogService.ts`:

- exposes read-only catalog functions;
- uses the existing Supabase client;
- returns typed fallback results;
- avoids insert/update/upsert/delete/rpc and forbidden write tables.

`src/services/premiumTodayAdapter.ts`:

- pure DTO-to-UI mapping only;
- no Supabase import, env access, localStorage access, React imports, or side effects;
- maps plans, days, meals, recipe detail, replacement options, and derived shopping groups.

## Proposed Harness

Use a minimal mounted component test harness that:

- renders React components into a DOM container;
- uses `MemoryRouter` for route/query-state coverage;
- waits for async effects with `act()` and small test helpers such as `flushPromises()`;
- mocks `premiumCatalogService` instead of using real Supabase;
- controls `isPremiumCatalogStagingReadMode()` deterministically;
- captures rendered text/button disabled state from DOM;
- avoids Playwright/Chromium dependency unless a browser-capable environment is explicitly available.

Preferred implementation direction:

- keep existing SSR/static tests;
- add mounted async tests as a separate file or clearly separated block;
- use Node test runner plus React DOM test utilities if already sufficient;
- if a DOM is missing, introduce the smallest safe DOM harness approved for the repo, for example a focused `jsdom` test setup, as a test-only dependency/package;
- do not modify runtime pages solely to make tests pass unless a real testability issue is approved separately.

## Mocked Service Strategy

Tests should use mocked `premiumCatalogService` and mocked read-mode helper.

Rules:

- no real Supabase client;
- no staging URL;
- no JWT/session/secrets;
- no network calls;
- no service-role key;
- no SQL execution;
- no writes;
- deterministic fixtures for success, unavailable, error, and empty data.

Fixture groups:

- active Premium plan fixture with days 1 and 2 only;
- meal slot fixtures for breakfast/lunch/dinner/snack;
- recipe detail fixture with ingredients, steps, and hints;
- replacement options with primary and replacement rows;
- derived shopping fixture with grouped ingredients;
- fallback empty/error results using the service result shape.

Suggested mock result shape:

```text
{ ok: true, source: 'supabase', data: ... }
{ ok: false, source: 'fallback', error: 'supabase_unavailable', data: ... }
{ ok: false, source: 'fallback', error: 'read_failed', data: ... }
```

## Route / Surface Coverage

`/premium-recipes` flag-enabled library load:

- render under `staging_readonly`;
- assert `getPremiumRecipeLibrary()` is called once or within an accepted call contract;
- resolve with catalog recipe fixture;
- assert catalog-backed recipe text appears;
- assert mock-only text is replaced where expected.

`/premium-recipes` flag-enabled detail load:

- render detail query route;
- assert `getPremiumRecipeDetail(recipeId)` is called;
- resolve detail fixture;
- assert ingredients, steps, and hints render;
- assert `Добавить в план` and `Добавить в дневник` remain disabled.

`/today` flag-enabled plan list/detail:

- render `/today?demoGoal=1` under flag;
- resolve active plan and plan detail with days 1 and 2;
- assert `getActivePremiumPlans()` and `getPremiumPlanDetail()` are called;
- assert catalog plan appears;
- assert days 1 and 2 appear;
- assert days 3-14 are not presented as real catalog days.

`/today` flag-enabled day detail:

- render a day detail route under flag;
- resolve catalog plan/day and meal slots;
- assert `getPremiumMealSlots()` is called for catalog day id;
- assert breakfast/lunch/dinner/snack rows render from fixture;
- assert `Подтвердить день` remains disabled/no-write.

`/today` flag-enabled meal detail:

- render a meal detail route under flag;
- resolve primary option and recipe detail;
- assert `getMealRecipeOptions()` and `getPremiumRecipeDetail()` are called;
- assert ingredients, steps, and hints render;
- assert `Добавить в дневник` remains disabled/no-write.

`/today` flag-enabled replacements:

- render replacement route under flag;
- resolve replacement options and recipe details;
- assert staging replacement cards render;
- assert empty/error options fall back to mock cards;
- assert apply replacement updates visible local UI only.

`/today` flag-enabled shopping derived:

- render shopping route under flag;
- resolve `buildDerivedShoppingList(planId, dayRange)`;
- assert derived grouped ingredients render;
- assert shopping periods `1`, `2`, `3`, and `7` remain usable;
- assert checkbox toggle affects only local DOM state.

## Fallback Coverage

Required mounted async fallback cases:

- default mode does not call `premiumCatalogService`;
- staging read mode with `supabase_unavailable` falls back to mock/demo;
- read failure falls back to mock/demo;
- empty active plan list falls back to `demoPlans`;
- incomplete plan detail falls back safely;
- empty meal slots fall back safely;
- failed recipe detail does not crash meal detail;
- empty replacement options fall back to mock replacement options;
- failed derived shopping falls back to mock shopping groups;
- loading/intermediate state does not render technical errors or break layout;
- technical strings such as `read_failed`, `supabase_unavailable`, stack traces, or raw Supabase messages are not visible.

## No-Write Coverage

Keep source guardrail tests and add mounted no-write assertions.

Source guardrails should assert absence of:

- `.insert(`;
- `.update(`;
- `.upsert(`;
- database `.delete(`;
- `.rpc(`;
- `user_premium_plan_selections`;
- `user_premium_meal_selections`;
- `food_diary_entries`;
- `public.recipes`;
- recipe import paths;
- shopping persistence paths;
- `premium_shopping_items`;
- `user_premium_shopping_checks`;
- AI/runtime paths;
- voice input paths;
- production config/query paths.

Mounted tests should assert:

- disabled actions remain disabled;
- mocked write functions are not called;
- replacement apply changes only local UI state;
- shopping checkbox changes only local UI state;
- no mocked service method outside approved read functions is called;
- no network/Supabase client is imported or exercised directly from page tests.

## Coverage Cases

Core cases:

- default mode does not call service;
- staging mode calls expected read functions;
- successful async read renders catalog-backed data;
- service unavailable/error/empty falls back to mock;
- loading state does not break layout;
- technical errors are not shown;
- disabled actions remain disabled/no-write;
- replacement apply remains local-only;
- shopping checkbox remains local-only;
- days 3-14 are not faked as DB data.

Additional useful cases:

- cancellation/unmount does not set stale state after promise resolution;
- switching plan/day clears or reuses cached catalog state predictably;
- detail route with unknown catalog recipe id falls back safely;
- derived shopping amounts are not multiplied twice;
- `/premium-recipes` remains separate from Today adapter wiring.

## Phased Implementation

Phase 1: test harness/utilities only

- Add a minimal mounted async harness.
- Add service/read-mode mocks.
- Add shared fixture builders.
- No runtime changes.

Phase 2: mounted async tests for `/premium-recipes`

- Cover flag-enabled library load.
- Cover flag-enabled detail load.
- Cover fallback/error/empty behavior.
- Cover disabled actions and no-write source guardrail.

Phase 3: mounted async tests for `/today` plan/day/meal

- Cover plan list/detail async reads.
- Cover day detail meal slot reads.
- Cover meal detail primary recipe reads.
- Cover days 1/2 only and no days 3-14 synthesis.

Phase 4: mounted async tests for replacements/shopping

- Cover replacement option reads and local-only apply.
- Cover derived shopping reads and local-only checkbox state.
- Cover fallback to mock replacements/shopping.

Phase 5: full no-write/source guardrail test pass

- Consolidate forbidden mutation/path checks.
- Run targeted Premium read-only suites.
- Run build and diff checks.

## Risks

- Adding a DOM harness may require a test-only dependency or setup file.
- Current static render tests may overlap with mounted tests; keep mounted tests focused on async effects and DOM interaction.
- Mocking ES module imports can be awkward under `tsx --test`; choose a small pattern and document it.
- Tests that assert exact call counts may be brittle if React strict-mode behavior is introduced later.
- Browser visual smoke still requires a separate browser-capable runner and authenticated staging session.

## Next Recommended Implementation Package

Recommended next package: **TODAY_PREMIUM_READ_ONLY_MOUNTED_ASYNC_TEST_IMPLEMENTATION**.

Scope:

- add mounted async/browser-style test harness and fixtures;
- mock `premiumCatalogService` and read-mode helper;
- cover `/premium-recipes` and `/today` flag-enabled success/fallback flows;
- keep tests no-write and staging-independent;
- do not change runtime behavior;
- do not use real staging auth/JWT/secrets;
- do not execute Supabase SQL;
- do not touch staging or production.

## Verification

- `git diff --check`
  - Result: passed.
- No runtime code changes.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No user/JWT/secrets collection.
- No visual smoke run.

## Final Verdict

**TODAY_PREMIUM_READ_ONLY_MOUNTED_ASYNC_TEST_PLAN_READY**
