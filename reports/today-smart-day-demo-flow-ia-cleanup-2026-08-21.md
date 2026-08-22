# TODAY Smart Day Demo Flow IA Cleanup

- Date: 2026-08-21
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_SMART_DAY_PRODUCT_SPEC_READY`
  - `TODAY_SMART_DAY_DEMO_FLOW_READY`
- Verdict: **TODAY_SMART_DAY_DEMO_FLOW_IA_CLEANUP_READY**

## Problem Found From Owner Screenshots

After adding Smart Day, `/today` showed too many flows at once:

- old paid entry cards;
- Smart Day selector;
- Smart Day result;
- `Готовые программы` demo preview/result.

This made the screen feel mixed and unclear, especially on mobile.

## UX Decision

Smart Day is now the primary `/today` flow.

The screen is split into mutually exclusive states:

- main Smart Day selector;
- focused Smart Day result;
- program demo preview;
- program demo result.

Smart Day result and `Готовые программы` demo are no longer shown together.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-smart-day-demo-flow-ia-cleanup-2026-08-21.md`

## Before Behavior

The page could stack:

- Smart Day;
- `Сегодня готово`;
- old direction cards;
- program demo preview/result.

The user could see multiple product concepts at once.

## After Behavior

Default `/today`:

- `TODAY Premium`;
- `Smart Day`;
- state selector:
  - `Нет сил`;
  - `Обычный день`;
  - `Готова работать`;
- CTA `Собрать день`;
- compact `Другие способы` section.

After `Собрать день`:

- only focused `Сегодня готово` result is shown;
- actions are visible;
- `Готовые программы` demo is not shown next to it;
- user can return with `Изменить состояние`.

Program demo:

- starts from `Другие способы -> Готовые программы`;
- opens program preview separately;
- can return with `Назад к Smart Day`;
- program result is separate from Smart Day result.

## Tests

Passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/services/__tests__/demoTodayPlansProvider.test.ts src/services/__tests__/demoSmartDayProvider.test.ts
```

Result: 21 tests passed.

## Build

Passed:

```text
npm run build
git diff --check
```

Build completed with existing Vite/browser-data/chunk-size warnings only.

## Safety Confirmation

No DB/schema/storage changes, migrations, production data changes, payment, AI runtime, diary/workout/water writes, Plan Store purchase, Coach marketplace, voice input, PR, or commit work was done.

Source tests confirm no diary/workout write paths, no payment runtime, no AI generation runtime, no coach marketplace, and no voice runtime were added.

## Final Status

Smart Day is now the clear primary `/today` flow, with `Готовые программы` preserved as a secondary flow and no mixed stacked result states.
