# Progress Daily Goal Game Layer Month Only UX

- Date: 2026-08-17
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_READ_ONLY_PERIOD_METRICS_READY`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_MONTH_ONLY_UX_READY**

## Scope

Simplified the Progress Daily Goal/Game Layer after owner UX decision.

The existing `Цель дня` card now keeps only:

- today's checklist;
- one compact monthly indicator.

No DB/schema/storage changes were made. No production data was changed. No diary/workout/water write-path was changed. No Today, AI, payment, Plan Store, or Coach logic was added. No PR was created.

## Owner UX Decision

Owner decided that `Серия` and `Неделя` overload the card.

The intended simple meaning:

- today: user sees the daily checklist;
- month: user sees how many objective goal days were closed this month window.

## What Was Removed

Removed from UI display:

- `Серия`;
- `Неделя`.

The internal derived shape still keeps these fields for compatibility, but the card no longer renders them.

## What Remains

The checklist remains unchanged:

- `Питание в рамках цели`;
- `Провести тренировку / активность`;
- `Выпить воду`;
- `Проверить Progress`.

The period row now shows only:

```text
Месяц
X/30 дней
```

## Month Wording

Chosen wording:

- `Месяц`
- `X/30 дней`

The UI does not say `заполнено`, because the historical metric is not just diary presence. It means objective days where nutrition was within target and workout/activity existed.

The report wording is:

- `закрыто дней за месяц`;
- `дней с выполненной целью`.

## Historical Month Logic

Historical month completion remains read-only and objective:

```text
nutrition_in_90_110_percent_target && workout_exists
```

Still excluded from historical month:

- water, because it is localStorage/current-device limited;
- `Проверить Progress`, because it is UI-session only;
- habits/steps, because stable sources are not confirmed.

Today's checklist still uses:

- water as a today-only read-only signal;
- Progress check as UI-only.

## Soft Empty Month Copy

For `0/30`, the card uses soft copy:

```text
Начните закрывать дни — здесь появится прогресс за месяц.
```

No negative or punitive message is shown for empty/sparse data.

## Guardrails

- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No diary writes.
- No workout writes.
- No water writes.
- No Progress calculation changes.
- No Today logic.
- No AI logic.
- No payment logic.
- No Plan Store logic.
- No Coach logic.
- No PR.

## Tests Run

Targeted tests:

```text
npx tsx --test src/utils/__tests__/progressDailyGoal.test.ts src/components/__tests__/ProgressDailyGoalCard.test.tsx src/services/__tests__/progressHubService.test.ts
```

Result:

```text
tests 32
pass 32
fail 0
```

Coverage updated:

- `Серия` does not render;
- `Неделя` does not render;
- `Месяц` renders;
- `0/30 дней` uses soft copy;
- checklist still renders;
- water and Progress check remain excluded from historical month completion.

## Build Result

```text
npm run build
```

Result: passed.

Build produced existing maintenance warnings only:

- browser baseline data is old;
- Browserslist/caniuse-lite data is old;
- existing `mealService` dynamic/static import overlap warning;
- some chunks exceed 500 kB.

These warnings are not blockers for this UX simplification.

## Recommendation

Keep the month-only version for the next owner visual pass. It preserves the motivation layer while reducing cognitive load in the top Progress card.

Recommended next package:

`PROGRESS_DAILY_GOAL_GAME_LAYER_MONTH_ONLY_VISUAL_SMOKE_READY`

Suggested scope:

- verify 320px/375px/390px/430px;
- check `0/30`, partial month, and high month states;
- confirm owner copy preference for `X/30 дней`.

## Final Status

The `Цель дня` card is simplified to today's checklist plus one monthly read-only indicator. The UX is lighter, and all existing safety boundaries remain intact.
