# Today Plan And Program Architecture Spec

- Date: 2026-08-19
- Branch: `master`
- Status basis:
  - `TODAY_PAID_ENTRY_DEPLOYED`
  - `PROGRESS_DAILY_GOAL_CUSTOMIZATION_DEPLOYED`
- Verdict: **TODAY_PLAN_AND_PROGRAM_ARCHITECTURE_SPEC_READY**

## Scope

Audit/spec only for the first implementation path toward Today Plans and POTOK AI through one shared Today Plan model.

No runtime code, DB/schema/storage, migrations, production data, payment, AI generation, Plan Store implementation, Coach marketplace, diary/workout writes, or PR work was done.

## Current App Audit

Current routes:

- `/today` is registered and opens the paid Today entry screen.
- `/my-program` is registered and remains a legacy/current program overview.
- Dashboard/home plan entry routes were moved to `/today`.
- `/plans` and `/plan` are not registered as routes.

Current `/today`:

- paid entry only;
- shows `POTOK AI`, `Готовые программы`, and `Персональный тренер`;
- does not load `uiRuntimeAdapter`, `programUxRuntimeService`, `mealService`, or `workoutService`;
- does not call diary/workout write paths.

Existing program layer:

- `programDeliveryService` uses Supabase RPCs/tables such as `get_active_program`, `get_program_days`, `get_program_day_details`, `program_sessions`, `program_days`, `program_feedback`, `program_guard_events`, `program_explainability`.
- `programUxRuntimeService` wraps program days into `ProgramTodayDTO` / `ProgramMyPlanDTO` and includes `completeToday`, `skipToday`, and feedback flows.
- Existing program type is `nutrition | training`; it is not yet a source abstraction for `ai | purchased_plan | coach`.

Existing write paths:

- Food diary actual entries are written through `mealService` methods such as `addMealEntry`, `updateMealEntry`, `removeMealEntry`, `saveMealsForDate`.
- Workout actual entries are written through `workoutService` methods such as `addExercisesToWorkout`, `updateWorkoutEntry`, `deleteWorkoutEntry`, `deleteWorkoutDay`.
- Water is currently stored in `DailyMeals.water` localStorage state, not as a confirmed Supabase schema field.

Progress dependencies:

- `ProgressHubService` derives Progress from goal, nutrition progress, current day meals, current day workouts, measurements, and workout progress.
- Progress Daily Goal/Game Layer reads existing facts; it does not create diary/workout/water records.
- `progressAggregatorService` can include `program_sessions` adherence, but primary Progress remains actual diary/workout/measurement facts.

Premium/payment placeholders:

- `Paywall` and `entitlementService` exist.
- `profile.has_premium`, `user.hasPremium`, and entitlement flags exist.
- Payment implementation is not part of this package.

## Source Abstraction

Recommended source enum:

```ts
type TodayPlanSource = 'ai' | 'purchased_plan' | 'coach';
```

Do not add `self` / `self_guided` as a Today source.

Reason:

- Free self-directed behavior belongs to Goal, diaries, Progress, hints, and Progress Daily Goal/Game Layer.
- Today is the paid execution mode for a concrete plan.

## Recommended TodayPlan Model

```ts
type TodayPlanStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'partially_completed'
  | 'skipped'
  | 'expired';

interface TodayPlan {
  id: string;
  user_id: string;
  source: TodayPlanSource;
  title: string;
  date: string;
  status: TodayPlanStatus;
  items: TodayItem[];
  created_at: string;
  updated_at: string;
}
```

Notes:

- `date` is the execution day.
- `status` describes Today plan execution state, not diary fact state.
- `items` can be embedded in the first local/mock implementation and normalized later.

## Recommended TodayItem Model

```ts
type TodayItemType = 'meal' | 'workout' | 'water' | 'steps' | 'habit' | 'task';

type TodayItemStatus =
  | 'planned'
  | 'done'
  | 'skipped'
  | 'not_suitable'
  | 'replaced';

interface TodayItem {
  id: string;
  plan_id: string;
  type: TodayItemType;
  title: string;
  subtitle?: string;
  scheduled_time?: string;
  status: TodayItemStatus;
  source: TodayPlanSource;
  payload: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  linked_diary_entry_id?: string | null;
  linked_workout_session_id?: string | null;
}
```

