# TODAY Smart Day Demo Flow

- Date: 2026-08-21
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_SMART_DAY_PRODUCT_SPEC_READY`
  - `POTOK_PLANS_DEMO_TO_TODAY_FLOW_READY`
  - `POTOK_PLANS_DEMO_TO_TODAY_FLOW_COPY_UX_POLISH_READY`
- Verdict: **TODAY_SMART_DAY_DEMO_FLOW_READY**

## Scope

Implemented a UI/mock demo Smart Day flow for POTOK TODAY Premium on `/today`.

No DB/schema/storage changes, migrations, production data changes, payment/subscription implementation, AI runtime/generation, Plan Store implementation, Human Coach, voice input, diary/workout/water writes, PR, or commit work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/types/todayPlan.ts`
- `src/services/demoSmartDayProvider.ts`
- `src/services/__tests__/demoSmartDayProvider.test.ts`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-smart-day-demo-flow-2026-08-21.md`

## Implemented Behavior

Added Smart Day entry to `/today`:

- state selector:
  - `Нет сил`;
  - `Обычный день`;
  - `Готова работать`;
- CTA: `Собрать день`;
- generated demo state: `Сегодня готово`.

The demo plan contains:

- nutrition;
- workout;
- water/activity;
- recommendations.

## Demo Actions

Actions are local/mock only:

- `Принять день`;
- `Выполнено`;
- `Не подходит`;
- `Сделать проще`;
- `Заменить питание`;
- `Заменить тренировку`.

These actions update only in-memory Smart Day state and helper copy. They do not create nutrition, workout, water, or Progress facts.

## Existing Plans Demo

The existing `Готовые программы -> Today` demo flow remains intact:

- `Смотреть программы`;
- demo catalog;
- day selection;
- Today items;
- `/nutrition` and `/workouts` navigation actions.

## Guardrails

Critical boundary remains:

```text
План не записывается в дневник автоматически. В дневник попадает только то, что вы подтвердили или выполнили.
```

Smart Day plan items are planned/demo items, not diary/workout facts.

## Tests

Passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/services/__tests__/demoTodayPlansProvider.test.ts src/services/__tests__/demoSmartDayProvider.test.ts
```

Result: 20 tests passed.

## Build

Passed:

```text
npm run build
git diff --check
```

Build completed with existing Vite/browser-data/chunk-size warnings only.

## Known Limitations

- Smart Day is demo/local state only.
- No AI generation is connected.
- No diary confirmation/write flow is implemented yet.
- No payment/subscription entitlement is implemented.
- No persistence beyond the existing Plans demo localStorage.

## Recommendation

Next package should be a visual/mobile smoke for Smart Day at 320px and normal mobile widths, then a separate design package for confirm-to-diary behavior.

## Final Status

Smart Day demo flow is ready as a TODAY Premium UI foundation while preserving `Plan ≠ fact`.
