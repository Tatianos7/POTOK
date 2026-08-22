# Today Premium My Potok Goal State Scenarios

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_MY_POTOK_NO_GOAL_VISUAL_SIMPLIFICATION_READY`
  - `TODAY_PREMIUM_MY_POTOK_PLAN_HOME_STRUCTURE_FIX_READY`
  - `TODAY_PREMIUM_ACCESS_PLAN_DAY_OWNER_AMENDMENTS_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_GOAL_STATE_SCENARIOS_READY**

## Scope

Updated `/today` `Мой Поток` UI/mock to support two goal scenarios:

- no goal -> clean no-goal screen;
- existing free POTOK goal -> goal summary plus demo 14-day plans.

No DB/schema/storage, payment/auth, diary/workout writes, recipe import, AI runtime, voice input, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-my-potok-goal-state-scenarios-2026-08-22.md`

## No-Goal Scenario

If no goal is available, `/today` keeps the clean no-goal screen:

- `Мой Поток`;
- `Рассчитайте свою цель`;
- `и здесь появится ваш план`;
- `Рассчитать цель` -> `/goal`;
- `Создать замеры` -> `/measurements`.

Plans are not shown.

## Existing-Goal Scenario

If an existing goal is found from the local free POTOK goal fallback, or via demo route `?demoGoal=1`, `/today` shows:

- `Мой Поток`;
- goal summary, for example `Похудение: 70 → 50 кг`;
- progress marker between start and target;
- current weight above the marker only when current weight is known;
- hint: `Дополните данные, чтобы POTOK точнее подобрал питание и тренировки.`;
- `Дополнить данные`;
- `Редактировать цель` -> `/goal`;
- `Создать замеры` -> `/measurements`;
- `Ваши планы на 14 дней`;
- demo plan cards.

If current weight is unknown, the progress marker remains but no current-weight label is shown above it.

## Demo Plans

Demo plans remain mock-only.

The standalone `Нет времени` plan is not used. The busy-schedule plan remains:

- `Быстрое питание и короткие тренировки`;
- `Для дней с плотным графиком · 14 дней`.

## Goal Detection

The implementation reads existing local `goal_*` data in browser runtime as a local fallback only. It does not call goal services, Supabase, payment, auth, diary, workout, AI, or Coach runtime paths.

Demo routes for tests/review:

- `/today?demoGoal=1` -> goal with current and target weight;
- `/today?demoGoalNoCurrent=1` -> goal with target weight only.

## Tests Run

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx` — passed.
- `git diff --check` — passed.

Notes:

- React Router SSR tests print the existing `useLayoutEffect` warning from `MemoryRouter`. Tests pass.

## Build Result

- `npm run build` — passed.

Build completed with existing Vite/Browserslist/chunk-size warnings only.

## Safety Confirmation

- No DB/schema/storage changes.
- No payment/auth changes.
- No diary/workout writes.
- No recipe import.
- No AI runtime.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_MY_POTOK_GOAL_STATE_SCENARIOS_READY**
