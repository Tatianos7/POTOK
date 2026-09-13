# Premium Flow Reference Extraction

- Date: 2026-09-13
- Branch: `master`
- Reference file reviewed: `/Users/urijurij/Desktop/potok_premium_flow.jsx`
- Target package: `POTOK_PREMIUM_FLOW_REFERENCE_EXTRACTION_SOURCE_GROUNDED`
- Verdict: **POTOK_PREMIUM_FLOW_REFERENCE_EXTRACTION_SOURCE_GROUNDED_READY**

## Scope

Extract the strongest product and UX ideas from the real `potok_premium_flow.jsx` prototype and adapt them to current POTOK as an advisory plan.

The JSX file is a reference-only prototype built with local React state, mock content, and inline styles. It is evidence for product flow and information architecture only. It is not a production implementation source.

This is report-only. Runtime code was not changed, UI was not changed, SQL was not executed, Supabase was not touched, staging was not mutated, production was not touched, Premium write paths were not added, DB schema/RLS were not changed, no API keys/secrets were used, no PR was created, and no commit was created.

## Reference Reviewed

The reference file was available at `/Users/urijurij/Desktop/potok_premium_flow.jsx` and was reviewed in full.

Source-grounded prototype surfaces found:

- `PaywallScreen` and `PaymentScreen`;
- `MyFlowHome` with no-goal and goal-present states;
- `GoalFormScreen` and `MeasurementsFormScreen`;
- `PlanDetailScreen` with 14 plan days and shopping-list entry;
- `DayDetailScreen` with daily macros, day state, meals, workout, and confirmation actions;
- `ShoppingListScreen` with 1 / 2 / 3 / 7 day periods;
- `RecipesHome`, `RecipeCategoryScreen`, and `RecipeDetailScreen`;
- a prototype-only shell and local bottom navigation.

No prototype code, mock content, inline styles, price values, or state implementation should be copied into POTOK. Product adaptation also remains aligned with existing POTOK reports:

- `reports/today-product-architecture-2026-08-15.md`
- `reports/potok-paid-today-product-structure-2026-08-16.md`
- `reports/today-premium-content-structure-2026-08-21.md`
- `reports/today-premium-implementation-roadmap-2026-08-21.md`

## Executive Summary

The useful prototype direction is not its JSX, mock data, fake payment form, or inline visual implementation. The useful part is the Premium product loop demonstrated by the source:

```text
Paywall -> Payment -> Premium access
  -> Goal exists?
  -> if no goal: current POTOK goal calculation
  -> if goal exists: Premium Today / Мой Поток
  -> 14-day plan
  -> Today execution
  -> explicit confirmations only
  -> diaries store completed facts
  -> Progress reads completed facts
  -> recalculation or next plan cycle after 14 days
```

The source specifically demonstrates:

- subscription offer followed by a payment surface and Premium access state;
- a goal gate before plan access;
- several 14-day plan options;
- daily planned meals and a planned workout;
- explicit replace, simplify/start, and confirm actions;
- a shopping list derived for a selected number of plan days;
- a categorized recipe collection and recipe detail.

The current POTOK direction already supports this conceptually:

- FREE remains manual Goal, Diaries, Progress, and base dashboard;
- PREMIUM is planned execution support through Today / Мой Поток;
- planned items must not become diary or workout facts without explicit user action;
- Progress, MuscleMap, History, and Repeat must keep reading completed facts, not planned recommendations.

## Premium Flow After Purchase

Source observation:

- the prototype starts at `PaywallScreen`;
- payment completion switches local `premium` state and opens `MyFlowHome`;
- when `hasGoal` is false, `MyFlowHome` offers goal calculation and measurements;
- when `hasGoal` is true, it shows 14-day plans.

Recommended POTOK flow:

1. Premium user opens Home.
2. If no goal exists:
   - route user into the existing POTOK goal calculation;
   - do not use prototype simplified formulas;
   - do not create a plan before goal/constraints exist.
