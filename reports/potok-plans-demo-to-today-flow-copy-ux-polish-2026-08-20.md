# POTOK Plans Demo To Today Flow Copy UX Polish

- Date: 2026-08-20
- Branch: `master`
- Status basis:
  - `POTOK_PLANS_DEMO_TO_TODAY_FLOW_READY`
  - Owner screenshots review after Playwright environment blocker
- Verdict: **POTOK_PLANS_DEMO_TO_TODAY_FLOW_COPY_UX_POLISH_READY**

## Scope

Small copy/UX polish for the demo `Готовые программы -> Today` flow.

No new features were added. No DB/schema/storage changes, production data changes, diary/workout/water writes, payment, AI generation, Coach, real Plan Store purchase, PR, or commit were made.

## Owner Screenshot Context

Playwright visual smoke could not complete in this environment because browser launch failed with `SIGABRT`, but owner screenshots covered the key Today demo states.

The owner review flagged technical/English copy in the demo flow.

## What Changed

Updated visible copy:

- `Демо Today` -> `ДЕМО-ПЛАН`;
- `Это preview готовой программы.` -> `Это пример готовой программы.`;
- `Действия меняют только локальное состояние demo-плана.` -> `В демо действия не записываются в дневник.`;
- `День 1 превращается в Today items:` -> `Что появится в Today:`.

## What Stayed The Same

The flow was not changed:

- `Готовые программы`;
- demo program selection;
- program day selection;
- Today items;
- `Перейти в дневник` routes to `/nutrition`;
- `Начать тренировку` routes to `/workouts`;
- `Выполнено` and `Не подходит` remain local/mock state only.

## Guardrail

Guardrail copy was kept:

```text
План не записывается в дневник автоматически. В дневник попадает только то, что вы подтвердили или выполнили.
```

## Tests

Passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/services/__tests__/demoTodayPlansProvider.test.ts
```

Result: 15 tests passed.

## Build

Passed:

```text
npm run build
git diff --check
```

Build completed with existing Vite/browser-data/chunk-size warnings only.

## Safety

Confirmed by tests/source checks:

- no diary/workout/water write functions;
- no payment implementation;
- no AI generation;
- no Coach marketplace;
- no real Plan Store purchase.

## Final Status

The demo flow copy is now fully Russian and less technical while preserving the existing UI and planned-vs-actual boundary.
