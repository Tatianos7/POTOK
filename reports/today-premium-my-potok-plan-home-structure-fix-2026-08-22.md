# Today Premium My Potok Plan Home Structure Fix

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_MY_POTOK_PLAN_HOME_UI_MOCK_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_PLAN_HOME_STRUCTURE_FIX_READY**

## Scope

Fixed `/today` `Мой Поток` UI/mock structure to match owner-approved logic: plans must not appear before goal calculation.

No DB/schema/storage, migrations, production data, payment, subscription mutation, auth/access, diary/workout writes, recipe import, premium recipe catalog, AI runtime, Coach, voice input, or PR work was done.

## What Was Wrong

The previous `/today` mock could show `Ваши планы на 14 дней` immediately if a local goal-like key existed. That made the screen look as if POTOK already had enough goal context to suggest plans.

This was incorrect because the owner-approved flow is:

1. first calculate the goal;
2. show empty state until the goal exists;
3. only then show 14-day plan suggestions.

The demo plan list also included `Нет времени` as a standalone plan, but owner clarified that `Нет времени` is a lifestyle/input factor or day condition, not a plan title.

## Corrected Owner-Approved Structure

Default `/today` now shows:

- `Мой Поток`;
- `Ваше питание, тренировки и рекомендации на сегодня`;
- `Рассчитайте цель — здесь появятся ваши планы.`;
- `POTOK подберёт питание и тренировки под вашу цель, режим и уровень.`;
- `Рассчитать цель` -> `/goal`;
- `Создать замеры` -> `/measurements`;
- planned-vs-actual guardrail.

Default no-goal state does not show:

- `Ваши планы на 14 дней`;
- plan cards;
- standalone `Нет времени` plan;
- day previews;
- shopping list.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-my-potok-plan-home-structure-fix-2026-08-22.md`

## Default No-Goal Behavior

The old automatic localStorage goal detection was removed from `/today`.

Default dev/runtime behavior now assumes no goal:

- user sees only the empty state;
- plans remain hidden;
- `/goal` and `/measurements` are the clear next steps.

## Optional Demo Plans Behavior

For dev/demo review, plans can still be opened explicitly:

- via `?demoGoal=1`;
- or by the secondary mock control `Показать демо планов`.

This is intentionally not default behavior.

Demo plans state shows `Ваши планы на 14 дней` and compact plan cards. The previous standalone `Нет времени` plan was replaced with:

- title: `Быстрое питание и короткие тренировки`;
- subtitle: `Для дней с плотным графиком · 14 дней`.

The copy now frames busy schedule as a plan for a lifestyle mode, not as the `Нет времени` state itself.

## Guardrail

The guardrail remains:

- `План не записывается в дневник автоматически. В дневник попадёт только то, что пользователь подтвердит или выполнит.`

No diary, workout, water, Progress, payment, AI, Coach, or voice runtime paths were added.

## Tests Run

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/pages/__tests__/DashboardFeatureBadges.test.ts src/pages/__tests__/PaywallPremiumCopy.test.ts` — passed.
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

**TODAY_PREMIUM_MY_POTOK_PLAN_HOME_STRUCTURE_FIX_READY**
