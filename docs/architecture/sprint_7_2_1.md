# Sprint 7.2.1 — Program Generation Core (Architecture)

## Goal
Сформировать ядро генерации программ питания и тренировок на базе канонических знаний с explainability и guard‑контуром.

## Program Generation Pipeline
1) **Input сбор**:
   - `user_state`, `goals`, `constraints`, `habits`, `recovery`, `trajectory`.
2) **KB resolve**:
   - выбор `verified` версий знаний с учётом `effective_confidence`.
3) **Skeleton build**:
   - структура `Program → Phase → Block → Day`.
4) **Plan synthesis**:
   - генерация дневных целей (nutrition) и сессий (training).
5) **Guard check**:
   - медицинские и safety‑ограничения → блок/замена.
6) **Trust gating**:
   - глубина плана по `trust_score`.
7) **Explainability bind**:
   - фиксация ссылок на KB версии и причин решений.
8) **Persist**:
   - сохранение `program_versions` + активной версии.

## Scope
- Программы:
  - `nutrition_programs`, `training_programs`
  - версии программ и snapshots
- Генерация:
  - вход: `user_state`, goals, constraints, habits, recovery
  - KB: verified version + confidence‑weighted
  - выход: versioned program plan
- Explainability:
  - ссылки на KB версии
  - причины решений
- Guard & Trust:
  - medical / safety overrides
  - trust‑adaptive depth
- Contracts for Phase 7.2:
  - program consumes verified knowledge version

## Domain Model (Spec)
**Program**
- `program_id`, `user_id`, `program_type` (nutrition|training)
- `program_version`, `status`, `knowledge_version_ref`
- `start_date`, `end_date`, `goal_id`

**Phase**
- `phase_id`, `program_id`, `phase_type` (cut|maintain|bulk|build|peak|deload)
- `phase_goal`, `start_date`, `end_date`

**Block**
- `block_id`, `phase_id`, `block_type` (base|build|peak|deload)
- `duration_days`, `block_goal`

**Day**
- `day_id`, `block_id`, `date`
- `targets` (nutrition macros) or `session_plan` (training)
- `constraints_applied` (jsonb)

## Out of Scope
- Реализация UI
- Реал‑тайм коучинг (Vision Pro)
- Автоматическая адаптация (Sprint 7.2.2)

## Dependencies
- Phase 7.1 KB + Evolution Layer
- `user_state`, `goal_trajectory`, `ai_trust_score`
- Guard Layer (medical/contraindications)

## Pipeline (Architecture)
1. Validate input (user_state, goals, constraints).
2. Resolve KB versions + `effective_confidence`.
3. Generate program skeleton (phases → blocks → microcycles).
4. Generate daily sessions (meal/workout templates).
5. Guard validation (risk overrides).
6. Save program + version snapshot.
7. Emit explainability entries.

## Data Contracts (Spec)
- `program_generation_jobs.input_context`:
  - `user_state`, `goals`, `constraints`
  - `kb_version_refs`
  - `confidence_summary`
- `program_versions.snapshot`:
  - phases/blocks/microcycles
  - session templates
  - guard decisions

## Explainability Contracts
- Каждая директива содержит:
  - `canonical_id`
  - `knowledge_version`
  - `effective_confidence`
  - `decision_reason`
  - `guard_notes` (если применён)

## Guard & Trust Rules
- `effective_confidence < 0.60` → блок рекомендаций, требование manual review.
- `risk_level = danger` → запрет директивы, безопасная замена.
- `trust_score < threshold` → упрощённый план, меньше изменений.

## E2E (76–82) + DoD
- 76: Program generation (nutrition) from KB versions — PASS если `knowledge_version_ref` заполнен.
- 77: Program generation (training) with phases/microcycles — PASS если структура Phase/Block/Day создана.
- 78: Explainability links to KB version — PASS если `program_explainability` содержит version+reason.
- 79: Guard blocks unsafe directives — PASS если `program_guard_events` фиксирует блок.
- 80: Trust‑adaptive depth — PASS если при низком trust глубина снижена.
- 81: Confidence decay reduces aggressiveness — PASS если intensity снижена при low confidence.
- 82: Constraint change triggers safe re‑plan — PASS если создаётся новая версия, старая сохранена.

## Definition of Done
- Domain model и генерация формализованы
- Контракты KB / user_state / trust / guard определены
- Explainability v3 встроена в решения
- Готов переход к Sprint 7.2.2 (Adaptation & Safety)
