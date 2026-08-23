# Today Premium Plan Detail 14 Day UI Mock

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_HOME_PAYWALL_MY_POTOK_DEPLOYED`
  - `TODAY_PREMIUM_MY_POTOK_GOAL_BUTTON_COPY_POLISH_READY`
  - `TODAY_PREMIUM_MY_POTOK_GOAL_WEIGHT_DEDUP_POLISH_READY`
- Verdict: **TODAY_PREMIUM_PLAN_DETAIL_14_DAY_UI_MOCK_READY**

## Scope

Implemented a UI/mock-only selected 14-day plan detail view inside `/today` `Мой Поток`.

No DB/schema/storage, payment, auth, diary, workout, recipe import, shopping-list runtime, AI, voice, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-plan-detail-14-day-ui-mock-2026-08-22.md`

## New Plan Detail Behavior

In existing-goal state, clicking one of the compact plan rows opens a separate clean plan detail view inside `/today`.

Supported demo plans:

- `Питание + тренировки`
- `Питание без сложной готовки`
- `Тренировки дома`
- `Быстрое питание и короткие тренировки`

Plan detail structure:

- centered title with selected plan name;
- back action to return to `Мой Поток` plan list;
- close `X` on the top right;
- duration `14 дней`;
- plan subtitle without duplicated duration suffix;
- short description: `План показывает питание, тренировки и дни без записи в дневник.`;
- primary CTA `Выбрать план`;
- compact day rows for `День 1` through `День 14`;
- each day row shows demo macros: `1650 ккал · Б 120 · Ж 55 · У 160`;
- each day row shows compact type text: `Питание + тренировка` or `Питание`.

## What Stays Mock

- `Выбрать план` is UI-only and does not write subscription, diary, workout, or backend state.
- Day row clicks only update local selected-day highlighting.
- Full day screen is not implemented in this package.
- Shopping list runtime is not implemented.
- Premium recipe catalog is not implemented.

## Removed From Plan Detail

- Dashboard/card wrapper around the selected plan view.
- Separate `TODAY Premium` header panel.
- `Посмотреть дни` secondary CTA.
- Expanded meal blocks for all days.
- Day preview with `Завтрак`, `Обед`, `Ужин`, `Перекус`.
- `Список покупок` placeholder button.
- Guardrail card/text `План ≠ запись в дневнике` / `План не записывается`.
- Separate dashboard heading `Ваши планы на 14 дней`.

## No-Goal And Existing-Goal Safety

- Default no-goal state remains the clean centered `Мой Поток` screen.
- `?planDetail=...` does not bypass no-goal state unless a goal/demo goal is present.
- Existing-goal plan list remains compact and opens the selected plan detail via local UI state.

## Tests

Targeted Today tests passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result:

- `18/18` tests passed.
- Existing React Router SSR `useLayoutEffect` warnings were present and non-blocking.

Covered:

- clicking plan row opens plan detail by source contract;
- plan detail shows selected plan name;
- plan detail shows `14 дней`;
- plan detail shows `Выбрать план`;
- plan detail shows `День 1` through `День 14`;
- plan detail does not show expanded meals;
- back action returns to `Мой Поток` list state;
- no guardrail/dashboard copy returns;
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

**TODAY_PREMIUM_PLAN_DETAIL_14_DAY_UI_MOCK_READY**
