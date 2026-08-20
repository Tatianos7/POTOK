# POTOK Plans Demo To Today Flow Spec

- Date: 2026-08-19
- Branch: `master`
- Status basis:
  - `TODAY_PAID_ENTRY_DEPLOYED`
  - `TODAY_PLAN_AND_PROGRAM_ARCHITECTURE_SPEC_READY`
- Verdict: **TODAY_PLAN_AND_PROGRAM_ARCHITECTURE_SPEC_READY**

## Scope

Spec for the first demo POTOK Plans -> Today flow.

No runtime code, DB/schema/storage, migrations, payment, production data, AI generation, Plan Store implementation, diary/workout writes, or PR work was done.

## MVP Demo Plans Concept

POTOK Plans should prove the product idea before commerce:

- a plan is not a PDF;
- a plan unfolds by days;
- a selected program day becomes Today cards;
- Today remains the daily execution surface;
- diary/workout facts are created only after explicit user action.

## Demo Catalog

First implementation can use a static/mock catalog:

```ts
interface DemoPlanProduct {
  id: string;
  title: string;
  subtitle: string;
  duration_days: number;
  goal: 'fat_loss' | 'muscle_gain' | 'maintenance' | 'general_fitness';
  level: 'beginner' | 'intermediate' | 'advanced';
  days: DemoProgramDay[];
}
```

Recommended first demo:

- title: `Стартовая неделя POTOK`;
- duration: 7 days;
- goal: general fitness / rhythm;
- includes simple nutrition and workout/task items;
- no medical claims;
- no payment.

## Demo Program Day Structure

```ts
interface DemoProgramDay {
  day_index: number;
  title: string;
  focus: string;
  items: Array<{
    type: 'meal' | 'workout' | 'water' | 'task';
    title: string;
    subtitle?: string;
    scheduled_time?: string;
    payload: Record<string, unknown>;
  }>;
}
```

Day examples:

- meal: `Завтрак с белком`;
- workout: `Тренировка ног и корпуса`;
- water: `Вода в течение дня`;
- task: `Проверить самочувствие вечером`.

## Program Day Becomes TodayPlan

Conversion rule:

```text
DemoProgramDay + user + date -> TodayPlan(source: purchased_plan) -> TodayItems
```

Mapping:

- `TodayPlan.id`: local/mock generated id;
- `TodayPlan.user_id`: current user id;
- `TodayPlan.source`: `purchased_plan`;
- `TodayPlan.title`: demo day title;
- `TodayPlan.date`: selected execution date;
- `TodayPlan.status`: `active`;
- `TodayItem.source`: `purchased_plan`;
- `TodayItem.status`: `planned`;
- `TodayItem.snapshot`: exact user-visible card content.

## No-PDF Principle

The plan should be experienced inside Today:

- not a downloadable/static document;
- not a long article;
- not only a list in `/my-program`;
- it becomes daily execution cards with actions.

## No-Autowrite Principle

Activating a day:

- creates/sets mock TodayPlan state only;
- does not call `mealService.addMealEntry`;
- does not call `workoutService.addExercisesToWorkout`;
- does not update `program_sessions`;
- does not mutate Progress.

Actual write must happen later through explicit diary/workout confirmation.

## UI Flow

Recommended first flow:

```text
/today
  -> tap Готовые программы
  -> demo program catalog/list
  -> open demo program
  -> choose/activate day
  -> Today cards render from TodayPlan
```

For MVP, this can live inside `/today` as an expanded state or lightweight sub-view. Do not add a second Today-like route.

## Today Cards For Demo

Card actions:

- meal: `Выполнено`, `Не подходит`, `Перейти в дневник`;
- workout: `Начать тренировку`, `Не подходит`;
- water/task: `Выполнено`, `Пропустить`.

For the first implementation, actions may be placeholders/navigation except where explicitly owner-approved.

## Implementation Steps For Next Task

1. Add shared `TodayPlan` / `TodayItem` types.
2. Add a mock demo plan catalog module.
3. Add local/mock active TodayPlan provider.
4. Make `/today` Plans card open demo plans state.
5. Add demo program details and day activation.
6. Render Today cards from the active demo TodayPlan.
7. Keep the free Progress link visible.
8. Add tests:
   - demo catalog renders;
   - demo day converts to TodayPlan;
   - item source is `purchased_plan`;
   - no diary/workout write service is called;
   - Progress route remains intact.

## Future

After demo validation:

- replace static catalog with Supabase plan products;
- add purchase ownership;
- add server-side entitlement/purchase checks;
- add program versioning and day unlock rules.

## Final Status

The first POTOK Plans implementation should be demo/local/mock and should prove the daily execution loop before DB/payment.