3. If goal exists:
   - show existing Premium Today / `Мой Поток`;
   - avoid an intermediate CTA-only card;
   - daily surface should show what to eat, what to train, and what actions are available today.

Product rule:

- Premium access unlocks planned guidance;
- it does not replace the user-owned diary facts;
- it does not auto-write food diary entries or workout entries.

## Premium 14-Day Plan

Source-grounded structure to keep:

- 14-day plan as a clear cycle;
- nutrition by day;
- training by day;
- shopping list derived from selected plan days;
- recalculation / reassessment after 14 days; the prototype presents this as automatic after day 14, while production rules still require an approved contract.

Recommended POTOK adaptation:

- Treat the 14-day plan as planned data.
- Each day can contain:
  - meal slots;
  - recipes or meal templates;
  - workout template;
  - day note or focus;
  - allowed replacement rules.
- Plan days should feed Today, not Progress directly.
- Recalculation after 14 days should use completed facts and explicit feedback, not prototype mock adherence.

Do not implement recalculation until owner approves the exact inputs:

- weight trend;
- nutrition diary consistency;
- workout facts;
- skipped/not suitable reasons;
- safety constraints;
- Premium product mode: AI, ready-made plan, or coach.

## Premium Today

Source-grounded Today sections:

- day calories and macros;
- day state:
  - `Обычный день`;
  - `Нет сил`;
  - `Нет времени`;
  - `Готова работать`;
- meal cards;
- workout card;
- actions:
  - `Заменить`;
  - `Облегчить` for the workout;
  - `Начать` for the workout;
  - `Подтвердить` for a meal;
  - `Подтвердить весь день по плану` in the prototype.

Each prototype meal card exposes grams, calories, protein/fat/carbohydrates, `На глаз` guidance, preparation text, replacement, and confirmation state.

Recommended POTOK semantics:

- `КБЖУ дня` is planned target/context, not diary total.
- `Состояние дня` can influence future planned recommendations, but must not rewrite completed facts; persistence and adaptation rules need owner approval.
- Meal actions:
  - replacement changes planned item only;
  - confirmation marks planned execution state only unless the user separately approves a diary bridge;
  - any recipe or meal diary write must be explicit and reviewable.
- Workout actions:
  - `Начать` opens Workout Diary/start flow later;
  - `Облегчить` changes planned workout only;
  - no automatic completed workout creation.

Safety guardrail:

- pain/discomfort or medical-risk feedback should not trigger automatic workout replacement without safer fallback copy and owner-approved safety rules.

## Recipe Collection

Source-grounded structure:

- Premium-only recipe collection;
- entry through bottom nav overflow `Ещё`;
- recipe categories;
- recipe detail card with:
  - calories/macros;
  - grams;
  - ingredients;
  - "на глаз" portion guidance;
  - preparation steps.
- prototype actions `Заменить блюдо`, `Добавить в план`, and `Добавить в дневник после подтверждения`.

Recommended POTOK adaptation:

- Keep `Сборник рецептов` out of main bottom nav visible items.
- Show it in Premium-only `Ещё`.
- Free users should not see the Premium recipe entry.
- Recipe detail can be read-only first.
- `Добавить в план` and recipe-to-diary actions are separate operations.
- Recipe-to-plan or recipe-to-diary writes must require explicit user confirmation and approved contracts; neither should be automatic.

Categories confirmed in the prototype:

- `Завтраки`;
- `Обеды`;
- `Ужины`;
- `Перекусы`;

Additional filters such as high-protein, no-cook, quick, or budget are ideas only and are not grounded in this prototype.

## Shopping List

Source-grounded structure:

- period switch: 1 / 2 / 3 / 7 days;
- grouped by product category;
- quantities scaled from the selected plan period.

Recommended POTOK adaptation:

- MVP can keep shopping list as read-only derived view from the selected plan.
- Do not persist checked shopping items until storage and RLS are approved.
- Do not generate shopping list from unaccepted/unselected plans.
- Do not add items to food diary from shopping list.

Product groups:

