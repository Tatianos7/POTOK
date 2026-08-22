# Today Premium Access Plan Day Owner Amendments

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_ACCESS_PLAN_DAY_14_DAY_SYSTEM_SPEC_READY`
- Verdict: **TODAY_PREMIUM_ACCESS_PLAN_DAY_OWNER_AMENDMENTS_READY**

## Scope

Owner-approved amendments for the POTOK Premium access and 14-day plan system spec.

This is a report/spec-only package. No runtime code, DB/schema/storage, migrations, payment, AI runtime, diary/workout writes, recipe import, voice input, Coach marketplace, or PR work was done.

## Owner-Approved Changes

The base spec remains valid, with the amendments below taking precedence:

- after purchase, the premium Home card is named `Мой Поток`;
- after-purchase subtitle remains `Ваше питание, тренировки и рекомендации на сегодня`;
- before purchase remains `POTOK Premium`;
- premium empty state button `Замеры` becomes `Создать замеры`;
- AI must not be sold in the teaser/paywall before AI runtime exists;
- 14-day plan lifecycle includes a check-in after day 14;
- premium goal extension adds `Нет времени` as a key lifestyle/input factor.

## Updated Naming

Before purchase:

- Title: `POTOK Premium`
- Subtitle: `Готовый план питания и тренировок под вашу цель`

After purchase:

- Title: `Мой Поток`
- Subtitle: `Ваше питание, тренировки и рекомендации на сегодня`

Reason:

`Мой Поток` feels like the user’s personal premium space, not just a generic plan page or billing tier. It can hold nutrition, training, recipes, recommendations, check-ins, and future adjustments without narrowing the product too early.

## Updated Before-Purchase Home Card Logic

Before an active Premium subscription:

- Home shows one premium entry card: `POTOK Premium`.
- Subtitle: `Готовый план питания и тренировок под вашу цель`.
- Tapping the card opens a teaser/paywall sheet.
- The teaser explains concrete value and avoids promising unavailable runtime AI.
- CTA: `Оформить подписку`.
- The CTA is a future integration point to the existing subscription/payment screen.

No payment implementation is part of this spec.

## Updated After-Purchase Home Card Logic

After an active Premium subscription:

- the same Home entry changes from `POTOK Premium` to `Мой Поток`;
- subtitle becomes `Ваше питание, тренировки и рекомендации на сегодня`;
- `Мой Поток` opens the premium daily execution hub;
- a separate `Сборник рецептов` card appears only for active Premium users.

`Мой Поток` includes:

- today’s selected or generated plan;
- nutrition;
- workouts;
- water/activity;
- recommendations;
- confirmations and replacements;
- future 14-day check-ins.

`Сборник рецептов` includes:

- premium ready recipes created by POTOK/content team;
- breakfasts, lunches, dinners, and snacks;
- recipes with calories, macros, grams, ingredients, preparation, and portion hints;
- no PDF/download-first behavior.

## Updated Empty State Buttons

If the user has no calculated goal, the premium `Мой Поток` screen should show:

- empty state: `Рассчитайте цель — здесь появятся ваши планы.`
- buttons:
  - `Рассчитать цель`
  - `Создать замеры`

Button behavior:

- `Рассчитать цель` links to the existing goal screen or future premium goal extension;
- `Создать замеры` links to the existing measurements flow;
- no plan cards appear until a goal exists.

## Paywall AI Exclusion Rule

Do not show AI as a selling point in the premium teaser/paywall until AI runtime exists.

The paywall should sell only clear, understandable, near-term value:

- saving time;
- ready nutrition and workout plans;
- recipes with calories, macros, and grams;
- meal replacements;
- shopping list;
- visual portion hints for users without scales;
- progress control.

AI can remain in internal roadmap/specs, but should not be presented as an active paid value before the runtime is implemented and safe to expose.

## 14-Day Check-In Addition

The 14-day plan lifecycle must include a short check-in after day 14.

Check-in questions:

- does the user like the plan;
- well-being;
- hunger/satiety;
- energy;
- cooking convenience;
- workout difficulty;
- whether the user wants to continue, simplify, or change the plan.

After the check-in, POTOK can suggest:

- continuing the current direction;
- simplifying the next cycle;
- changing meals or training structure;
- recalculating or adjusting the goal;
- updating the next 14-day plan.

Guardrails:

- do not make medical claims;
- do not auto-apply calorie or plan changes;
- ask for confirmation before any future goal or plan update;
- past diary facts are not recomputed.

## Premium Goal Extension Addition: Нет Времени

`Нет времени` should be treated as an important lifestyle/input factor during future premium onboarding and plan adjustment.

Useful questions:

- how often the user has days without time;
- whether the user needs quick meals;
- whether cooking for 2-3 days is preferred;
- whether portable snacks are needed;
- whether short workouts are needed.

How this affects plans:

- more quick meals;
- fewer complex recipes;
- more batch-cooking options;
- snacks suitable to take with the user;
- shorter workouts or exercise blocks;
- more practical replacements for workdays and busy days.

This is not implemented now. It is a future input model requirement.

## Final Updated Product Summary

POTOK Premium should be presented as one clear upgrade path:

- before purchase: `POTOK Premium`;
- after purchase: `Мой Поток`;
- after purchase extra entry: `Сборник рецептов`;
- no premium badges on baseline `Тренировки` and `Прогресс`;
- no AI promise in paywall before runtime exists.

`Мой Поток` is the premium daily execution hub:

- it uses the user’s goal and preferences;
- proposes ready nutrition, workouts, water/activity, and recommendations;
- supports 14-day plan cycles;
- checks in after 14 days;
- allows replacements and simplification;
- keeps plan and diary facts separate.

Critical guardrail remains:

`План не записывается в дневник автоматически. В дневник попадает только то, что вы подтвердили или выполнили.`

## Safety Confirmation

- Reports only.
- No runtime code.
- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No payment changes.
- No AI runtime.
- No diary/workout writes.
- No recipe import.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_ACCESS_PLAN_DAY_OWNER_AMENDMENTS_READY**
