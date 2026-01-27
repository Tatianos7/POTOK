# Sprint 3 — Workout Full + Recipes (2 weeks)

## Sprint Goal
Завершить workout‑контур (упражнения, мышцы, прогресс, агрегаты) и сделать рецепты first‑class entity с AI‑связкой, outdated и конфликт‑детекцией.

## Scope (Stories IDs)
- Epic 3: 3.2 / 3.3
- Epic 4: 4.1 / 4.2 / 4.3
- Epic 5: 5.2–5.3
- Epic 7: 7.2–7.3

## User Stories
1) Exercise Selection & Muscle Mapping
2) Load Progress & Recalculation
3) Recipe Lifecycle (create → save → edit → use)
4) Favorites & Collections (recipes)
5) Recipe usage in Food Diary
6) AI Versioning & Reproducibility (base)
7) Conflict detection & resolution (base)

## DB Changes
- Indexes: `exercise_muscles(exercise_id, muscle_id)`
- `recipes` FTS index, `(user_id, created_at desc)`
- Unique: `favorite_recipes(user_id, recipe_id)`; `recipe_collections(user_id, recipe_id)`
- AI: `ai_meal_plans` indexes `input_hash`, `model_version`

## Service Changes
- `exerciseService` — mapping, dedupe, progress aggregation
- `workoutService` — progress + recalculation
- `recipesService` — lifecycle + validation + search
- `favoritesService` — recipes support
- `mealService` — recipe usage
- `aiMealPlansService` — outdated + versioning + dedupe
- Conflict resolver (base)

## AI Touchpoints
- Recipe change → meal plans outdated
- Goal change → requeue
- Workout progress → training insights queued

## E2E Scenarios Covered
- Scenario 3.2 / 3.3
- Scenario 4.1 / 4.2 / 4.3
- Scenario 5.2 / 5.3
- Scenario 7.2 / 7.3

## Acceptance Criteria
- Scenario 3.2 PASS
- Scenario 3.3 PASS
- Scenario 4.1 PASS
- Scenario 4.2 PASS
- Scenario 4.3 PASS
- Scenario 5.2 PASS (base)
- Scenario 5.3 PASS (base)
- Scenario 7.2 PASS (base)
- Scenario 7.3 PASS (base)

## Risks
- Inconsistent progress with partial data
- Recipe ↔ foods link issues
- Conflict detection gaps

## Definition of Done
- Workout full stable
- Recipes full stable
- AI versioning stable
- Conflict detection base validated

