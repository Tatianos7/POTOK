# Today Premium Recipe Library UI Mock

- Date: 2026-08-23
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_HOME_PAYWALL_MY_POTOK_DEPLOYED`
  - `TODAY_PREMIUM_PLAN_REPLACE_MEAL_FLOW_DEPLOYED`
  - `TODAY_PREMIUM_SHOPPING_LIST_FLOW_DEPLOYED`
- Verdict: **TODAY_PREMIUM_RECIPE_LIBRARY_UI_MOCK_READY**

## Scope

Implemented a UI-only Premium recipe library mock for POTOK Premium.

The Premium recipe library is intentionally separate from the existing user recipe area. Existing `/nutrition/recipes` remains the user-owned `Мои рецепты` surface and was not reused.

No DB/schema/storage, payment/auth, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, or PR work was done.

## Architecture Decision

Chosen route: `/premium-recipes`.

Reason:

- Home already exposes `Сборник рецептов` as a separate premium card after premium/demo access.
- A dedicated route keeps Premium `Готовые рецепты POTOK` separate from `/nutrition/recipes`.
- It avoids adding another nested mode to the already active `/today` plan/day/meal/shopping flow.
- The route is protected like other authenticated app screens.

## Changed Files

- `src/pages/PremiumRecipes.tsx`
- `src/App.tsx`
- `src/utils/constants.ts`
- `src/pages/__tests__/DashboardFeatureBadges.test.ts`
- `src/pages/__tests__/PremiumRecipes.test.tsx`
- `reports/today-premium-recipe-library-ui-mock-2026-08-23.md`

## Implemented UI

Home:

- after premium/demo access, `Сборник рецептов` routes to `/premium-recipes`;
- `Мой Поток` still routes to `/today`;
- `/nutrition/recipes` is not used for the Premium card.

Premium recipe library:

- centered title `Сборник рецептов`;
- X closes to Home;
- subtitle: `Готовые рецепты POTOK с КБЖУ, граммовками и подсказками без весов.`;
- category chips:
  - `Завтраки`;
  - `Обеды`;
  - `Ужины`;
  - `Перекусы`;
  - `Быстро`;
  - `Без сложной готовки`;
- compact mock recipe cards:
  - `Овсянка с бананом и йогуртом`;
  - `Курица с рисом и овощами`;
  - `Рыба с салатом`;
  - `Творог с ягодами`.

Recipe detail:

- back arrow returns to `Сборник рецептов`;
- centered category title, for example `Завтрак`;
- X closes to Home;
- recipe title;
- calories and macros;
- time and difficulty/note;
- ingredients with grams;
- portion hints without scales;
- short preparation steps;
- disabled/mock bottom actions:
  - `Добавить в план`;
  - `Добавить в дневник`.

## Mock Behavior

All recipe data lives in local static UI data in `PremiumRecipes.tsx`.

Clicking a recipe updates local component state and opens the detail view. No recipe service, recipe DB, diary write, plan write, AI generation, or shopping recalculation is called.

## Tests

Targeted tests passed:

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/pages/__tests__/DashboardFeatureBadges.test.ts src/pages/__tests__/PremiumRecipes.test.tsx`
- Result: `46/46` passed.

Covered:

- premium Home card shows `Сборник рецептов`;
- premium Home card routes to `/premium-recipes`;
- `/premium-recipes` route is registered;
- library screen renders title, subtitle, categories, and mock recipe cards;
- recipe click opens local detail view contract;
- detail renders macros, ingredients, hints, and preparation steps;
- bottom actions are disabled/mock;
- back returns to recipe library;
- `/nutrition/recipes` is not used;
- no diary/write/payment/AI/DB/real recipe runtime actions are introduced.

## Verification

- Targeted Home/Today/Premium recipe tests: passed, `46/46`.
- `npm run build`: passed.
- `git diff --check`: passed.

Build warnings observed:

- stale `baseline-browser-mapping`;
- stale Browserslist/caniuse data;
- existing Vite warning about mixed dynamic/static import of `mealService`;
- large chunk warning.

React SSR `useLayoutEffect` warnings from `MemoryRouter` were printed during render tests and did not fail the test run.

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

**TODAY_PREMIUM_RECIPE_LIBRARY_UI_MOCK_READY**
