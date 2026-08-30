# Today Premium Read-Only UX Polish Phase 2 Today States

- Date: 2026-08-30
- Branch: `master`
- Source Phase 1 commit: `816d0ca3b8bebb0d7209e6f578242f056cb9324b today premium read only ux polish phase 1`
- Target package: `TODAY_PREMIUM_READ_ONLY_UX_POLISH_PHASE_2_TODAY_STATES`
- Verdict: **TODAY_PREMIUM_READ_ONLY_UX_POLISH_PHASE_2_TODAY_STATES_READY**

## Scope

Implement `/today` loading/fallback/empty state polish for the Premium read-only flow.

This package changes `/today` UI state rendering only. It does not enable writes, does not change routes, does not change payment/entitlement/demo access behavior, does not change the feature flag contract, does not add Supabase writes, does not change RLS policies, does not run SQL, does not mutate staging, and does not touch production.

## Files Changed

Runtime UI surface:

- `src/pages/Today.tsx`

Tests updated for changed `/today` state contracts:

- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/pages/__tests__/TodayMountedAsync.test.tsx`
- `src/pages/__tests__/TodayReplacementsShoppingMountedAsync.test.tsx`

Report:

- `reports/today-premium-read-only-ux-polish-phase-2-today-states-2026-08-30.md`

No config, dependency, route, payment, SQL, seed, RLS, staging, or production files were changed.

## Loading State Changes

Added a small `CatalogReadStatus` state for `/today` catalog-read effects:

- `idle`;
- `loading`;
- `catalog`;
- `fallback`.

When a catalog read starts under the existing read-only feature flag, `/today` can render a lightweight message:

```text
Готовим план для просмотра...
```

The loading state is intentionally subdued. It is not a blocking purchase spinner and does not expose technical service details.

## Fallback State Changes

When catalog plan/day/meal reads fail, return empty, or cannot be mapped safely, the UI can render:

```text
Показываем демо-вариант.
```

Existing fallback behavior remains intact:

- mock/demo plans remain usable;
- catalog failures remain quiet;
- technical strings are not rendered;
- plan/day/meal read failures reset to demo-safe state.

## Empty State Changes

Added intentional empty states for incomplete `/today` data:

- plan list empty: `Планы пока не найдены. Показываем демо-вариант.`;
- plan detail without returned days: `Дни плана пока не найдены. Показываем демо-вариант.`;
- day detail without meal slots: `Блюда на этот день пока не найдены. Показываем демо-вариант.`;
- meal detail without ingredients: `Ингредиенты пока не заполнены. Ориентируйтесь на описание блюда.`;
- meal detail without hints: `Подсказки появятся, когда блюдо будет заполнено подробнее.`;
- meal detail without steps: `Шаги приготовления пока не заполнены.`;
- replacements empty: `Подходящие замены пока не найдены. Можно вернуться к блюду.`;
- shopping empty: `Список продуктов пока пуст. Показываем демо-вариант.`

The empty states are product-facing and avoid technical terms.

## Behavior Preserved

Confirmed:

- default `/today` mock/demo flow remains usable;
- feature flag contract is unchanged;
- catalog reads remain behind `isPremiumCatalogStagingReadMode()`;
- returned catalog days remain honest and are not synthesized as database days 3-14;
- replacement apply remains local-only through `mealOverrides`;
- shopping checkbox state remains local-only through `boughtProducts`;
- disabled `Подтвердить день` remains disabled/no-write;
- disabled `Добавить в дневник` remains disabled/no-write;
- no payment/entitlement/demo access behavior changed.

## Tests Updated

Updated tests assert:

- catalog read status source contract;
- fallback copy source contract;
- plan/day/meal empty state copy source contracts;
- meal ingredient/hint/step empty state copy source contracts;
- replacements empty state copy source contract;
- shopping empty state copy source contract;
- existing local-only replacement and shopping contracts remain intact.

## Tests / Build Result

Today targeted test:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed, `49` tests.

Today mounted async targeted test:

```text
npx tsx --test src/pages/__tests__/TodayMountedAsync.test.tsx
```

Result: passed, `8` tests.

Today replacements/shopping mounted async targeted test:

```text
npx tsx --test src/pages/__tests__/TodayReplacementsShoppingMountedAsync.test.tsx
```

Result: passed, `9` tests.

Premium recipes targeted test:

```text
npx tsx --test src/pages/__tests__/PremiumRecipes.test.tsx
```

Result: passed, `9` tests.

Premium recipes mounted async targeted test:

```text
npx tsx --test src/pages/__tests__/PremiumRecipesMountedAsync.test.tsx
```

Result: passed, `7` tests.

Paywall copy targeted test:

```text
npx tsx --test src/pages/__tests__/PaywallPremiumCopy.test.ts
```

Result: passed, `3` tests.

Harness/fixtures targeted test:

```text
npx tsx --test src/test/__tests__/premiumReadOnlyMountedAsyncHarness.test.ts
```

Result: passed, `7` tests.

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

Diff check:

```text
git diff --check
```

Result: passed.

Known non-failing warnings:

- missing Vite Supabase env warning in local fallback-safe tests;
- React Router SSR `useLayoutEffect` warnings in static render tests;
- Vite/Browserslist/chunk-size warnings during build.

## No-Write Confirmation

Confirmed:

- no `.insert(` was added;
- no `.update(` was added;
- no `.upsert(` was added;
- no database `.delete(` was added;
- no `.rpc(` was added;
- no `user_premium_plan_selections` writes;
- no `user_premium_meal_selections` writes;
- no `food_diary_entries` writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production config/query.

The only `.delete(` occurrence in the checked runtime surface remains the existing local `Set.delete(productKey)` checkbox state.

## Limitations

This package does not change the previously documented testing boundary:

- no full browser/Vite mounted async execution was added;
- no DOM dependency was added;
- no real Supabase table reads were made outside existing mocked/test flows;
- no authenticated staging visual smoke was run;
- no behavioral RLS tests were run.

Loading/fallback messages are covered by source-level contracts because the current `tsx --test` environment still does not execute the complete browser/Vite async effect flow under the feature flag.

## Next Recommended Step

Recommended next package: **TODAY_PREMIUM_READ_ONLY_UX_POLISH_PHASE_2_TODAY_STATES_REVIEW**.

Scope:

- review `/today` state rendering changes;
- confirm no write behavior changed;
- confirm feature flag, route, payment, config, dependency, SQL, staging, and production boundaries stayed unchanged;
- rerun targeted tests/build as needed;
- keep commit separate from RLS, SQL, staging, production, payment enforcement, or write-path work.

## Safety Confirmation

Confirmed:

- no runtime write behavior changes;
- no config/dependency changes;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no real table reads outside existing mocked/test flows;
- no secrets/JWT collection;
- no service-role keys;
- no RLS policy changes;
- no user Premium selections writes;
- no diary/workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR.

## Final Verdict

**TODAY_PREMIUM_READ_ONLY_UX_POLISH_PHASE_2_TODAY_STATES_READY**