Notes:

- `payload` is the operational instruction.
- `snapshot` freezes the user-visible plan item as presented.
- Link fields are set only after explicit user action creates or confirms actual diary/workout data.

## Planned Vs Actual Boundary

Rules:

- Planned meal item does not automatically create a `food_diary_entries` row.
- Planned workout item does not automatically create `workout_days` or `workout_entries`.
- `done` on a Today item is not automatically equivalent to a diary fact unless the execution bridge explicitly creates/links an actual record.
- Progress stays based on actual diary/workout/measurement data.
- Today can show plan completion separately from Progress facts.

Correct flow:

```text
Plan Source -> Today Plan -> Today Items -> User Action -> Diary/Workout Actual -> Progress
```

## Execution Flows

Meal item:

- `Выполнено`: confirm/log flow; should require explicit confirmation before diary write.
- `Изменить`: edit planned item or route to diary depending on implementation phase.
- `Не подходит`: open reason flow.
- `Перейти в дневник`: navigate to Food Diary without writing automatically.

Workout item:

- `Начать тренировку`: open workout execution flow or Workout Diary with plan context.
- `Не подходит`: open reason flow.
- `Изменить позже`: defer mutation/replacement.
- `Завершить тренировку`: through workout flow only; then link actual workout session/entries.

Generic item:

- `Выполнено`: item-level completion only.
- `Пропустить`: item-level skipped state.

## “Не Подходит” Flow

Nutrition reasons:

- `no_products`: нет продуктов;
- `dislike`: не люблю;
- `no_time_to_cook`: нет времени готовить;
- `eating_out`: ем вне дома;
- `portion_not_suitable`: порция не подходит;
- `other`: другое.

Workout reasons:

- `no_equipment`: нет оборудования;
- `no_time`: нет времени;
- `too_hard`: слишком сложно;
- `pain_or_discomfort`: боль/дискомфорт;
- `other`: другое.

Safety:

- Pain/discomfort must not trigger automatic workout replacement.
- Do not provide medical advice.
- AI replacement is later and guarded.
- Coach attention is later.

## Guardrails

- No self-guided Today mode.
- No automatic diary writes.
- No automatic workout session creation.
- No payment in the first architecture package.
- No AI generation in the first implementation package.
- No Plan Store commerce in the first implementation package.
- No coach marketplace.
- No Progress mutation from planned items.

## Data / Storage Recommendation

### A. Local/Mock/Demo First

Recommended for first implementation.

Use TypeScript types plus a local/mock provider:

- faster;
- no migration/RLS risk;
- validates UI and execution flow;
- enables demo Plans -> Today activation;
- keeps paid infrastructure separate from actual diary writes.

Limitations:

- not synced across devices;
- not production purchase state;
- not durable paid entitlement history.

### B. Future Supabase Tables

Likely future tables:

- `today_plans`;
- `today_items`;
- `programs` or `plan_products`;
- `program_days`;
- `program_day_items`;
- `plan_purchases`;
- optional `today_item_events`.

Future RLS guardrails:

- user can select/read/write only own `today_plans` and `today_items`;
- coach can read/write assigned client plans only through explicit coach-client relationship;
- plan product catalog can be public read / admin write;
- purchases must be server-confirmed, not client-trusted;
- AI-generated draft plans must be user-owned and require confirmation before active state;
- linked diary/workout ids must belong to the same user.

## Next Implementation Package

`POTOK_PLANS_DEMO_TO_TODAY_FLOW_READY`

Suggested scope:

- add shared TodayPlan/TodayItem TypeScript types;
- add mock/demo Today plan provider;
- add one demo program with day structures;
- implement demo Plans -> Today activation flow without DB/payment;
- render Today item cards from mock active plan;
- add no-autowrite tests.

## Final Status

The architecture should proceed through a shared TodayPlan model. POTOK AI and POTOK Plans should both produce the same TodayPlan/TodayItem shape before execution actions bridge into actual diary/workout flows.
