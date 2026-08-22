# TODAY Premium Smart Day Product Spec

- Date: 2026-08-21
- Branch: `master`
- Status basis:
  - `TODAY_PAID_ENTRY_DEPLOYED`
  - `TODAY_PLAN_AND_PROGRAM_ARCHITECTURE_SPEC_READY`
  - `POTOK_PLANS_DEMO_TO_TODAY_FLOW_READY`
  - `POTOK_PLANS_DEMO_TO_TODAY_FLOW_COPY_UX_POLISH_READY`
- Verdict: **TODAY_PREMIUM_SMART_DAY_PRODUCT_SPEC_READY**

## Scope

Product/spec only for POTOK TODAY Premium and the Smart Day concept.

No runtime code, DB/schema/storage, migrations, production data, payment, AI generation, diary/workout writes, Plan Store implementation, Coach marketplace, voice input, PR, or commit work was done.

## Owner Decision

TODAY Premium should be built around daily execution support, not around voice input or a chat-first assistant.

Owner-approved premium pillars:

- Smart Day;
- ready-made recipes;
- ready-made nutrition and training plans;
- fast diary logging after explicit confirmation;
- AI support and adjustments;
- shopping list later.

## Voice Input Removed From Roadmap

Voice input is removed from the TODAY Premium roadmap.

It should not be included in Smart Day MVP, AI companion MVP, content structure, or implementation order. If voice is reconsidered later, it should be a separate owner-approved package, not part of the premium core.

## TODAY Premium Definition

POTOK TODAY Premium is a subscription where POTOK assembles a concrete day for the user:

- what to eat;
- how to train or move;
- what to pay attention to;
- what can be simplified or replaced;
- how today connects to goal, condition, and progress.

TODAY Premium is not a free checklist. Free POTOK remains goal, diaries, Progress, hints, and Daily Goal/Game Layer in Progress.

## Subscription Value Proposition

The paid value is:

```text
Do not think. Open Today. Choose how you feel. POTOK assembles the day.
```

Premium should reduce planning friction:

- less decision fatigue;
- ready day structure;
- safe replacements;
- quicker confirmation into diaries;
- adaptive corrections over time.

## Smart Day Concept

Smart Day is the first premium execution surface.

The user starts by choosing the state of the day. POTOK then builds a realistic day from recipes, meal templates, workout templates, goals, progress, and later AI analysis.

Smart Day is a daily plan builder, not a diary writer.

## Day States

MVP day states:

- `Нет сил`: lighter nutrition/training expectations, simpler meals, recovery-friendly movement;
- `Обычный день`: balanced default plan for goal and current program;
- `Готова работать`: more structured training day and fuller execution plan, still within safety boundaries.

These states should map to Today plan intensity, not to medical diagnosis.

## “Собрать день” Flow

Recommended MVP flow:

1. User opens `/today`.
2. User selects state:
   - `Нет сил`;
   - `Обычный день`;
   - `Готова работать`.
3. User taps `Собрать день`.
4. POTOK assembles a day plan.
5. User sees `Сегодня готово`.

## “Сегодня готово” Screen

The generated day should show:

- nutrition;
- workout or activity;
- water/activity reminder;
- short recommendations.

The screen should feel like execution guidance, not a marketplace or payment wall.

## Minimum User Actions

Primary actions:

- `Принять день`;
- `Выполнено`;
- `Не подходит`;
- `Сделать проще`;
- `Заменить питание`;
- `Заменить тренировку`.

Actions must stay explicit. They should not silently create diary or workout facts.

## Planned-Vs-Actual Guardrail

Critical product rule:

```text
План не записывается в дневник автоматически.
В дневник попадает только то, что пользователь подтвердил или выполнил.
```

Correct cycle:

```text
Plan Source -> Today Plan -> Today Items -> User Action -> Diary/Workout/Progress
```

## MVP Scope

Recommended Smart Day MVP:

- state selector;
- `Собрать день`;
- demo/generated Today plan from existing templates;
- `Сегодня готово`;
- meal/workout/water/recommendation cards;
- explicit actions only;
- no-autowrite guardrails;
- local/mock state if needed before persistence is approved.

## Non-Goals

Not in MVP:

- voice input;
- real payment implementation;
- AI generation in production;
- trainer marketplace;
- Coach Network;
- full Plan Store purchase flow;
- automatic diary/workout/water writes;
- medical advice;
- shopping list;
- DB persistence until separately approved.

## Final Status

TODAY Premium should proceed as Smart Day plus content and AI action support. Voice input is removed from the premium roadmap.
