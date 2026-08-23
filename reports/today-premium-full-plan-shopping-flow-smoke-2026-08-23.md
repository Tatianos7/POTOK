# Today Premium Full Plan Shopping Flow Smoke

- Date: 2026-08-23
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_PLAN_REPLACE_MEAL_FLOW_DEPLOYED`
  - `TODAY_PREMIUM_SHOPPING_LIST_UI_MOCK_READY`
- Verdict: **TODAY_PREMIUM_FULL_PLAN_SHOPPING_FLOW_SMOKE_READY**

## Scope

Smoke verification of the current Premium `Мой Поток` flow inside `/today` after adding the local/mock shopping list screen.

No runtime code changes were made during this smoke pass. No DB/schema/storage, payment/auth, diary/workout writes, recipe import, real shopping list runtime, AI runtime, voice input, or PR work was done.

## Verified Flow

`/today` existing-goal/demo state:

- shows `Мой Поток`;
- shows the active goal;
- shows the weight progress bar;
- shows compact plan rows.

Plan detail:

- clicking a compact plan row opens the selected plan screen;
- selected plan title is rendered;
- days `День 1` through `День 14` are rendered;
- CTA `Выбрать план` is covered by targeted layout checks and does not cover the day list.

Day detail:

- clicking a day row opens the day screen;
- daily macros are rendered;
- meal rows are rendered:
  - `Завтрак`;
  - `Обед`;
  - `Ужин`;
  - `Перекус`;
- workout summary is rendered;
- day state selector is rendered;
- `Список покупок` is visible and opens the shopping list screen.

Shopping list:

- `Список покупок` opens a separate shopping list view;
- period selector renders:
  - `1 день`;
  - `2 дня`;
  - `3 дня`;
  - `7 дней`;
- product groups render:
  - `Белок`;
  - `Овощи`;
  - `Крупы`;
  - `Фрукты`;
  - `Молочные`;
  - `Другое`;
- products are rendered once per group, without duplicates for longer periods;
- mock quantities change by selected period;
- checkbox bought state toggles locally;
- back action returns to day detail.

Meal detail:

- clicking a meal row opens meal detail;
- meal macros are rendered;
- ingredients with grams are rendered;
- portion hints are rendered;
- preparation steps are rendered;
- bottom actions are covered by targeted layout checks and do not cover content.

Replace meal:

- `Заменить блюдо` opens the replace screen;
- filter chips and replacement options render;
- selecting a replacement enables `Выбрать замену`;
- confirming returns to meal detail with updated local/mock meal data.

Back navigation:

- shopping list -> day detail;
- replace -> meal detail;
- meal detail -> day detail;
- day detail -> plan detail;
- plan detail -> `Мой Поток`.

## Negative Checks

Verified absent from the current `/today` Premium plan flow:

- diary write actions;
- payment/auth mutation actions;
- AI runtime actions;
- recipe DB/runtime actions;
- real shopping list backend/runtime actions;
- `План ≠ запись в дневнике`;
- `Ваши планы на 14 дней`;
- `Редактировать цель`.

## Test Results

Targeted Today tests passed:

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx`
- Result: `35/35` passed.

Notes:

- React SSR `useLayoutEffect` warnings from `MemoryRouter` were printed during render tests.
- These warnings are existing test-environment noise and did not fail the smoke.
- Playwright browser smoke was not required for this pass; targeted render/source tests plus production build covered the requested auth-guarded flow contract.

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
- No real shopping list runtime.
- No AI runtime.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_FULL_PLAN_SHOPPING_FLOW_SMOKE_READY**
