# Today Premium Today Replacements Read-Only Integration

- Date: 2026-08-29
- Branch: `master`
- Source commits:
  - `35ff026 today premium today day meal detail read only integration`
  - `5fce76c today premium today read only adapter`
  - `52cfdec today premium read only catalog service`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **TODAY_PREMIUM_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_READY**

## Scope

Connected `/today` replacement options to Premium catalog data in read-only mode under the existing feature flag.

This package does not execute Supabase SQL, mutate staging, touch production, create user Premium selections, write diary/workout rows, write `public.recipes`, import recipes, persist shopping data, add AI/runtime rows, add voice input, create a PR, or commit/push changes.

## Files Changed

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `reports/today-premium-today-replacements-read-only-integration-2026-08-29.md`

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

- replacement view uses existing `breakfastReplacementOptions`;
- no replacement catalog service calls are active outside the approved staging read-only path;
- existing `/today` layout and copy are preserved.

Staging read-only behavior:

- catalog-backed `replace_meal` keeps the selected catalog plan/day/meal context;
- replacement options read through `premiumCatalogService.getMealRecipeOptions(selectedMeal.catalogSlotId)`;
- recipe details for replacement cards are read through `premiumCatalogService.getPremiumRecipeDetail(option.recipeId)`;
- replacement option rows are mapped through `premiumTodayAdapter.mapMealRecipeOptionsToReplacementOptions()`;
- primary and replacement cards can render from staging data when available.

The flag does not change auth, payment, entitlement, dashboard, routes, or production configuration.

## Replacement Behavior

Confirmed behavior:

- replacement list remains available in default mock mode;
- staging replacement cards use catalog option ids as local selection ids;
- primary and replacement option types are preserved in mapped option data;
- card summary/calories/macros can come from Premium recipe detail;
- selected replacement remains local React state;
- technical read errors are not rendered to users.

## Fallback Behavior

Fallback remains non-technical:

- disabled read mode keeps the mock replacement list;
- unavailable or failed option reads keep the mock replacement list;
- empty option reads keep the mock replacement list;
- empty mapped replacements keep the mock replacement list;
- recipe detail read failures do not crash the replacement view;
- selection is reset locally if replacement loading fails.

## Local-Only Apply Confirmation

`applyReplacement()` still updates only local `mealOverrides` and returns to `meal_detail`.

It does not write:

- `user_premium_meal_selections`;
- `user_premium_plan_selections`;
- diary entries;
- workout entries;
- shopping state;
- recipe/import tables.

Meal detail after a local replacement remains functional because replacement options are mapped into the existing `MealDetail` shape.

## No-Write Confirmation

Confirmed boundaries:

- no `.insert(` calls;
- no `.update(` calls;
- no `.upsert(` calls;
- no `.rpc(` calls;
- no database `.delete(` calls;
- the only `.delete(` in `Today.tsx` remains existing local `Set.delete(productKey)` checkbox state;
- no user Premium selection writes;
- no diary/workout writes;
- no `public.recipes` writes;
- no `recipe_ingredients` writes;
- no recipe import;
- no shopping persistence;
- no AI/runtime integration;
- no voice input;
- no production config/query.

## Shopping And Premium Recipes Scope

Confirmed:

- shopping staging integration is not connected;
- shopping remains local/mock through `shoppingGroups`;
- shopping checkbox state remains local-only;
- `/premium-recipes` runtime was not changed;
- routes, constants, paywall, dashboard, SQL, and seed files were not changed.

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

Diff check:

```text
git diff --check
```

Result: passed.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_REVIEW`.

Scope:

- review replacement options read-only staging integration;
- confirm apply remains local-only;
- confirm shopping remains mock/local-only;
- confirm `/premium-recipes`, routes, dashboard, SQL, staging, and production remain unchanged;
- keep user Premium selection writes blocked until behavioral RLS tests are executed.

## Final Verdict

**TODAY_PREMIUM_TODAY_REPLACEMENTS_READ_ONLY_INTEGRATION_READY**
