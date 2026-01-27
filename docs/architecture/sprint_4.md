# Sprint 4 — Reports + Progress + Habits (Foundation) (2 weeks)

## Sprint Goal
Запустить отчёты и прогресс‑контур (вес/объёмы/КБЖУ/нагрузки), заложить фундамент привычек с adherence + AI‑интерпретацией, закрыть устойчивость для отчётов и привычек.

## Scope (Stories IDs)
- Epic 6: 6.1 / 6.2 / 6.3
- Progress domain (weekly/monthly deltas, trends)
- Habits domain (create habit, track, streak, AI feedback)
- Epic 5: explainability + feedback loop
- Epic 7: resilience for reports & habits

## User Stories
1) Report Snapshot Lifecycle
2) Report Aggregates & Precomputation
3) Report AI Interpretation
4) Progress Trends (weight/measurements/macros/load)
5) Habits Lifecycle (create → track → streak → adherence)
6) AI Feedback for progress & habits
7) Resilience for reports/habits

## DB Changes
- `report_snapshots` / `report_aggregates` indexes
- `progress_trends` scaffold
- `habits` / `habit_logs` unique `(user_id, habit_id, date)`
- AI explainability + feedback fields
- RLS canonical for reports/habits

## Service Changes
- `reportService` — snapshot lifecycle + aggregates fetch
- `analyticsService` — progress deltas & trends
- `habitsService` — create/track/streak/adherence
- `aiRecommendationsService` — explainability + feedback
- Resilience layer for reports & habits

## AI Touchpoints
- Reports → AI interpretation + explainability
- Progress deltas → AI feedback
- Habits adherence → AI nudges

## E2E Scenarios Covered
- Scenario 6.1 / 6.2 / 6.3
- Progress v2 (weekly/monthly trends)
- Habits v2 (create/track/streak/AI feedback)
- Scenario 7.x base (reports + habits)

## Acceptance Criteria
- Scenario 6.1 PASS
- Scenario 6.2 PASS
- Scenario 6.3 PASS
- Progress v2 PASS
- Habits v2 PASS
- Scenario 7.x base PASS

## Risks
- Aggregates missing data
- Streak logic edge cases
- AI feedback without context

## Definition of Done
- Reports stable
- Progress trends stable
- Habits foundation stable
- AI feedback + explainability stable
- Resilience base validated

