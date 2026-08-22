# Home Remove Premium Badges From Workouts Progress

- Date: 2026-08-22
- Branch: `master`
- Verdict: **HOME_REMOVE_PREMIUM_BADGES_FROM_WORKOUTS_PROGRESS_READY**

## Scope

Removed the visible `PREMIUM` badge from the Home/Dashboard feature cards for:

- `ТРЕНИРОВКИ`;
- `ПРОГРЕСС`.

No runtime access, auth, payment, TODAY Premium, diary, Progress Daily Goal, DB, schema, storage, or migration work was done.

## Changed Files

- `src/utils/constants.ts`
- `src/data/features.ts`
- `src/pages/__tests__/DashboardFeatureBadges.test.ts`

## Where The Badges Were

The Home screen renders feature cards from `FEATURE_CARDS` in `src/utils/constants.ts` through `FeatureCard`.

`FeatureCard` shows `PREMIUM` when:

- `card.isPremium === true`;
- current user does not have premium.

The mirrored `src/data/features.ts` data also had `isPremium: true` for `ТРЕНИРОВКИ` and `ПРОГРЕСС`.

## What Was Removed

For `ТРЕНИРОВКИ`:

- changed `isPremium` from `true` to `false`;
- removed `premiumColor: 'green'` from dashboard constants.

For `ПРОГРЕСС`:

- changed `isPremium` from `true` to `false`;
- removed `premiumColor: 'yellow'` from dashboard constants.

## Routes And Access

Routes were not changed:

- `ТРЕНИРОВКИ` still routes to `/workouts`;
- `ПРОГРЕСС` still routes to `/progress`.

Auth/access logic was not changed. The `FeatureCard` component and Dashboard navigation behavior were left intact.

## Tests Run

- `npx tsx --test src/pages/__tests__/DashboardFeatureBadges.test.ts` — passed.
- `git diff --check` — passed.

## Build Result

- `npm run build` — passed.

Build completed with existing Vite/Browserslist chunk-size and data-age warnings only.

## Final Status

`ТРЕНИРОВКИ` and `ПРОГРЕСС` now render as baseline Home sections without `PREMIUM` badges. Premium positioning remains reserved for TODAY Premium, Smart Day, ready programs, ready recipes, and AI support.

## Verdict

**HOME_REMOVE_PREMIUM_BADGES_FROM_WORKOUTS_PROGRESS_READY**
