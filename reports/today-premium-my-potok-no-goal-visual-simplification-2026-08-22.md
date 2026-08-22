# Today Premium My Potok No-Goal Visual Simplification

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_MY_POTOK_PLAN_HOME_STRUCTURE_FIX_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_NO_GOAL_VISUAL_SIMPLIFICATION_READY**

## Scope

Simplified only the default no-goal `/today` UI for `Мой Поток`.

No DB/schema/storage, migrations, production data, payment, subscription mutation, auth/access, diary/workout writes, recipe import, premium recipe catalog, AI runtime, Coach, voice input, or PR work was done.

## Owner Feedback

The logic was correct, but the screen looked too much like a dashboard:

- too many card-like blocks;
- title/subtitle/labels created visual noise;
- empty state felt like a big panel;
- actions were not anchored at the bottom;
- guardrail card was too heavy for the no-goal state.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-my-potok-no-goal-visual-simplification-2026-08-22.md`

## Before

Default no-goal `/today` rendered:

- `TODAY Premium` label;
- title and subtitle;
- card wrapper around empty state;
- large copy block;
- visible `Показать демо планов`;
- guardrail card `План ≠ запись в дневнике`;
- actions inside the card.

## After

Default no-goal `/today` is now a single clean screen:

Top:

- centered `Мой Поток`;
- close `X` on the top right.

Center:

- small muted centered text:
  - `Рассчитайте свою цель`
  - `и тут появится ваш план`

Bottom:

- fixed primary action `Рассчитать цель` -> `/goal`;
- fixed secondary action `Создать замеры` -> `/measurements`.

Removed from normal no-goal UI:

- large card wrapper;
- `TODAY Premium` label;
- subtitle under title;
- big empty state block;
- `План ≠ запись в дневнике` card;
- `План не записывается...` guardrail copy;
- visible `Показать демо планов`;
- dashboard-like blocks.

## Demo Plans

Demo plans remain available behind explicit demo route state:

- `/today?demoGoal=1`

This keeps development review possible without making plan cards visible in the default no-goal user state.

## Fixed Bottom Actions

The no-goal actions are fixed to the bottom of the viewport and stacked by default for 320px safety:

- `Рассчитать цель`;
- `Создать замеры`.

The no-goal screen should not require scrolling on mobile.

## Tests Run

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/pages/__tests__/DashboardFeatureBadges.test.ts` — passed.
- `git diff --check` — passed.

Notes:

- React Router SSR tests print the existing `useLayoutEffect` warning from `MemoryRouter`. Tests pass.

## Build Result

- `npm run build` — passed.

Build completed with existing Vite/Browserslist/chunk-size warnings only.

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

**TODAY_PREMIUM_MY_POTOK_NO_GOAL_VISUAL_SIMPLIFICATION_READY**
