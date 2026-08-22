# Today Premium Home Access UI Mock

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_ACCESS_PLAN_DAY_14_DAY_SYSTEM_SPEC_READY`
  - `TODAY_PREMIUM_ACCESS_PLAN_DAY_OWNER_AMENDMENTS_READY`
  - `TODAY_PREMIUM_EXISTING_ROUTES_AND_SCREENS_AUDIT_READY`
  - `HOME_REMOVE_PREMIUM_BADGES_FROM_WORKOUTS_PROGRESS_READY`
- Verdict: **TODAY_PREMIUM_HOME_ACCESS_UI_MOCK_PACKAGE_READY**

## Scope

Minimal Home access UI mock for POTOK Premium / `Мой Поток`.

Implemented subscription-state card branching on Home and a minimal `/paywall` copy cleanup. No real payment, subscription mutation, auth/access, DB/schema/storage, diary/workout writes, recipe import, premium recipe catalog, AI runtime, voice input, or PR work was done.

## Changed Files

- `src/utils/constants.ts`
- `src/data/features.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/Paywall.tsx`
- `src/pages/__tests__/DashboardFeatureBadges.test.ts`
- `src/pages/__tests__/PaywallPremiumCopy.test.ts`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`

## Before-Purchase Home Behavior

When `user.hasPremium === false`, Home now shows the first premium entry as:

- title: `POTOK Premium`
- subtitle: `Готовый план питания и тренировок под вашу цель`
- route: `/paywall`

No separate `Сборник рецептов` card is shown before Premium.

## After-Purchase Home Behavior

When `user.hasPremium === true`, the same first Home card becomes:

- title: `Мой Поток`
- subtitle: `Ваше питание, тренировки и рекомендации на сегодня`
- route: `/today`

An additional premium recipe entry appears:

- title: `Сборник рецептов`
- subtitle: `Готовые рецепты с КБЖУ и граммовками`
- route: `/today`

The recipe entry intentionally does not route to `/nutrition/recipes`, because the existing nutrition recipes screen is user-created recipes and must not be mixed with Premium ready recipes.

## Home Adapter

Added `getHomeFeatureCards({ hasPremium })` in `src/utils/constants.ts`.

`Dashboard` now renders cards from this helper instead of rendering the static `FEATURE_CARDS` array directly.

The existing baseline cards remain unchanged:

- `ЦЕЛЬ`
- `ЗАМЕРЫ`
- `ПИТАНИЕ`
- `ТРЕНИРОВКИ`
- `ПРОГРЕСС`

`ТРЕНИРОВКИ` and `ПРОГРЕСС` remain non-premium and do not get `PREMIUM` badges.

## Paywall Copy Cleanup

`/paywall` was updated to remove pre-runtime AI/Coach selling promises.

The Premium value proposition now focuses on:

- `Меньше думайте — больше выполняйте.`
- ready nutrition and workout plans under the user's goal;
- recipes with calories/macros and grams;
- meal replacements;
- shopping list later;
- visual hints for users without scales.

CTA copy is now:

- `Оформить подписку`

No real payment flow was implemented or changed.

## Tests Run

- `npx tsx --test src/pages/__tests__/DashboardFeatureBadges.test.ts src/pages/__tests__/PaywallPremiumCopy.test.ts src/pages/__tests__/TodayPaidEntry.test.tsx` — passed.
- `git diff --check` — passed.

Notes:

- Today render tests still print existing React Router SSR `useLayoutEffect` warnings. Tests pass.

## Build Result

- `npm run build` — passed.

Build completed with existing Vite/Browserslist/chunk-size warnings only.

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No payment implementation.
- No subscription mutation changes.
- No auth/access changes.
- No diary/workout writes.
- No recipe import.
- No premium recipe catalog implementation.
- No AI runtime.
- No voice input.
- No PR.

## Known Limitations

- `Сборник рецептов` is a Home UI entry only and routes to `/today` as a safe placeholder.
- `/paywall` CTA copy is updated, but real subscription/payment routing is not implemented in this package.
- `src/data/features.ts` remains a parallel feature list and can drift from `src/utils/constants.ts` unless future work centralizes Home card data.
- Premium recipe catalog still needs a separate owner-approved model and route.

## Final Verdict

**TODAY_PREMIUM_HOME_ACCESS_UI_MOCK_PACKAGE_READY**
