# Today Premium Today Shopping Derived Read-Only Integration

- Date: 2026-08-29
- Branch: `master`
- Source commits:
  - `c73a14b today premium today replacements read only integration`
  - `35ff026 today premium today day meal detail read only integration`
  - `52cfdec today premium read only catalog service`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **TODAY_PREMIUM_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_READY**

## Scope

Connected `/today` shopping list to Premium catalog data as a derived read-only, in-memory list under the existing feature flag.

This package does not execute Supabase SQL, mutate staging, touch production, create shopping persistence, create shopping source-of-truth tables, create user Premium selections, write diary/workout rows, write `public.recipes`, import recipes, add AI/runtime rows, add voice input, create a PR, or commit/push changes.

## Files Changed

- `src/pages/Today.tsx`
- `src/services/premiumTodayAdapter.ts`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `reports/today-premium-today-shopping-derived-read-only-integration-2026-08-29.md`

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

- shopping list uses the existing `shoppingGroups`;
- shopping period multiplication keeps the existing mock behavior;
- checkbox state remains local-only through `boughtProducts`;
- no shopping catalog reads are active outside the approved staging read-only path.

Staging read-only behavior:

- catalog-backed `shopping_list` keeps the selected catalog plan context;
- shopping reads through `premiumCatalogService.buildDerivedShoppingList(selectedPlan.id, dayRange)`;
- `dayRange` is derived from the currently selected day and selected shopping period;
- returned ingredients are mapped through `premiumTodayAdapter.mapDerivedShoppingListToShoppingGroups()`;
- derived shopping amounts are treated as already aggregated for the selected day range.

The flag does not change auth, payment, entitlement, dashboard, routes, or production configuration.

## Shopping Derived Behavior

Confirmed behavior:

- the shopping list remains the same screen and layout;
- periods `1`, `2`, `3`, and `7` days still work as local UI state;
- catalog shopping reads use the selected day as `startDay`;
- catalog shopping reads use `selectedDay + shoppingPeriod - 1` as `endDay`;
- mapped derived products render through the existing shopping group UI shape;
- derived products remain in memory only;
- no shopping source-of-truth table is introduced.

## Fallback Behavior

Fallback remains non-technical:

- disabled read mode keeps the mock shopping list;
- unavailable or failed derived shopping reads keep the mock shopping list;
- empty derived shopping reads keep the mock shopping list;
- empty mapped shopping groups keep the mock shopping list;
- technical read errors are caught and are not rendered to users.

The page avoids a persistent or mixed write state. If the derived list is not usable, the existing mock UX stays in place.

## Local-Only Checkbox Confirmation

Confirmed:

- `boughtProducts` remains local React state only;
- checkbox toggles still call `toggleBoughtProduct(productKey)`;
- the only `.delete(` in `Today.tsx` remains existing local `Set.delete(productKey)` state handling;
- checkbox state is not written to Supabase or any shopping table.

## No-Write Confirmation

Confirmed boundaries:

- no `.insert(` calls;
- no `.update(` calls;
- no `.upsert(` calls;
- no `.rpc(` calls;
- no database `.delete(` calls;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no user Premium selection writes;
- no diary/workout writes;
- no `public.recipes` writes;
- no `recipe_ingredients` writes;
- no recipe import;
- no shopping persistence;
- no AI/runtime integration;
- no voice input;
- no production config/query.

## Tests Run

Today targeted test:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed, `49` tests.

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

## Premium Recipes Confirmation

Confirmed `/premium-recipes` runtime was not changed by this package.

The `/premium-recipes` targeted test passed after the shopping integration, and static diff review showed no changes to `src/pages/PremiumRecipes.tsx`.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_REVIEW`.

Scope:

- review derived shopping read-only integration;
- confirm shopping remains in-memory only;
- confirm no shopping persistence or source-of-truth tables were introduced;
- confirm `/premium-recipes`, routes, dashboard, SQL, staging, and production remain unchanged;
- keep user Premium selection writes blocked until behavioral RLS tests are executed.

## Final Verdict

**TODAY_PREMIUM_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_READY**
