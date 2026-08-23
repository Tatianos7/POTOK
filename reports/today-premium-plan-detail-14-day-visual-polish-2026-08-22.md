# Today Premium Plan Detail 14 Day Visual Polish

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_PLAN_DETAIL_14_DAY_UI_MOCK_READY`
- Verdict: **TODAY_PREMIUM_PLAN_DETAIL_14_DAY_VISUAL_POLISH_READY**

## Scope

Polished the selected 14-day plan detail screen inside `/today` `Мой Поток`.

No runtime logic beyond UI/mock state was changed.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-plan-detail-14-day-ui-mock-2026-08-22.md`
- `reports/today-premium-plan-detail-14-day-visual-polish-2026-08-22.md`

## Fixes

Header:

- kept back arrow on the left and `X` on the right;
- centered the selected plan title;
- constrained title width with `mx-12`, max-width, `truncate`, and smaller text so it does not collide with header icons on 320px screens.

Description:

- replaced `План показывает питание, тренировки и дни без записи в дневник.`;
- new copy: `Питание и тренировки на 14 дней.`

Day rows:

- moved macros to a full-width second line;
- removed truncation from macros text;
- kept day type compact in the row header;
- preserved compact rows and local selected-day state.

Bottom CTA:

- kept `Выбрать план` fixed at the bottom;
- increased page bottom padding and day-list bottom padding so the CTA does not cover the last rows.

## Behavior Kept

- Clicking a plan row opens the selected plan detail view.
- Back returns to `Мой Поток` plan list.
- Day rows are local selected/preview only.
- Full day screen is not implemented.
- No guardrail card or dashboard section returned.

## Tests

Targeted Today tests passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result:

- `19/19` tests passed.
- Existing React Router SSR `useLayoutEffect` warnings remained non-blocking.

Covered:

- plan detail opens;
- title remains constrained and single-line;
- days `1-14` render;
- full macros string renders without `truncate`;
- `Выбрать план` remains visible;
- list has bottom padding above fixed CTA;
- back action returns to `Мой Поток`;
- no expanded meals, shopping list, diary/write/payment/AI/voice actions.

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

**TODAY_PREMIUM_PLAN_DETAIL_14_DAY_VISUAL_POLISH_READY**
