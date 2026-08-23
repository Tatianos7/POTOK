# Today Premium Shopping List UI Mock

- Date: 2026-08-23
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_PLAN_REPLACE_MEAL_FLOW_DEPLOYED`
- Verdict: **TODAY_PREMIUM_SHOPPING_LIST_UI_MOCK_READY**

## Scope

Implemented a UI-only mock shopping list flow inside `/today` for the Premium `Мой Поток` day detail screen.

No DB/schema/storage, payment/auth, diary/workout writes, recipe import, real shopping list runtime, AI runtime, voice input, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-shopping-list-ui-mock-2026-08-23.md`

## Implemented UI

The day detail button `Список покупок` now opens a separate local `shopping_list` view.

Shopping list screen:

- back arrow returns to day detail;
- centered title: `Список покупок`;
- X closes back to Home;
- period selector:
  - `1 день`;
  - `2 дня`;
  - `3 дня`;
  - `7 дней`;
- helper text: `Выберите дни, для которых собрать продукты.`;
- compact grouped product list:
  - `Белок`;
  - `Овощи`;
  - `Крупы`;
  - `Молочные`;
  - `Фрукты`;
  - `Другое`;
- local checkboxes for bought state.

## Mock Aggregation

The list uses local mock base quantities and multiplies them by the selected period.

Examples:

- `Курица — 200 г` for `1 день`;
- `Курица — 400 г` for `2 дня`;
- `Банан — 1 шт` for `1 день`;
- `Банан — 2 шт` for `2 дня`;
- `Банан — 7 шт` for `7 дней`.

Products are rendered once per group with summed quantity. No duplicate rows are introduced for multiple days.

## Local Mock Behavior

Checkboxes update local component state only.

Not implemented intentionally:

- real aggregation from recipe DB;
- shopping backend/storage;
- reminders in the plan;
- day/meal runtime recalculation.

## Tests

Targeted Today tests passed:

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx`

Covered:

- `Список покупок` opens shopping list screen;
- period selector renders `1/2/3/7` day options;
- helper text renders;
- product groups render;
- mock quantities aggregate by selected period;
- same product is not duplicated for multiple days;
- checkbox local toggle contract exists;
- back returns to day detail;
- no diary/write/payment/AI/DB actions are introduced.

## Verification

- Targeted Today tests: passed, `35/35`.
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

**TODAY_PREMIUM_SHOPPING_LIST_UI_MOCK_READY**
