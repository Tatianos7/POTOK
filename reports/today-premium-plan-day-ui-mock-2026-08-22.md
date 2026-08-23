# Today Premium Plan Day UI Mock

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_PLAN_DETAIL_14_DAY_UI_MOCK_READY`
  - `TODAY_PREMIUM_PLAN_DETAIL_14_DAY_VISUAL_POLISH_READY`
- Verdict: **TODAY_PREMIUM_PLAN_DAY_UI_MOCK_READY**

## Scope

Implemented a UI/mock-only day detail view inside `/today` for a selected 14-day `Мой Поток` plan.

No DB/schema/storage, payment, auth, diary, workout, recipe import, shopping-list runtime, AI, voice, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-plan-day-ui-mock-2026-08-22.md`

Related uncommitted reports from the previous plan-detail package remain present:

- `reports/today-premium-plan-detail-14-day-ui-mock-2026-08-22.md`
- `reports/today-premium-plan-detail-14-day-visual-polish-2026-08-22.md`

## New Day Detail Behavior

From the selected 14-day plan detail screen, clicking `День 1`, `День 2`, and so on opens a separate day detail view inside `/today`.

Day detail structure:

- back arrow on the left returns to the selected plan detail;
- centered title, for example `День 1`;
- close `X` on the right;
- daily calories: `1650 ккал`;
- daily macros: `Б 120 · Ж 55 · У 160`;
- compact meal rows:
  - `Завтрак` / `Овсянка, банан, йогурт` / `410 ккал`;
  - `Обед` / `Курица, рис, овощи` / `520 ккал`;
  - `Ужин` / `Рыба, салат` / `430 ккал`;
  - `Перекус` / `Творог, ягоды` / `290 ккал`;
- workout summary when the selected day has a workout:
  - `Тренировка дома`;
  - `25 минут`;
  - `Ноги и ягодицы`;
- compact day-state selector:
  - `Обычный день`;
  - `Нет сил`;
  - `Нет времени`;
  - `Готова работать`;
- fixed bottom actions:
  - `Список покупок` disabled/mock;
  - `Подтвердить день` disabled/mock.

## Mock Boundaries

- Day state changes only local UI copy.
- `Список покупок` does not generate or open a shopping list.
- `Подтвердить день` does not write to diary, workouts, nutrition, backend, or storage.
- Meal detail and full recipe screens are not implemented in this package.
- Full day recomputation is not implemented.

## Removed / Not Returned

- No `План ≠ запись в дневнике`.
- No `План не записывается`.
- No automatic diary write UI.
- No payment/subscription action.
- No AI/Coach/voice action.

## Tests

Targeted Today tests passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result:

- `23/23` tests passed.
- Existing React Router SSR `useLayoutEffect` warnings remained non-blocking.

Covered:

- day row click opens day detail by local state contract;
- day detail shows `День 1`;
- day detail shows daily calories and macros;
- day detail shows breakfast, lunch, dinner, and snack rows;
- day detail shows workout summary;
- day detail shows all day-state options;
- back returns to selected plan detail;
- actions remain disabled/mock;
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
- No premium recipe catalog implementation.
- No AI runtime.
- No Coach.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_PLAN_DAY_UI_MOCK_READY**
