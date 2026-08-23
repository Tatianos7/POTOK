# Today Premium Plan To Replace Meal Flow Smoke

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_PLAN_DETAIL_14_DAY_VISUAL_POLISH_READY`
  - `TODAY_PREMIUM_PLAN_DAY_VISUAL_POLISH_READY`
  - `TODAY_PREMIUM_MEAL_DETAIL_VISUAL_POLISH_READY`
  - `TODAY_PREMIUM_REPLACE_MEAL_UI_MOCK_READY`
- Verdict: **TODAY_PREMIUM_PLAN_TO_REPLACE_MEAL_FLOW_SMOKE_READY**

## Scope

Smoke verification of the current Premium plan flow inside `/today`:

`Мой Поток` → selected 14-day plan → day detail → meal detail → replace meal.

No runtime code, DB/schema/storage, payment/auth, diary/workout writes, recipe import, shopping list runtime, AI runtime, voice input, or PR work was done in this smoke pass.

## Verification Method

Used targeted render/source tests plus production build.

Playwright was not required for this pass and no browser SIGABRT blocker occurred.

## Flow Checks

Existing-goal/demo `/today`:

- shows `Мой Поток`;
- shows the goal state;
- shows compact plan rows;
- does not show `Ваши планы на 14 дней`;
- does not show `План ≠ запись в дневнике`.

Plan detail:

- plan row click is wired to open plan detail;
- selected plan title renders;
- `14 дней` renders;
- days 1-14 render as compact rows;
- CTA `Выбрать план` is present and covered by source layout padding checks.

Day detail:

- day row click is wired to open day detail;
- daily КБЖУ renders;
- `Завтрак`, `Обед`, `Ужин`, `Перекус` render;
- workout summary renders;
- day state selector renders.

Meal detail:

- meal row click is wired to open meal detail;
- meal КБЖУ renders;
- ingredients with grams render;
- portion hints render;
- preparation steps render;
- bottom actions are present and covered by source layout padding checks.

Replace meal:

- `Заменить блюдо` is wired to open replace screen;
- filters render;
- replacement options render;
- `Выбрать замену` is disabled until selection exists;
- confirmed replacement can return to meal detail through local/mock state;
- selected replacement meal data can render in meal detail.

Back navigation:

- replace → meal detail;
- meal detail → day detail;
- day detail → plan detail;
- plan detail → `Мой Поток`.

## Negative Checks

Confirmed by tests/source checks:

- no diary write actions;
- no payment/auth changes;
- no AI runtime;
- no recipe DB integration;
- no shopping list runtime;
- no `План ≠ запись в дневнике`;
- no `Ваши планы на 14 дней`.

## Commands

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx` — passed, `31/31`.
- `npm run build` — passed.
- `git diff --check` — passed.

Build warnings observed:

- stale `baseline-browser-mapping`;
- stale Browserslist/caniuse data;
- existing Vite warning about mixed dynamic/static import of `mealService`;
- large chunk warning.

These warnings were not introduced by this smoke pass.

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No payment/auth changes.
- No diary/workout writes.
- No recipe import.
- No shopping list runtime.
- No AI runtime.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_PLAN_TO_REPLACE_MEAL_FLOW_SMOKE_READY**
