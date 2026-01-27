# Phase 7.2 — Intelligent Programs Layer (Architecture)

## Goal
Система персональных программ питания и тренировок, которые опираются на канонические знания, адаптируются со временем, объяснимы, безопасны и коммерчески готовы (Free/Pro/Vision Pro).

## Principles
- Все решения опираются на **verified knowledge version**.
- Любая корректировка программы сохраняет историю.
- Confidence влияет на глубину рекомендаций и guard.
- Объяснимость обязательна для каждой ключевой директивы.

## Domain Model (Spec)

### Core Tables
**`nutrition_programs`**
- `id`, `user_id`, `goal_id`
- `status` (draft|active|paused|completed)
- `program_version` (int)
- `knowledge_version_ref` (jsonb) — ссылки на версии KB
- `start_date`, `end_date`
- `created_at`, `updated_at`

**`training_programs`**
- `id`, `user_id`, `goal_id`
- `status`, `program_version`
- `knowledge_version_ref` (jsonb)
- `start_date`, `end_date`
- `created_at`, `updated_at`

**`program_phases`**
- `id`, `program_id`, `type` (nutrition|training)
- `name`, `start_date`, `end_date`
- `phase_goal`, `constraints`

**`program_blocks`**
- `id`, `phase_id`
- `block_type` (base|build|peak|deload|maintenance)
- `block_goal`, `duration_days`

**`program_microcycles`**
- `id`, `block_id`
- `week_index`, `load_target`, `recovery_target`

**`program_sessions`**
- `id`, `program_id`, `date`
- `session_type` (meal_plan|workout_plan)
- `plan_payload` (jsonb)
- `status` (planned|completed|skipped)

### Evolution & Explainability
**`program_versions`**
- `id`, `program_id`, `version`
- `snapshot` (jsonb)
- `reason` (text)
- `created_at`

**`program_explainability`**
- `id`, `program_id`, `version`
- `decision_ref` (text)
- `knowledge_refs` (jsonb)
- `confidence` (numeric)
- `guard_notes` (jsonb)
- `created_at`

### Adaptation & Guard
**`program_adaptations`**
- `id`, `program_id`, `from_version`, `to_version`
- `trigger` (deviation|fatigue|injury_risk|non_adherence)
- `summary` (jsonb)
- `created_at`

**`program_guard_events`**
- `id`, `program_id`, `risk_level` (safe|caution|danger)
- `flags` (text[])
- `blocked_actions` (text[])
- `created_at`

### Generation Jobs
**`program_generation_jobs`**
- `id`, `user_id`, `program_type`
- `status` (queued|running|completed|failed)
- `input_context` (jsonb)
- `output_ref` (uuid, program_id)
- `created_at`, `updated_at`

## Program Generation Pipeline
1. Collect inputs: `user_state`, goals, constraints, habits, recovery.
2. Resolve **knowledge versions** with confidence weighting.
3. Generate plan (nutrition/training) + version snapshot.
4. Validate with guard (medical/overload/trust).
5. Emit explainability per key decision.
6. Activate program and schedule sessions.

## Adaptation Engine
- Triggers: plateau, fatigue spike, adherence drop, injury risk, trust drop, KB version bump.
- Safe re‑plan: micro/meso/macro стратегии с сохранением истории.
- Confidence/trust снижают агрессивность и частоту адаптаций.
- Auto‑deintensify и stop‑conditions при перегрузке/риске.

## AI Guard & Trust Integration
- `effective_confidence < 0.60` → block or reduce scope.
- `trust_score` controls depth of recommendations.
- Medical / contraindication overrides hard‑block plan items.

## Commercial Layer (Phase 5 Integration)
- Free: шаблоны и лёгкие рекомендации.
- Pro: полноценные персональные программы + адаптации.
- Vision Pro: spatial + real‑time coaching programs.

## Explainability v4
- Каждое изменение программы содержит `reason_code`, `input_context`, `diff_summary`.
- Ссылки на KB версию + confidence обязательны.
- “Почему сегодня отдых” и “почему снижены калории/объём” — отдельные decision_ref.

## E2E Coverage (76–90)
Сценарии 76–90 закреплены в `e2e_matrix_v2.md`.

## Definition of Done
- Архитектура AI‑программ зафиксирована.
- Контракты знаний, состояния, доверия и безопасности связаны.
- Готов переход к Implementation Mode Phase 7.2.
