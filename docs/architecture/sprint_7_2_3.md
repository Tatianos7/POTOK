# Sprint 7.2.3 — Program Delivery & UX Layer (Architecture)

## Goal
Сделать программы полноценным пользовательским продуктом: выдача в UI, статусные переходы, история версий, explainability в интерфейсе, feedback‑loop, и entitlement‑gating.

## Delivery Layer (API/Service)
- `getProgramOverview(user_id, program_type)` → текущая программа + статус.
- `getProgramDay(program_id, date)` → день (питание + тренировка), explainability.
- `getProgramPhaseTimeline(program_id)` → фазы/блоки/границы.
- `getAdaptationTimeline(program_id)` → история адаптаций с reason_code.
- `getProgramHistory(program_id)` → версии + diff_summary.
- `completeProgramDay(program_session_id, status)` → completed/skipped.

## Status Model
`draft → active → adapted → paused → completed`
- `adapted` фиксируется при replan / new version.
- `paused` при guard / medical / low‑confidence.

## Versioning & UX
- Пользователь видит текущую версию + историю.
- Доступен diff по ключевым целям (калории/объём/интенсивность).

## Visualization Contracts
- **Day Card**: дата, targets, session_plan, explainability summary.
- **Phase Timeline**: фазы, типы, границы, deload‑вставки.
- **Adaptation Timeline**: reason_code, diff_summary, trust/confidence.
- **Explainability UI Model**: why_today / why_changed / why_paused.

## Interaction Loop
- `user_feedback` → `adaptProgram()`
- `skip` / `pain` / `fatigue` / `motivation` → replan / pause / deload
- trust_score обновляется из adherence + feedback.

## Entitlement Hooks
- **Free**: просмотр текущего плана, базовые day cards.
- **Pro**: адаптация, explainability, история/дифф.
- **Vision Pro**: spatial coach + live adjustments.

## Explainability UI Contracts
- `why_this_plan_today`
- `why_changed`
- `why_paused`
- `why_lowered_intensity`

## E2E Scenarios (96–110)
См. `docs/architecture/e2e_matrix_v2.md`.

## Definition of Done
- Delivery API контракты описаны и согласованы с UI.
- Статусы и история версий доступны пользователю.
- Explainability UI контракты фиксированы.
- Feedback‑loop и entitlement gating определены.
- E2E 96–110 добавлены.

## Implementation (Sprint 7.2.3)
### Delivery API
- RPC: `get_active_program`, `get_program_phases`, `get_program_days`,
  `get_program_day_details`, `get_program_explainability`, `get_program_status`.
- RLS enforced by `auth.uid()` policies.
- Entitlement tiers: Free / Pro / Coach / Vision Pro (UI gating).

### Program Session Runtime
- `startDay`, `completeDay`, `skipDay`, `pauseProgram`, `resumeProgram`.
- Связь с `program_sessions` и `program_adaptations`.
- Trust‑score обновляется от adherence.

### Feedback Loop
- Таблица `program_feedback` (energy, hunger, difficulty, pain, motivation).
- `submitFeedback → adaptProgram()` с constraints.feedback.

### Explainability UX Contracts
- `why_this_plan_today`
- `why_changed`
- `why_paused`
- `why_lowered_intensity`

### UI DTOs
- `ProgramMyPlanDTO`
- `ProgramTodayDTO`
- `ProgramPhaseWeekDTO`
- `ProgramWhyDTO`
