# UI Runtime Integration Map

Screen → State Adapter → Service → DTO → Explainability → Trust Action → UI Component

| Screen | State Adapter | Service | DTO | Explainability | Trust Action | UI Component |
| --- | --- | --- | --- | --- | --- | --- |
| Today | `uiRuntimeAdapter.getTodayState()` | `programUxRuntimeService` | `ProgramTodayDTO` | `TodayExplainabilityDTO` | `trustSafetyService.classifyTrustDecision()` | `Today` |
| My Program | `uiRuntimeAdapter.getProgramState()` | `programDeliveryService` | `ProgramMyPlanDTO` | `ProgramExplainabilityDTO` | `trustSafetyService.classifyTrustDecision()` | `MyProgram` |
| Progress | `uiRuntimeAdapter.getProgressState()` | `progressAggregatorService` | `ProgressSnapshot` + `TrendSummary` | `ProgressExplainabilityDTO` | `trustSafetyService.classifyTrustDecision()` | `Progress` |
| Habits | `uiRuntimeAdapter.getHabitsState()` | `habitsService` | `HabitWithStatus[]` | `HabitsExplainabilityDTO` | `trustSafetyService.classifyTrustDecision()` | `Habits` |
| Paywall | `uiRuntimeAdapter.getPaywallState()` | `entitlementService` | `PaywallState` (raw) | `PaywallExplainabilityDTO` | `trustSafetyService.classifyTrustDecision()` | `Paywall` |
