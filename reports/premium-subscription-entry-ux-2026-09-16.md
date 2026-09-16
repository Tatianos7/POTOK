# Premium Subscription Entry UX

- Date: 2026-09-16
- Branch: `master`
- Source gate commit: `df3d424d87148061f2539f895b23f8ad12c70006`
- Target package: `POTOK_PREMIUM_PAYWALL_DEMO_PRIMARY_UX`
- Verdict: **POTOK_PREMIUM_PAYWALL_DEMO_PRIMARY_UX_READY**

## Scope

Add clear, secondary Premium discovery paths for authenticated Free users without changing payment, demo access, Premium route enforcement, or Premium business logic.

## Changes

Free Home now renders a compact Premium CTA after the existing daily goal and main result content:

- title: `POTOK Premium`;
- value proposition: `Готовый план питания и тренировок под вашу цель`;
- action: `Узнать про Premium`;
- route: `/paywall`.

For a confirmed Free/no-goal state, Dashboard reuses the existing embedded Today no-goal surface. It keeps `Рассчитать цель` and `Создать замеры` as the first two actions, then renders one softer Premium entry below them:

- title: `POTOK Premium`;
- value proposition: `Готовый план питания и тренировок после расчёта цели`;
- action: `Узнать про Premium`;
- route: `/paywall`.

The regular CTA remains in the existing Free Dashboard branch for users whose goal state is not the confirmed no-goal state. The two branches are mutually exclusive, so one screen does not render duplicate subscription entries. Real Premium and approved demo Premium users continue to see the embedded Today surface without a subscribe CTA.

Bottom Navigation visible items remain unchanged. The compact `Ещё` menu now contains:

- Free: `Premium`, `Замеры`, `Прогресс`, `Профиль`;
- Premium/demo: `Сборник рецептов`, `Замеры`, `Прогресс`, `Профиль`.

The Free `Premium` item opens the existing `/paywall`. Premium/demo users do not receive a duplicate subscribe entry.

The Paywall now presents the currently available action honestly:

- `Посмотреть демо Premium` is the single primary CTA and still enables only the existing local demo access before opening `/today`;
- `Оформление подписки скоро` and `Покупки скоро` remain disabled secondary actions;
- the supporting copy states that demo access requires no purchase, does not grant paid access, and does not confirm payment;
- Free diaries, measurements, and Progress remain explicitly available.

## Preserved Behavior

- the no-goal Today state keeps `Рассчитать цель` before `Создать замеры`;
- `/today` and `/premium-recipes` keep the existing `PremiumRoute` gate;
- `/paywall` remains available to authenticated Free users;
- demo Premium behavior is unchanged;
- no payment promises or purchase implementation were added;
- no planned data or diary writes were added.

## Files Changed

- `src/pages/Dashboard.tsx`;
- `src/pages/Today.tsx`;
- `src/pages/Paywall.tsx`;
- `src/components/AppBottomNavigation.tsx`;
- `src/components/__tests__/AppBottomNavigation.test.tsx`;
- `src/pages/__tests__/DashboardFeatureBadges.test.ts`;
- `src/pages/__tests__/PaywallPremiumCopy.test.ts`;
- `src/pages/__tests__/TodayPaidEntry.test.tsx`;
- `reports/premium-subscription-entry-ux-2026-09-16.md`.

## Verification

- Related Dashboard, Bottom Navigation, Paywall, PremiumRoute, Today, Premium Recipes, and demo-access tests: passed, 94/94.
- `npm run build`: passed.
- `git diff --check`: passed.

Existing React SSR `useLayoutEffect`, local missing Supabase environment, bundle-size, browser-data, and mixed import warnings remain non-blocking. No secrets were requested.

## Safety Confirmation

- no payment logic changes;
- no demo Premium logic changes;
- no PremiumRoute changes;
- no SQL execution;
- no Supabase, staging, or production mutation;
- no DB schema or RLS changes;
- no Premium planned data or diary writes;
- no recipe logic changes;
- no PR;
- no commit.

## Final Verdict

**POTOK_PREMIUM_PAYWALL_DEMO_PRIMARY_UX_READY**
