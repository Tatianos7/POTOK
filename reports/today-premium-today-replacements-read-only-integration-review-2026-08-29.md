# Today Premium Today Replacements Read-Only Integration Review

- Date: 2026-08-29
- Branch: `master`
- Reviewed files:
  - `src/pages/Today.tsx`
  - `src/pages/__tests__/TodayPaidEntry.test.tsx`
  - `src/services/__tests__/premiumTodayAdapter.test.ts`
  - `reports/today-premium-today-replacements-read-only-integration-2026-08-29.md`
- Source readiness:
  - `TODAY_PREMIUM_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_READY`
- Verdict: **TODAY_PREMIUM_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_REVIEW_READY**

## Verdict

The `/today` replacement options read-only integration is ready to commit.

No blocker was found. Replacement reads are gated by `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, default mode keeps the existing mock `breakfastReplacementOptions`, staging replacement options are read through the reviewed Premium catalog service, and apply replacement remains local-only.

Readiness marker: **READY_FOR_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_COMMIT**.

## Files Reviewed

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `reports/today-premium-today-replacements-read-only-integration-2026-08-29.md`

Scope files checked and unchanged:

- `src/pages/PremiumRecipes.tsx`
- `src/App.tsx`
- `src/utils/constants.ts`
- SQL and seed files

## Feature Flag Review

Confirmed:

- default mode remains on mock replacement options;
- staging replacement reads are gated by `isPremiumCatalogStagingReadMode()`;
- staging replacement reads require an active catalog-backed plan/meal context;
- staging read-only mode calls `premiumCatalogService.getMealRecipeOptions(selectedMeal.catalogSlotId)`;
- replacement recipe details are loaded read-only through `premiumCatalogService.getPremiumRecipeDetail(option.recipeId)`;
- options are mapped through `mapMealRecipeOptionsToReplacementOptions()`;
- auth, payment, entitlement, dashboard, route, and production config behavior were not changed.

The flag remains opt-in. Without `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, the existing replacement mock list remains the rendered source.

## Replacement Behavior Review

Confirmed:

- replacement view renders the current mock list by default;
- catalog-backed replacement cards can render staging options when available;
- primary and replacement option types are preserved through the adapter mapping;
- `selectedReplacementId` remains local React state;
- selected replacement detail remains compatible with the existing `MealDetail` shape;
- meal detail after local replacement remains functional.

The implementation reads replacement recipe details only to enrich cards/details in memory. It does not persist the chosen replacement.

## Fallback Review

Confirmed:

- unavailable option reads fall back to mock replacement options;
- failed option reads fall back to mock replacement options;
- empty option reads fall back to mock replacement options;
- empty mapped replacement results fall back to mock replacement options;
- recipe detail read failures do not crash the replacement view;
- technical service/Supabase errors are not rendered to the user.

The fallback keeps the current UX instead of showing a technical error state.

## Local-Only Apply Review

Confirmed:

- `applyReplacement()` still updates only local `mealOverrides`;
- applying a replacement returns to `meal_detail`;
- no `user_premium_meal_selections` write path was added;
- no `user_premium_plan_selections` write path was added;
- shopping checkbox state remains local-only.

## Scope Review

Confirmed:

- shopping staging integration was not connected;
- shopping remains mock/local-only through `shoppingGroups`;
- `/premium-recipes` runtime was not changed;
- routes were not changed;
- constants were not changed;
- paywall/dashboard behavior was not changed;
- SQL and seed files were not changed;
- no Supabase SQL was executed;
- staging was not mutated;
- production was not touched.

## Read-Only Boundary Review

Confirmed by static review and tests:

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
- no production config or production query.

## Tests / Build Review

Today targeted test:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed, `46` tests.

Catalog adapter targeted test:

```text
npx tsx --test src/services/__tests__/premiumTodayAdapter.test.ts
```

Result: passed, `9` tests.

Catalog service targeted test:

```text
npx tsx --test src/services/__tests__/premiumCatalogService.test.ts
```

Result: passed, `4` tests.

Premium recipes targeted test:

```text
npx tsx --test src/pages/__tests__/PremiumRecipes.test.tsx
```

Result: passed, `9` tests.

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

- add mounted async tests for replacement effect resolution under the feature flag;
- keep shopping integration as a separate read-only package;
- keep user Premium selection writes blocked until behavioral RLS tests are executed;
- keep the source-level no-write guardrails in place.

## Readiness For Commit

**READY_FOR_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_COMMIT**

The package can be committed as `/today` replacements read-only staging integration. It should not be bundled with shopping, database, production, or write-path work.

## Final Verdict

**TODAY_PREMIUM_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_REVIEW_READY**
