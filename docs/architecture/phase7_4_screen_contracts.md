# Phase 7.4 — Screen Data Contracts (UI Runtime)

Формат:  
`Screen | Reads (SoT) | Writes | Derived | Explainability | Trust Impact | Premium Gate | Offline Fallback | Error Strategy`

---

## Goal
- Reads: `user_goals`
- Writes: `user_goals`, `nutrition_targets`
- Derived: daily macros
- Explainability: why targets
- Trust Impact: средний (+)
- Premium Gate: нет
- Offline Fallback: local cache
- Error Strategy: banner + retry

## Measurements
- Reads: `user_measurements`, `measurement_history`, `measurement_photos`
- Writes: `user_measurements`, `measurement_history`
- Derived: trend weight
- Explainability: точка А → динамика
- Trust Impact: средний (+)
- Premium Gate: нет
- Offline Fallback: local cache
- Error Strategy: banner + retry

## Food Diary
- Reads: `food_diary_entries`, `user_goals`
- Writes: `food_diary_entries`
- Derived: day totals, balance vs target
- Explainability: why balance
- Trust Impact: высокий (+)
- Premium Gate: нет
- Offline Fallback: local cache
- Error Strategy: banner + retry

## Training Diary
- Reads: `workout_days`, `workout_entries`
- Writes: `workout_entries`
- Derived: volume, 1RM, trend
- Explainability: why load
- Trust Impact: высокий (+)
- Premium Gate: нет
- Offline Fallback: local cache
- Error Strategy: banner + retry

## Progress
- Reads: `measurement_history`, `food_diary_entries`, `workout_entries`, `habit_logs`, `user_goals`, `program_sessions`
- Writes: `progress_snapshots`, `progress_trends`
- Derived: EMA, slope, insight
- Explainability: bundle per metric
- Trust Impact: высокий (+)
- Premium Gate: частично (insights/prognosis)
- Offline Fallback: cached snapshot
- Error Strategy: banner + retry

## Habits
- Reads: `habits`, `habit_logs`
- Writes: `habit_logs`
- Derived: streak, recovery
- Explainability: why habit matters
- Trust Impact: высокий (+)
- Premium Gate: нет
- Offline Fallback: local cache
- Error Strategy: banner + retry

## Today (Follow Plan)
- Reads: `program_sessions`, `program_days`, `food_diary_entries`, `workout_entries`
- Writes: `program_sessions`, `program_feedback`
- Derived: day status, adherence
- Explainability: why this day
- Trust Impact: высокий (+)
- Premium Gate: да
- Offline Fallback: read-only snapshot
- Error Strategy: banner + retry

## My Program
- Reads: `program_versions`, `program_blocks`, `program_days`
- Writes: none (view)
- Derived: timeline, phases
- Explainability: program rationale
- Trust Impact: высокий (+)
- Premium Gate: да
- Offline Fallback: cached plan
- Error Strategy: banner + retry

## Profile
- Reads: `user_profiles`, `entitlements`
- Writes: `user_profiles`
- Derived: account status
- Explainability: why gated
- Trust Impact: высокий (+)
- Premium Gate: нет
- Offline Fallback: local cache
- Error Strategy: banner + retry

## Paywall / Subscription
- Reads: `entitlements`, `subscription_status`
- Writes: `payment_intents`, `entitlement_updates`
- Derived: premium state
- Explainability: why locked
- Trust Impact: средний (+)
- Premium Gate: да
- Offline Fallback: cached entitlement
- Error Strategy: banner + retry

