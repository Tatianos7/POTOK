# Today Premium My Potok Existing Goal Visual Rework

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_MY_POTOK_GOAL_STATE_SCENARIOS_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_EXISTING_GOAL_VISUAL_REWORK_READY**

## Scope

Reworked `/today` `Мой Поток` existing-goal state to remove dashboard/card layout from the primary screen.

No DB/schema/storage, payment/auth, diary/workout writes, recipe import, AI runtime, voice input, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-my-potok-existing-goal-visual-rework-2026-08-22.md`

## Before

Existing-goal state rendered:

- header card;
- goal summary card;
- separate `Ваши планы на 14 дней` card;
- explanatory mock copy;
- guardrail card `План ≠ запись в дневнике`.

This looked like a dashboard instead of one focused `Мой Поток` screen.

## After

Existing-goal state is now one clean screen:

Top:

- centered `Мой Поток`;
- close `X` on the top right;
- no wrapping title.

Main:

- goal title, for example `Похудение`;
- range, for example `70 → 50 кг`;
- progress marker `70 кг ━━━━━●━━━━ 50 кг`;
- current-weight label above the marker only when current weight is known;
- hint `Дополните данные, чтобы POTOK точнее подобрал питание и тренировки.`;
- compact plan rows only:
  - `Питание + тренировки`;
  - `Питание без сложной готовки`;
  - `Тренировки дома`;
  - `Быстрое питание и короткие тренировки`.

Bottom fixed actions:

- `Дополнить данные`;
- `Редактировать цель` -> `/goal`;
- `Создать замеры` -> `/measurements`.

## Removed UI

Removed from `/today` primary UI:

- `Ваши планы на 14 дней`;
- `Выберите mock-план...`;
- `План ≠ запись в дневнике`;
- `План не записывается...`;
- separate dashboard/card wrappers around the goal and plan list.

The guardrail block is no longer rendered on `/today`.

## No-Goal State

No-goal state remains clean:

- centered `Мой Поток`;
- center text `Рассчитайте свою цель / и здесь появится ваш план`;
- bottom actions `Рассчитать цель` and `Создать замеры`;
- no plans.

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

**TODAY_PREMIUM_MY_POTOK_EXISTING_GOAL_VISUAL_REWORK_READY**
