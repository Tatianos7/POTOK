# Today Premium Recipe Library Flow Smoke

- Date: 2026-08-23
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_RECIPE_LIBRARY_UI_MOCK_READY`
  - `TODAY_PREMIUM_SHOPPING_LIST_FLOW_DEPLOYED`
- Verdict: **TODAY_PREMIUM_RECIPE_LIBRARY_FLOW_SMOKE_READY**

## Scope

Smoke verification of the Premium `Сборник рецептов` UI mock flow.

No runtime code changes were made during this smoke pass. No DB/schema/storage, payment/auth, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, or PR work was done.

## Verified Flow

Home premium/demo state:

- premium Home card `Сборник рецептов` is present after premium/demo access;
- the card routes to `/premium-recipes`;
- `/nutrition/recipes` is not used for the Premium recipe library card.

Premium recipes library:

- title `Сборник рецептов` renders;
- subtitle about ready POTOK recipes renders;
- categories render:
  - `Завтраки`;
  - `Обеды`;
  - `Ужины`;
  - `Перекусы`;
  - `Быстро`;
  - `Без сложной готовки`;
- recipe cards render:
  - `Овсянка с бананом и йогуртом`;
  - `Курица с рисом и овощами`;
  - `Рыба с салатом`;
  - `Творог с ягодами`.

Recipe detail:

- clicking a recipe opens local detail view by component state contract;
- detail shows recipe title;
- detail shows calories and macros;
- detail shows ingredients with grams;
- detail shows portion hints without scales;
- detail shows cooking steps;
- bottom actions are present and disabled/mock:
  - `Добавить в план`;
  - `Добавить в дневник`.

Navigation:

- back arrow returns from recipe detail to recipe library;
- X closes safely to Home according to the current app pattern.

## Negative Checks

Verified absent from the Premium recipe library implementation:

- diary writes;
- real recipe DB writes;
- `/nutrition/recipes` route usage;
- payment/auth mutations;
- AI runtime;
- shopping list recalculation;
- schema/storage changes.

## Test Results

Targeted tests passed:

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/pages/__tests__/DashboardFeatureBadges.test.ts src/pages/__tests__/PremiumRecipes.test.tsx`
- Result: `46/46` passed.

Notes:

- React SSR `useLayoutEffect` warnings from `MemoryRouter` were printed during render tests.
- These warnings did not fail the smoke.

## Build And Checks

- `npm run build`: passed.
- `git diff --check`: passed.

Build warnings observed:

- stale `baseline-browser-mapping`;
- stale Browserslist/caniuse data;
- existing Vite warning about mixed dynamic/static import of `mealService`;
- large chunk warning.

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No payment/auth changes.
- No diary/workout writes.
- No recipe import.
- No real recipe runtime.
- No real shopping list runtime.
- No AI runtime.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_RECIPE_LIBRARY_FLOW_SMOKE_READY**
