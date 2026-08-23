# Today Premium Meal Detail UI Mock

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_PLAN_DAY_UI_MOCK_READY`
  - `TODAY_PREMIUM_PLAN_DAY_VISUAL_POLISH_READY`
- Verdict: **TODAY_PREMIUM_MEAL_DETAIL_UI_MOCK_READY**

## Scope

Implemented a UI/mock-only meal detail view inside `/today` `Мой Поток`.

No DB/schema/storage, payment, auth, diary, workout, recipe import, shopping-list runtime, AI, voice, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-meal-detail-ui-mock-2026-08-22.md`

Related uncommitted reports from previous `/today` Premium packages remain present:

- `reports/today-premium-plan-detail-14-day-ui-mock-2026-08-22.md`
- `reports/today-premium-plan-detail-14-day-visual-polish-2026-08-22.md`
- `reports/today-premium-plan-day-ui-mock-2026-08-22.md`
- `reports/today-premium-plan-day-visual-polish-2026-08-22.md`

## New Meal Detail Behavior

From a day detail screen, clicking `Завтрак`, `Обед`, `Ужин`, or `Перекус` opens a separate meal detail view inside `/today`.

Meal detail structure:

- back arrow on the left returns to the day screen;
- centered title with meal type, for example `Завтрак`;
- close `X` on the right;
- meal name, for example `Овсянка, банан, йогурт`;
- meal calories, for example `410 ккал`;
- meal macros, for example `Б 24 · Ж 10 · У 58`;
- compact ingredients with grams:
  - `Овсянка — 50 г`;
  - `Банан — 100 г`;
  - `Йогурт — 150 г`;
- compact no-scale hints:
  - `Без весов: используйте примерный ориентир.`;
  - `Банан 100 г ≈ 1 средний банан`;
  - `Овсянка 50 г ≈ несколько столовых ложек`;
  - `Йогурт 150 г ≈ небольшой стакан`;
- short preparation steps:
  1. `Смешайте овсянку и йогурт.`
  2. `Добавьте банан.`
  3. `Оставьте на несколько минут или ешьте сразу.`
- bottom actions:
  - `Заменить блюдо` mock/local;
  - `Добавить в дневник` disabled/mock.

## Mock Boundaries

- `Заменить блюдо` is UI-only for now.
- `Добавить в дневник` is disabled/mock and does not write data.
- Meal detail does not use real recipe DB.
- Shopping list runtime is not implemented.
- Full recipe detail is not implemented.
- No AI generation or runtime is connected.

## Tests

Targeted Today tests passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result:

- `27/27` tests passed.
- Existing React Router SSR `useLayoutEffect` warnings remained non-blocking.

Covered:

- meal row click opens meal detail by local state contract;
- meal detail shows meal title and dish name;
- meal detail shows calories and macros;
- meal detail shows ingredients with grams;
- meal detail shows no-scale portion hints;
- meal detail shows preparation steps;
- `Заменить блюдо` is present;
- `Добавить в дневник` is present as disabled/mock;
- back returns to day screen;
- no diary/write/payment/AI/Coach/voice runtime paths are called.

## Build

Build passed:

```text
npm run build
```

Notes:

- Existing `baseline-browser-mapping` / Browserslist staleness warnings.
- Existing Vite mixed dynamic/static import warning for `src/services/mealService.ts`.
- Existing large chunk warning.
- GitHub Pages fallback was generated.

Diff hygiene passed:

```text
git diff --check
```

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No payment implementation.
- No subscription mutation changes.
- No auth/access changes.
- No diary/workout writes.
- No recipe import.
- No shopping list runtime.
- No meal detail persistence.
- No recipe detail implementation.
- No premium recipe catalog implementation.
- No AI runtime.
- No Coach.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_MEAL_DETAIL_UI_MOCK_READY**
