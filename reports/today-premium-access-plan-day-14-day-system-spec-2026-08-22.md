# Today Premium Access Plan Day 14-Day System Spec

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_SMART_DAY_PRODUCT_SPEC_READY`
  - `TODAY_SMART_DAY_DEMO_FLOW_READY`
  - `TODAY_SMART_DAY_DEMO_FLOW_IA_CLEANUP_READY`
  - `TODAY_PREMIUM_RECIPES_SEPARATION_SPEC_READY`
  - `HOME_REMOVE_PREMIUM_BADGES_FROM_WORKOUTS_PROGRESS_READY`
- Verdict: **TODAY_PREMIUM_ACCESS_PLAN_DAY_14_DAY_SYSTEM_SPEC_READY**

## Scope

Product/spec only for the updated POTOK Premium entry, `План дня`, premium recipes access, 14-day plan structure, replacements, diary confirmation, shopping list direction, and plan-vs-fact Progress idea.

No runtime code, DB/schema/storage, migrations, payment, AI runtime, diary/workout writes, recipe import, voice input, Coach marketplace, or PR work was done.

## Product Decision

Premium is now a single clear entry on the Home screen before purchase. It should not mark baseline working sections like `Тренировки` or `Прогресс` as premium.

Before purchase:

- Home shows one premium entry card/button.
- The card opens a premium teaser/paywall sheet.
- The sheet explains value, not just a feature list.
- CTA is `Оформить подписку`.
- The CTA should later connect to the existing subscription/payment screen from profile.

After purchase:

- The same Home card changes into `План дня`.
- A separate `Сборник рецептов` card appears.
- `План дня` opens the premium execution world.
- `Сборник рецептов` opens the premium ready recipe library.

## Naming Options

Options:

- `POTOK Premium`
- `Премиум POTOK`
- `План дня Premium`
- `Умный план`
- `Мой план с POTOK`

Recommended default before purchase: `POTOK Premium`.

Reason: it is clear as a subscription entry and does not overpromise that a plan is already available before purchase.

Recommended default after purchase: `План дня`.

Reason: after subscription, the user should see the thing they use every day, not the billing tier.

## Before Purchase Flow

Home card:

- Title: `POTOK Premium`
- Subtitle: `Готовый план питания и тренировок под вашу цель`
- Behavior: opens a teaser/paywall sheet.

Paywall/teaser sheet should communicate:

- saves time every day;
- provides ready nutrition and workout plan;
- reduces manual searching;
- includes recipes with calories, macros, and grams;
- supports shopping list later;
- gives hints for users without kitchen scales;
- supports Progress analysis and corrections later.

Primary CTA:

- `Оформить подписку`

Future integration point:

- CTA should route to the existing subscription/payment screen that already exists in profile or subscription management.
- No payment implementation is part of this package.

## After Purchase Home Flow

Visible premium Home cards:

- `План дня`
- `Сборник рецептов`

`План дня` is the daily premium execution hub:

- user chooses or reviews the active plan;
- user sees today’s meals, workout, water/activity, and recommendations;
- user confirms only what was actually eaten or completed.

`Сборник рецептов` is the premium ready recipe library:

- owner/content team recipes;
- breakfast/lunch/dinner/snack categories;
- used by Smart Day, 14-day plans, and replacements;
- separate from free user-created `Мои рецепты`.

## План Дня Screen

If the user has no calculated goal:

- show empty state: `Рассчитайте цель — здесь появятся ваши планы.`
- show buttons:
  - `Рассчитать цель`
  - `Замеры`

Button behavior:

- `Рассчитать цель` links to the existing goal screen or future premium goal extension.
- `Замеры` links to the existing measurements screen.
- No plan cards appear until a goal exists.

If the user has a calculated goal:

- show 3-4 suggested 14-day plans;
- include nutrition-only plans;
- include training-only plans if the user selected training;
- include combined nutrition + training plans if selected;
- each plan can be opened and previewed;
- user can select one active plan.

## Premium Goal Extension

Useful future questions:

- goal type;
- meal count;
- cooking time;
- cooking for 1 day or for 2-3 days;
- food preferences;
- dislikes and restrictions;
- vegetarian, high-protein, simple-meals options;
- training place: home, gym, no equipment;
- training frequency;
- session duration;
- level.

This is not implemented now. It is a future premium onboarding extension.

## Ready Plans Strategy

Option A: owner-created plan database.

Pros:

- cheaper to run;
- safer;
- predictable calories and macros;
- easier QA;
- easier legal/content review;
- stable for recipes, shopping lists, and replacements.

Cons:

- requires content production;
- less personalized at the beginning.

Option B: AI-generated plans.

Pros:

- can feel highly personalized;
- can cover more combinations quickly.

Cons:

- higher runtime cost;
- harder QA;
- less predictable calories/macros;
- higher risk of unsafe or inconsistent recommendations;
- harder to guarantee ingredient availability and shopping list quality.

Recommendation:

Start with owner-created 14-day plans/templates. Later, AI should select, adapt, and explain approved content instead of inventing the whole plan from scratch.

## 14-Day Plan Structure

Each plan:

- duration: 14 days;
- reviewed or recalculated every 14 days;
- contains days 1-14;
- can be previewed ahead;
- allows editing future days;
- updates the shopping list when future planned days change;
- never changes past diary facts.

Each day:

- daily calories/protein/fat/carbs;
- meals:
  - breakfast;
  - lunch;
  - dinner;
  - snack;
- optional workout if the plan includes training.

Each meal:

- grams;
- calories/protein/fat/carbs;
- ingredients;
- preparation method;
- visual portion hints for users without scales.

## Day State Inside Selected Plan

States:

- `Обычный день` as default;
- `Нет сил` / fatigue;
- `Нет времени`;
- `Готова работать`.

Behavior for `Нет сил` / fatigue:

- suggest light energy addition like banana, yogurt, or snack if appropriate;
- make workout easier;
- reduce load;
- replace with a walk if needed.

Behavior for `Нет времени`:

- suggest quick meals or snacks;
- prioritize simple work-friendly options;
- offer short workout/exercise options.

Behavior for `Готова работать`:

- supportive praise;
- full plan;
- optional stronger focus if safe.

Guardrails:

- no medical claims;
- no automatic diary changes;
- all plan changes remain planned until confirmed by the user.

## Replacements

For each meal, product, or recipe, show `Заменить`.

Replacement list should prefer options with:

- similar calories;
- similar protein;
- same meal type;
- user restrictions respected later.

Replacement behavior:

- updates the planned day calories/macros;
- updates the shopping list source;
- does not change diary facts.

## Confirming Meals To Diary

Option A: one button to confirm the whole day.

Pros:

- fastest for users who follow the plan exactly;
- convenient for routine days.

Cons:

- too coarse if breakfast was followed but lunch/dinner changed;
- higher risk of inaccurate diary entries.

Option B: per-meal confirmation.

Pros:

- more accurate;
- matches real behavior;
- reduces accidental diary writes;
- keeps plan and fact clearly separated.

Cons:

- more taps.

Recommendation:

Primary: per-meal confirmation.

Secondary convenience: `Подтвердить весь день по плану` with a confirmation bottom sheet.

Rules:

- no automatic diary writes;
- confirmation is always required;
- confirmation sheet shows ingredients, grams, calories, protein, fat, and carbs;
- future implementation creates diary snapshots only after confirmation.

## Shopping List

Plan-level button: `Список покупок`.

User can select:

- 1 day;
- 2 days;
- 3 days;
- 7 days;
- custom later.

Rules:

- same ingredients are summed;
- repeated products are not duplicated;
- if Day 1 has 3 carrots and Day 2 has 2 carrots, the list shows 5 carrots;
- if grams exist, grams are source of truth;
- checkboxes allow marking purchased items;
- if an item is not checked, POTOK can show a subtle reminder near the product in plan: `Не куплено`.

## Plan Vs Fact / Progress Deviation

Owner idea:

The user may replace the planned item or log actual food in the diary instead of changing the plan.

Progress can compare:

- planned calories/protein/fat/carbs;
- actual diary calories/protein/fat/carbs;
- deviation.

Examples:

- planned 1650 kcal, actual 1830 kcal, deviation +180 kcal;
- planned protein 120 g, actual 82 g, protein below plan.

Recommendation:

Use both paths:

- future plan edits happen in `План дня`;
- actual changes happen in diary;
- Progress shows deviations from plan.

Guardrails:

- no guilt copy;
- no historical recompute;
- past diary facts stay as they were confirmed.

## Screen Principle

One screen = one function.

Avoid a long stacked scroll wall. Use focused surfaces:

- paywall sheet;
- confirm bottom sheets;
- portion hint bottom sheets;
- separate Program Day screen;
- separate Recipe Detail screen;
- separate Shopping List screen.

## Non-Goals

- no runtime code;
- no DB migration;
- no payment implementation;
- no AI runtime;
- no real diary writes;
- no recipe import;
- no shopping list runtime;
- no voice input;
- no Coach marketplace.

## Recommended Next Step

After this spec:

- audit existing Home card/payment/subscription routing;
- audit current goal screen and measurement screen;
- then implement a small UI-only access-state mock if needed.

## Safety Confirmation

This package is reports/spec only:

- no runtime code changed;
- no DB/schema/storage changes;
- no migrations;
- no production data changes;
- no payment changes;
- no AI runtime;
- no diary/workout writes;
- no recipe import;
- no voice input;
- no PR.

## Final Verdict

**TODAY_PREMIUM_ACCESS_PLAN_DAY_14_DAY_SYSTEM_SPEC_READY**
