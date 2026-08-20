# POTOK Plans Demo To Today Flow

- Date: 2026-08-20
- Branch: `master`
- Status basis:
  - `TODAY_PAID_ENTRY_DEPLOYED`
  - `TODAY_PLAN_AND_PROGRAM_ARCHITECTURE_SPEC_READY`
  - `PROGRESS_DAILY_GOAL_CUSTOMIZATION_DEPLOYED`
- Verdict: **POTOK_PLANS_DEMO_TO_TODAY_FLOW_READY**

## Scope

Implemented a UI-only demo flow from `Готовые программы` to Today execution items.

No DB/schema/storage migrations, production data changes, real payment, AI generation, Plan Store purchase, Coach marketplace, diary/workout/water writes, Progress calculation changes, PR, or commit were created.

Pre-work `git status` already contained unrelated modified files in food import/admin/progress nutrition areas. They were not touched by this package.

## Product Decision Summary

Today remains a paid execution mode, not a free self-guided checklist.

This package demonstrates only the `purchased_plan` direction:

```text
Plan Source -> Today Plan -> Today Items -> User Action -> Diary/Workout/Progress
```

The demo stops before actual diary/workout mutation. Plan items only navigate or update local mock UI state.

## What Was Implemented

- Shared Today TypeScript models were added.
- A demo provider for ready-made programs was added.
- `/today` now lets the `Готовые программы` card open a demo catalog/preview.
- A selected demo day can be opened as Today items.
- Item actions are explicit and do not write diary/workout/water data.
- The planned-vs-actual guardrail copy remains visible.

## Today Models Added

Added shared model types:

- `TodayPlanSource`
- `TodayPlan`
- `TodayItem`
- `TodayItemType`
- `TodayItemStatus`
- `TodayNotSuitableReason`

The demo source uses `purchased_plan`.

## Demo Program Structure

Added one demo program:

- `Похудение дома · 7 дней`
- goal: `снижение веса`
- format: `дома`
- level: `начинающий`
- includes nutrition + activity

Each day can produce a small Today plan with:

- meal item: `Завтрак` / `Овсянка, банан, йогурт`;
- workout item: `Тренировка дома · 25 минут` / `Ноги и ягодицы`;
- water item: `Вода` / `Держите ориентир по воде в течение дня`.

## UI Flow

On `/today`:

1. User sees the paid Today entry structure.
2. User clicks `Смотреть программы`.
3. A demo preview opens inside Today.
4. User selects a day from the 7-day program.
5. User clicks `Открыть день в Today`.
6. The selected day becomes Today items.

The UI marks this as `Демо-превью` and `Без оплаты` to avoid implying a real store or purchase.

## Execution Actions Behavior

- `Перейти в дневник` routes to `/nutrition`.
- `Начать тренировку` routes to `/workouts`.
- `Выполнено` changes only local/mock Today item state.
- `Не подходит` opens a mock reason selector and stores the selected reason only in local/mock plan state.

No diary, workout, or water write functions are called.

## Planned-Vs-Actual Guardrails

Guardrail copy:

> План не записывается в дневник автоматически. В дневник попадает только то, что вы подтвердили или выполнили.

This keeps the boundary clear:

- planned Today item is not a diary fact;
- navigation to diary/workout is explicit user action;
- local demo completion is not Progress completion.

## Storage Approach

The active demo Today plan can be stored in localStorage under a demo-specific key.

This is MVP demo state only. No Supabase table, RLS policy, migration, or production data write was added.

## Tests Run

Passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/services/__tests__/demoTodayPlansProvider.test.ts
```

Result: 14 tests passed.

## Build Result

Passed:

```text
npm run build
git diff --check
```

Build completed with existing Vite/browser-data/chunk-size warnings only.

## Known Limitations

- Demo catalog contains only one ready-made program.
- Program days intentionally reuse simple demo items.
- The flow is local/mock and not synced across devices.
- There is no real purchase, entitlement check, Plan Store, AI plan creation, or coach source.
- The current tests use SSR/source checks and pure provider tests, not a browser click simulation.

## Future Steps

- Supabase persistence for purchased plans, Today plans, and item status.
- Real Plan Store catalog and purchase/entitlement flow.
- Payment integration as a separate package.
- AI draft plans using the same Today model.
- Coach-assigned plans using the same Today model.

## Final Status

The demo `Готовые программы -> Today` flow is ready as a UI foundation and preserves the planned-vs-actual boundary.
