# Progress Daily Goal Game Layer Streaks Periods Spec

- Date: 2026-08-17
- Branch: `master`
- Status basis:
  - `POTOK_FREE_PROGRESS_AND_PAID_TODAY_STRUCTURE_READY`
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_UI_FOUNDATION_READY`
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_GOAL_LOGIC_FIX_READY`
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_320PX_LAYOUT_FIX_READY`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_STREAKS_PERIODS_SPEC_READY**

## Scope

Short audit/spec for the next Progress Daily Goal/Game Layer: day streak, week/month completion, and basic conclusions.

Reports only. No runtime code, DB/schema/storage, migrations, Today, AI, payment, Plans, Coach, or PR work was done.

## Current Summary

General Progress now has a top `Цель дня` card with:

- `Питание в рамках цели`;
- `Провести тренировку / активность`;
- `Выпить воду`;
- `Проверить Progress`.

Current completion rules:

- nutrition completes only when today's logged calories are within `90-110%` of the daily calorie target;
- workout/activity completes when today's workout diary has entries;
- water is read-only derived from `DailyMeals.water`;
- Progress check is UI-session only;
- the checklist does not write diary, workout, or water data.

## Available Data

Existing read sources can support a lightweight derived layer:

- Food diary entries by date via `mealService.getMealsForDate` and existing nutrition progress services.
- Today's logged calories via `ProgressHubTodaySummary.caloriesLogged`.
- Daily calorie target via goal summary or nutrition target.
- Workout diary entries by date via `workoutService.getWorkoutEntries` and workout progress services.
- Water glasses via `DailyMeals.water`, currently localStorage-backed.
- Progress screen view state only in current UI session.

There is no confirmed first-class steps source, and habits are not ready through the current Progress adapter.

## Read-Only Possibilities

A read-only MVP can derive:

- today completion from today's food/workout/water data plus UI-session Progress check;
- weekly nutrition-in-range days from diary calories and goal target;
- weekly workout days from workout entries;
- monthly nutrition-in-range days from diary calories and goal target;
- monthly workout days from workout entries;
- an estimated streak for objective facts only, scanning backwards day by day.

This can be done without new DB tables if the implementation accepts that only objective diary-derived actions count historically.

## Limitations

Read-only cannot accurately reconstruct:

- whether the user opened Progress on previous days;
- manual non-diary checklist actions;
- water history beyond the reliability of localStorage day data;
- steps/habits until stable sources exist;
- intentional skips, pauses, or “not applicable” decisions.

Read-only streaks will be approximate and should be described as `по дневникам`, not as a legally exact habit record.

## Comparison A/B

### A. Read-Only Derived

Pros:

- fastest and safest;
- no DB/schema/RLS/migration work;
- no new write-path;
- aligns with current Progress principle: show facts from diary/workout data;
- low risk for Free layer.

Cons:

- cannot persist Progress-check completion;
- cannot represent manual completion decisions;
- water history may be incomplete/local-only;
- streak may differ across devices if water/progress-view facts are local or UI-only.

### B. Persisted `daily_goal_records`

Pros:

- exact streak/week/month completion;
- supports manual actions;
- supports Progress-check history;
- can support water targets and future habit tasks cleanly;
- can sync across devices.

Cons:

- requires DB/schema/RLS/migration;
- introduces a new write-path;
- needs owner-approved record lifecycle;
- needs careful no-autowrite rules so checklist does not become Today or diary mutation;
- larger QA surface.

## MVP Recommendation

Do read-only derived first.

Reason:

- the current layer is a lightweight Free Progress motivation block;
- objective diary/workout facts are already available;
- persistence would be useful later, but it is not required to validate whether streak/week/month motivates users;
- avoiding DB/RLS/migration keeps the next step small and safe.

Persisted `daily_goal_records` should be a separate design package after read-only UX proves useful.

## Definition Of Day Completed

Recommended read-only MVP definition:

A day is completed when all objective available checks pass:

- nutrition is within `90-110%` of that day's calorie target;
- workout/activity exists for that date;
- water is marked for that date if a safe water value exists.

Do not include `Проверить Progress` in historical day completion until persistence exists.

For today only:

- keep `Проверить Progress` as UI-session completion in the visible checklist;
- exclude it from streak/week/month historical metrics;
- optionally label period metrics as `по дневникам`, so users understand the difference.

## Week / Month / Streak Proposal

Read-only metrics:

- `Сегодня`: current checklist score.
- `Серия`: consecutive completed objective days ending today or yesterday.
- `Неделя`: completed objective days in the last 7 days, for example `4/7`.
- `Месяц`: completed objective days in the last 30 days, for example `18/30`.

Basic conclusions:

- if week completion is strong: `Неделя идёт ровно. Продолжайте без рывков.`;
- if nutrition is often missing: `Питание чаще всего мешает закрыть день.`;
- if workouts are missing: `Добавьте хотя бы короткую активность.`;
- if data is sparse: `Пока мало данных — начните с дневника питания или активности.`

Keep copy calm and non-medical. Avoid burn/calorie guilt language.

## Water Limitations

Current water source is `DailyMeals.water`, localStorage-backed.

MVP options:

- include water only for today and current-device history if `DailyMeals.water` is available by date;
- or exclude water from period completion until water persistence is approved.

Recommended safer MVP:

- include water in today's checklist;
- keep week/month/streak objective completion based on nutrition + workout first;
- show water as a separate small current-day signal, not a required historical streak factor.

This avoids breaking cross-device expectations.

## Progress Check Limitations

`Проверить Progress` is UI-session only.

Recommendation:

- keep it in today's visible checklist;
- do not include it in historical week/month/streak;
- do not persist it until `daily_goal_records` is approved;
- do not fake previous-day Progress views.

## UI Recommendation

Do not add another large card.

Extend the existing `Цель дня` card lightly:

- keep the current checklist first;
- add a compact row below the checklist:
  - `Серия: 3 дня`
  - `Неделя: 4/7`
  - `Месяц: 18/30`
- add one short conclusion line.

Avoid charts in this layer for now. Detailed charts should remain in Progress sections.

## Future `daily_goal_records`

A future persisted layer may be needed if POTOK wants:

- exact streaks across devices;
- manual actions;
- explicit water targets;
- persisted Progress-check completion;
- skip/not-applicable days;
- habit/task completion;
- owner-approved day closure.

That package should include:

- schema/RLS spec;
- migration draft;
- write-path guardrails;
- no diary/workout auto-create rules;
- sync/conflict behavior;
- tests for planned-vs-actual separation.

## Risks

- Making the Free game layer feel like Today or a plan.
- Overloading Progress with gamification.
- Treating UI-session Progress check as historical fact.
- Counting local-only water as a reliable cross-device streak source.
- Making nutrition range feel punitive.

## Next Task

Recommended next implementation package:

`PROGRESS_DAILY_GOAL_GAME_LAYER_READ_ONLY_PERIOD_METRICS_PACKAGE`

Suggested scope:

- derive last 7/30 day nutrition-in-range counts from existing food diary facts;
- derive last 7/30 day workout counts from existing workout facts;
- define a conservative streak from nutrition + workout only;
- keep water as today-only or separate read-only signal;
- keep Progress check UI-only;
- add compact metrics row to the existing card;
- add tests and build.

## Final Status

Read-only week/month/streak MVP is feasible and should come before persisted `daily_goal_records`. Persistence is useful later, but should be treated as a separate owner-approved DB/RLS design package.
