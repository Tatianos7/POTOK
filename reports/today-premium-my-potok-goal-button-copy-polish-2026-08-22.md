# Today Premium My Potok Goal Button Copy Polish

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_MY_POTOK_EXISTING_GOAL_VISUAL_POLISH_READY`
  - `TODAY_PREMIUM_MY_POTOK_GOAL_WEIGHT_DEDUP_POLISH_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_GOAL_BUTTON_COPY_POLISH_READY**

## Scope

Small copy-only polish for the existing-goal `/today` `Мой Поток` screen.

No no-goal UI, plan rows, routes, auth, payment, storage schema, diary, workout, recipes, AI, Coach, voice, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`

## Change

In the existing-goal bottom actions, the goal button text changed:

- before: `Редактировать цель`
- after: `Изменить цель`

The route stayed unchanged:

- `Изменить цель` -> `/goal`

The neighboring action `Дополнить данные` stayed unchanged and remains separate from changing the actual goal.

## Tests

Targeted Today tests:

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx`
- Result: passed, `16/16`.

Build:

- `npm run build`
- Result: passed.
- Existing warnings only: stale browser data, `mealService` mixed dynamic/static import warning, and large chunk warning.

Diff check:

- `git diff --check`
- Result: passed.

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No payment implementation.
- No subscription mutation changes.
- No auth/access changes.
- No diary/workout writes.
- No recipe import.
- No premium recipe catalog implementation.
- No AI runtime.
- No Coach.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_MY_POTOK_GOAL_BUTTON_COPY_POLISH_READY**
