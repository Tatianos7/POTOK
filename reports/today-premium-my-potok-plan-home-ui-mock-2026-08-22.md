# Today Premium My Potok Plan Home UI Mock

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_HOME_ACCESS_UI_MOCK_PACKAGE_READY`
  - `TODAY_PREMIUM_PAYWALL_VALUE_ONLY_POLISH_READY`
  - `TODAY_PREMIUM_ACCESS_PLAN_DAY_OWNER_AMENDMENTS_READY`
  - `TODAY_PREMIUM_EXISTING_ROUTES_AND_SCREENS_AUDIT_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_PLAN_HOME_UI_MOCK_READY**

## Scope

Implemented a UI/mock-only `/today` premium hub for `Мой Поток`.

No DB/schema/storage, migrations, production data, payment, subscription mutation, auth/access, diary/workout writes, recipe import, premium recipe catalog, AI runtime, Coach, voice input, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-my-potok-plan-home-ui-mock-2026-08-22.md`

## New `/today` Behavior

`/today` now opens as the `Мой Поток` premium execution hub instead of the old stacked Smart Day demo screen.

Header:

- `Мой Поток`
- `Ваше питание, тренировки и рекомендации на сегодня`

The page keeps one primary function per state:

- home / empty state;
- plan list;
- selected plan preview;
- selected day preview.

## Empty State

When no goal is detected, `/today` shows:

- `Рассчитайте цель — здесь появятся ваши планы.`
- `POTOK подберёт питание и тренировки под вашу цель, режим и уровень.`

Buttons:

- `Рассчитать цель` -> `/goal`
- `Создать замеры` -> `/measurements`

Goal detection remains mock-safe:

- query `?demoGoal=1` can show demo plans for testing;
- existing local goal keys can show the plan home in browser runtime;
- no auth, DB, or storage schema changes were added.

## Demo 14-Day Plans

When demo goal state is available, `/today` shows `Ваши планы на 14 дней` and four compact demo cards:

- `Питание + тренировки` — `Дом · простой старт · 14 дней`
- `Питание без сложной готовки` — `Быстрые блюда · список покупок · 14 дней`
- `Тренировки дома` — `Без оборудования · 3 раза в неделю`
- `Нет времени` — `Короткие тренировки и быстрые приёмы пищи`

Selecting a plan opens a focused mock preview:

- plan title;
- duration `14 дней`;
- short description;
- CTA `Выбрать план`;
- CTA `Посмотреть дни`;
- compact day buttons `День 1` through `День 14`.

Selecting a day opens a compact day preview with:

- `1650 ккал · Б 120 · Ж 55 · У 160`;
- `Завтрак`;
- `Обед`;
- `Ужин`;
- `Перекус`;
- optional `Тренировка`;
- disabled/mock `Список покупок`.

## Existing Smart Day Demo

The old Smart Day and purchased-program providers remain in the codebase for future reuse and tests, but `/today` no longer imports or renders them as the primary flow.

This avoids mixing:

- old Smart Day result;
- `Похудение дома · 7 дней` demo program;
- new `Мой Поток` 14-day plan home.

## Planned-Vs-Actual Guardrail

The guardrail remains visible:

- `План ≠ запись в дневнике`
- `План не записывается в дневник автоматически. В дневник попадёт только то, что пользователь подтвердит или выполнит.`

No diary, workout, water, Progress, payment, AI, Coach, or voice runtime paths were added.

## What Remains Mock

- Premium access is still controlled outside `/today` by existing Home mock state.
- 14-day plans are static demo data.
- Plan selection is local UI state only.
- Day preview is static mock content.
- `Список покупок` is disabled placeholder UI.
- Premium recipe catalog is not implemented.
- Confirm-to-diary is not implemented.

## Tests Run

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/pages/__tests__/DashboardFeatureBadges.test.ts` — passed.
- `git diff --check` — passed.

Notes:

- Today SSR render tests print the existing React Router `useLayoutEffect` warning from `MemoryRouter`. Tests pass.

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

**TODAY_PREMIUM_MY_POTOK_PLAN_HOME_UI_MOCK_READY**
