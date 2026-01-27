# Domain Contracts (Canonical)

## Food
**Tables**: `food_diary_entries`, `foods`, `favorite_products`, `meal_entry_notes`, `user_goals`, `ai_recommendations`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- `user_id = auth.uid()`
- Non-negative macros
- One note per diary entry
**State Machines**:
- Day: `empty → partial → completed → analyzed`
**AI Touchpoints**:
- closeDay → AI queued
- day update → AI outdated
**Scaling Notes**:
- Index `(user_id, date, meal_type)`; precompute aggregates at 50k+

## Workout
**Tables**: `workout_days`, `workout_entries`, `exercises`, `exercise_muscles`, `muscles`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- One day per `(user_id, date)`
- Entries linked to workout_day_id
**State Machines**:
- Day: `empty → partial → completed → analyzed`
**AI Touchpoints**:
- closeDay → AI training plan queued
**Scaling Notes**:
- Index `(user_id, date)`; aggregate by date range

## Recipes
**Tables**: `recipes`, `recipe_ingredients`, `favorite_recipes`, `recipe_collections`, `recipe_notes`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- Recipe belongs to one user
- Ingredient macros sum to recipe macros
**State Machines**:
- `draft → saved → edited → archived`
**AI Touchpoints**:
- Recipe changes → meal plans outdated
**Scaling Notes**:
- FTS index on `recipes`

## Goals
**Tables**: `user_goals`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- One active goal per user
**State Machines**:
- `draft → active → outdated`
**AI Touchpoints**:
- Goal save queues AI bootstrap
**Scaling Notes**:
- Upsert by user_id

## Progress
**Tables**: `user_measurements`, `measurement_history`, `food_diary_entries`, `workout_entries`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- One measurement per date
**State Machines**:
- `baseline → trend → recalculated`
**AI Touchpoints**:
- Progress deltas → AI feedback
**Scaling Notes**:
- Periodic aggregates by week/month

## Habits
**Tables**: `habits`, `habit_logs`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- One log per habit per day
**State Machines**:
- `created → active → paused → archived`
- `streak_active → streak_broken → restarted`
**AI Touchpoints**:
- Adherence triggers nudges
**Scaling Notes**:
- Unique `(user_id, habit_id, date)`

## Reports
**Tables**: `report_snapshots`, `report_aggregates`, `ai_recommendations`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- One snapshot per period per user
**State Machines**:
- `requested → generating → ready → outdated → archived`
**AI Touchpoints**:
- Report interpretation queued
**Scaling Notes**:
- MV for aggregates at 50k+

## AI
**Tables**: `ai_recommendations`, `ai_meal_plans`, `ai_training_plans`, `ai_feedback`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- `input_hash` + `model_version` required
- explainability required
**State Machines**:
- `queued → running → validating → completed|failed → outdated`
**AI Touchpoints**:
- Centralized
**Scaling Notes**:
- Dedupes + rate limits

## Resilience
**Tables**: `pending_writes` (optional), `audit_logs`
**RLS**: `auth.uid() = user_id`
**Invariants**:
- Exactly-once semantics
**State Machines**:
- `pending → retrying → synced`
**AI Touchpoints**:
- Queue after recovery
**Scaling Notes**:
- Circuit breaker + backoff

