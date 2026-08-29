# Today Premium Today Shopping Derived Read-Only Integration Review

- Date: 2026-08-29
- Branch: `master`
- Reviewed files:
  - `src/pages/Today.tsx`
  - `src/services/premiumTodayAdapter.ts`
  - `src/pages/__tests__/TodayPaidEntry.test.tsx`
  - `src/services/__tests__/premiumTodayAdapter.test.ts`
  - `reports/today-premium-today-shopping-derived-read-only-integration-2026-08-29.md`
- Source readiness:
  - `TODAY_PREMIUM_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_READY`
- Verdict: **TODAY_PREMIUM_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_REVIEW_READY**

## Verdict

The `/today` shopping derived read-only integration is ready to commit.

No blocker was found. Shopping reads are gated by `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, default mode keeps the existing mock `shoppingGroups`, staging shopping data is derived read-only through the reviewed Premium catalog service, and checkbox state remains local-only.

Readiness marker: **READY_FOR_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_COMMIT**.

## Files Reviewed

- `src/pages/Today.tsx`
- `src/services/premiumTodayAdapter.ts`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- `reports/today-premium-today-shopping-derived-read-only-integration-2026-08-29.md`

Scope files checked and unchanged:

- `src/pages/PremiumRecipes.tsx`
- `src/App.tsx`
- `src/utils/constants.ts`
- SQL and seed files

## Feature Flag Review

Confirmed:

- default mode remains on mock `shoppingGroups`;
- staging shopping reads are gated by `isPremiumCatalogStagingReadMode()`;
- staging shopping reads require an active catalog-backed plan context;
- staging read-only mode calls `premiumCatalogService.buildDerivedShoppingList(selectedPlan.id, dayRange)`;
- no raw Supabase client import was added to `Today.tsx`;
- auth, payment, entitlement, dashboard, route, and production config behavior were not changed.

The flag remains opt-in. Without `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, the existing mock shopping list remains the rendered source.

## Shopping Derived Review

Confirmed:

- shopping list is built as derived, in-memory UI state;
- the `1`, `2`, `3`, and `7` day periods remain local UI state;
- catalog day range is derived from `selectedDay` and `shoppingPeriod`;
- derived items are mapped through `mapDerivedShoppingListToShoppingGroups()`;
- mapped products keep the existing `ShoppingGroup` / `ShoppingProduct` shape;
- derived catalog amounts are marked as already aggregated so the UI does not multiply them a second time;
- no shopping persistence or source-of-truth table was introduced.

## Fallback Review

Confirmed:

- disabled read mode falls back to mock `shoppingGroups`;
- unavailable derived shopping reads fall back to mock `shoppingGroups`;
- failed derived shopping reads fall back to mock `shoppingGroups`;
- empty derived shopping reads fall back to mock `shoppingGroups`;
- empty mapped shopping groups fall back to mock `shoppingGroups`;
- technical service/Supabase errors are caught and are not rendered to the user.

The fallback remains calm and preserves the existing shopping UX.

## Local-Only Checkbox Review

Confirmed:

- `boughtProducts` remains local React state;
- checkbox toggles still call `toggleBoughtProduct(productKey)`;
- checked items are not persisted;
- no `premium_shopping_items` path exists;
- no `user_premium_shopping_checks` path exists;
- the only `.delete(` in `Today.tsx` remains the existing local `Set.delete(productKey)` checkbox state update.

## Scope Review

Confirmed:

- `/premium-recipes` runtime was not changed;
- routes were not changed;
- constants were not changed;
- paywall/dashboard behavior was not changed;
- SQL and seed files were not changed;
- user Premium selections were not connected;
- diary/workout writes were not connected;
- AI/runtime was not connected;
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
- no `user_premium_plan_selections` writes;
- no `user_premium_meal_selections` writes;
- no `food_diary_entries` writes;
- no workout writes;
- no `public.recipes` writes;
- no recipe import;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no shopping persistence;
- no AI/runtime integration;
- no voice input;
- no production config or production query.

## Tests / Build Review

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

## Blockers / Recommended Fixes

No blocker found.

Recommended but non-blocking before broader `/today` rollout:

- add mounted async tests for derived shopping effect resolution under the feature flag;
- keep shopping persistence out of scope until a separate owner-approved package and RLS tests exist;
- keep user Premium selection writes blocked until behavioral RLS tests are executed;
- keep the source-level no-write guardrails in place.

## Readiness For Commit

**READY_FOR_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_COMMIT**

The package can be committed as `/today` shopping derived read-only staging integration. It should not be bundled with database, production, shopping persistence, user selection writes, diary/workout writes, recipe import, AI, or voice work.

## Final Verdict

**TODAY_PREMIUM_TODAY_SHOPPING_DERIVED_READ_ONLY_INTEGRATION_REVIEW_READY**
