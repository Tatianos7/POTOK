# Today Premium My Potok Goal Weight Dedup Polish

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_MY_POTOK_EXISTING_GOAL_VISUAL_POLISH_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_GOAL_WEIGHT_DEDUP_POLISH_READY**

## Scope

Small UI polish for the existing-goal `/today` `Мой Поток` screen.

The change removes duplicated weight labels around the goal progress bar. No no-goal UI, plan rows, bottom actions, routes, auth, payment, storage schema, diary, workout, recipes, AI, Coach, voice, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`

## What Was Wrong

The existing-goal screen duplicated goal weight data in several places:

- separate range line under `Похудение`, for example `70 → 55 кг`;
- current weight above the marker even when it equaled the start weight;
- start weight at the left edge of the progress bar;
- target weight at the right edge of the progress bar.

This made the screen visually noisy and repeated the same value.

## Updated Behavior

The existing-goal screen now keeps weight values only in the progress bar area:

- start weight is shown at the left edge;
- target weight is shown at the right edge;
- the marker shows the current position;
- current weight is shown above the marker only when it is known and differs from both start and target;
- no separate `70 → 55 кг` style range line is rendered.

Examples:

- start/current: `70 кг ━●━━━━━━━━ 55 кг`, with no duplicate `70 кг` above the marker;
- intermediate current: `63 кг` above marker, with `70 кг` and `55 кг` only at the edges;
- unknown current: no marker label above the progress marker.

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

**TODAY_PREMIUM_MY_POTOK_GOAL_WEIGHT_DEDUP_POLISH_READY**
