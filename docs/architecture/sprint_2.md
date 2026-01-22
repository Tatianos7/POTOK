# Sprint 2 — Food Diary Full + Workout Base (2 weeks)

## Sprint Goal
Завершить полный жизненный цикл дня питания и запустить базовый дневник тренировок с корректным AI‑outdated/requeue и базовой устойчивостью retry/conflict.

## Scope (Stories IDs)
- Epic 2: 2.2 / 2.3
- Epic 3: 3.1
- Epic 5: 5.1–5.2 (outdated + dedupe + guard base)
- Epic 7: 7.1–7.2 (retry, conflict base)

## User Stories
1) Favorites & Notes Consistency
2) Day Reopen & Recalculation
3) Workout Day Lifecycle (open → add → close → AI queued)
4) AI outdated/requeue after changes
5) Retry/conflict baseline safety

## DB Changes
- Uniqueness: `meal_entry_notes(meal_entry_id)`, `favorite_products(user_id, product_name)`, `workout_days(user_id, date)`
- Dedupe indexes for AI (`input_hash`)
- RLS check for `workout_days/workout_entries`

## Service Changes
- `mealEntryNotesService` — upsert, 1‑to‑1
- `favoritesService` — upsert, no duplicates
- `mealService` — reopenDay + recalculation + AI outdated
- `workoutService` — day lifecycle + closeDay → AI queued
- `aiRecommendationsService` — outdated logic
- `aiTrainingPlansService` — queued + outdated

## AI Touchpoints
- Food day change → outdated
- closeDay → queued
- Workout closeDay → training plan queued

## E2E Scenarios Covered
- Scenario 2.2 / 2.3
- Scenario 3.1
- Scenario 5.1–5.2 (base)
- Scenario 7.1–7.2 (base)

## Acceptance Criteria
- Scenario 2.2 PASS
- Scenario 2.3 PASS
- Scenario 3.1 PASS
- Scenario 5.1–5.2 PASS (base)
- Scenario 7.1–7.2 PASS (base)

## Risks
- AI outdated not triggered on reopen
- Conflicts on parallel edits

## Definition of Done
- Food day lifecycle complete
- Workout base complete
- AI outdated/requeue stable
- Retry/conflict base validated

