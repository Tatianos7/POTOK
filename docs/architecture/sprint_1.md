# Sprint 1 — Foundation & Critical Path Start (2 weeks)

## Sprint Goal
Закрепить критический путь MVP: авторизация, профиль/цели, базовый дневник питания (day lifecycle), базовый AI lifecycle и базовая идемпотентность.

## Scope (Stories IDs)
- Epic 1: 1.1 / 1.2 / 1.3
- Epic 2: 2.1
- Epic 5: 5.1 (base lifecycle)
- Epic 7: 7.1 (idempotency base)

## User Stories
1) Onboarding → Profile → Goals → First AI Recommendation
2) Food Diary Day Lifecycle (open → add → close → AI queued)
3) AI Lifecycle base (queued → running → completed)
4) Idempotency for Food Diary (exactly‑once)

## DB Changes
- RLS checks for `user_profiles`, `user_goals`, `food_diary_entries`, `ai_recommendations`
- Uniqueness checks for `user_goals.user_id` and `food_diary_entries` idempotency key
- Apply `ai_schema_extensions.sql`

## Service Changes
- `AuthContext` (auth.uid())
- `profileService` (save/update)
- `goalService` (upsert + validations)
- `mealService` (day lifecycle + closeDay → AI queued)
- `aiRecommendationsService` (lifecycle base)

## AI Touchpoints
- `ai_recommendations` queued on goal save and closeDay
- Base lifecycle: queued → running → completed

## E2E Scenarios Covered
- Scenario 1.1, 1.2, 1.3
- Scenario 2.1
- Scenario 5.1 (base)
- Scenario 7.1 (idempotency base)

## Acceptance Criteria
- Scenario 1.1–1.3 PASS
- Scenario 2.1 PASS
- Scenario 5.1 base PASS
- Scenario 7.1 base PASS

## Risks
- RLS errors
- Duplicate saves
- Incomplete AI lifecycle

## Definition of Done
- All Sprint 1 scenarios pass E2E v2
- No local fallback write
- Idempotency confirmed
- AI lifecycle stable