- vegetables/fruit;
- protein;
- grains/carbs;
- dairy;
- pantry/sauces;
- other.

## What Not To Transfer

Do not transfer from prototype:

- mock data;
- inline styles;
- fake payment;
- simplified goal formula;
- automatic diary writes;
- automatic workout writes;
- automatic Progress counting from planned data;
- new business logic without owner approval;
- payment enforcement;
- schema/storage changes;
- hidden Premium write paths;
- any code copied from the prototype as production implementation.

## MVP Now

MVP now should stay small and aligned with current app shell:

- keep Premium Home showing existing Today / `Мой Поток`;
- keep `Сборник рецептов` in Premium-only `Ещё`;
- keep recipe collection read-only;
- audit existing Today sections against the prototype's day macros, day states, meals, workout, and actions;
- keep Today actions read-only/local/navigation-only where persistence is not approved;
- preserve no-autowrite guardrails;
- preserve FREE manual diary/progress foundation.

Recommended next small package scope:

- audit current `/today`, `/premium-recipes`, Dashboard, and bottom nav against this report;
- no implementation unless a concrete small UI gap is found and approved.

## Next

Next after owner approval:

- define real 14-day plan data contract;
- define meal template and workout template fields;
- define recipe detail minimum data shape;
- define shopping list derived read model;
- define explicit confirmation boundaries for recipe-to-plan, recipe-to-diary, and workout start/completion;
- add tests that planned Premium data is never counted as completed Progress.

Suggested package:

- `POTOK_PREMIUM_14_DAY_PLAN_CONTRACT_DRAFT_READY`

## Later

Later only:

- plan recalculation after 14 days;
- AI replacements;
- adaptive calorie/macros suggestions;
- persisted Premium item statuses;
- persisted shopping checks;
- recipe-to-diary confirmation bridge;
- workout plan-to-diary bridge;
- coach/AI review layer.

All of these require separate owner approval and likely schema/RLS review.

## Requires Owner Approval

Owner approval is required before:

- implementing any new Premium runtime behavior;
- adding or changing SQL/schema/RLS;
- adding persisted Premium item statuses;
- adding shopping persistence;
- adding payment enforcement;
- creating diary entries from recipes;
- creating workout entries from planned workouts;
- adding AI/coach replacement logic;
- changing goal calculation formulas;
- changing Premium packaging or pricing.

## Risks

Main risks:

- prototype mock data can look product-ready but lacks production data boundaries;
- a 14-day plan can accidentally blur planned recommendations and completed facts;
- recipe/shopping features can become hidden diary write paths if not guarded;
- recalculation after 14 days needs clear inputs and safety constraints;
- Premium-only navigation must not hide core FREE flows;
- prototype `Подтвердить весь день` can become an unsafe bulk write if production semantics are not split into planned status and completed facts;
- prototype payment and local Premium state do not represent real entitlement or billing security.

Mitigations:

- keep package sizes small;
- keep planned data separate from completed facts;
- require explicit user confirmation before diary/workout writes;
- add tests for no Premium autowrites;
- keep recipe collection read-only until owner approves write bridge.

## Final Recommendation

Use the reviewed prototype as product-structure evidence only.

Recommended next small package:

- `POTOK_PREMIUM_TODAY_REFERENCE_ALIGNMENT_AUDIT_READY`

Then, if owner wants to move beyond audit:

- `POTOK_PREMIUM_14_DAY_PLAN_CONTRACT_DRAFT_READY`

Do not implement new Premium behavior from the prototype until owner approves the exact package.

## Safety Confirmation

Confirmed for this package:

- report-only;
- no runtime code changes;
- no UI changes;
- no SQL execution;
- no Supabase mutation;
- no staging mutation;
- no production changes;
- no Premium writes;
- no DB schema changes;
- no RLS policy changes;
- no payment enforcement;
- no API keys;
- no secrets;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**POTOK_PREMIUM_FLOW_REFERENCE_EXTRACTION_SOURCE_GROUNDED_READY**
