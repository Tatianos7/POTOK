# Sprint 7.1.5 — Knowledge Evolution Layer (Architecture)

## Goal
Создать эволюционирующую, объяснимую и управляемую базу знаний продуктов и упражнений перед Phase 7.2.

## Scope
- Versioning нутриентов:
  - `nutrition_version` history
  - diff между версиями
  - привязка дневниковых записей к версии
  - backfill с explainability
- Audit & Provenance:
  - кто/когда/почему изменил канон
  - источник обновления (import / AI / admin / user)
  - неизменяемый журнал
- Confidence Decay:
  - снижение confidence со временем
  - влияние конфликтов и источника
  - формула и пороги
  - влияние на AI‑рекомендации и guard
- User Override + HITL:
  - пользователь предлагает правку → conflict
  - HITL арбитраж
  - принятие → новая версия канона
  - отклонение → лог причины
- Auto‑Update Pipeline:
  - периодические обновления источников
  - безопасный backfill
  - автоматический requeue AI
- Explainability v3:
  - AI ссылается на версию продукта
  - история изменений в отчётах
  - “почему цифры поменялись”
- Готовность к Phase 7.2:
  - стабильный API и контракт “program consumes verified knowledge version”

## Out of Scope
- Реализация кода
- Глобальная загрузка внешних баз
- Медицинская сертификация (Phase 7.3+)

## Architecture (Spec)

### 1) Knowledge Versions
**Table: `knowledge_version_snapshots`**
- `id` (uuid, PK)
- `entity_type` (food | exercise)
- `entity_id` (uuid)
- `version` (int)
- `data_snapshot` (jsonb)
- `diff_from_version` (int, nullable)
- `confidence_score` (numeric)
- `verified` (bool)
- `source` (import | ai | admin | user)
- `source_ref` (text, batch/source id)
- `created_by_user_id` (uuid, nullable)
- `created_at` (timestamptz)

**Table: `knowledge_version_diffs`**
- `id` (uuid, PK)
- `entity_type`
- `entity_id`
- `from_version` (int)
- `to_version` (int)
- `diff` (jsonb) — {field: {from, to}}
- `reason` (text)
- `created_at`

### 2) Audit & Provenance
**Table: `knowledge_audit_log`** (append‑only)
- `id` (uuid, PK)
- `entity_type`, `entity_id`, `version`
- `actor_type` (system | admin | user | ai)
- `actor_id` (uuid, nullable)
- `action` (create | update | override | merge | reject)
- `reason` (text)
- `source` (import | ai | admin | user)
- `source_ref` (text)
- `created_at`

### 3) Confidence Decay
**Table: `knowledge_confidence_decay`**
- `entity_type`, `entity_id`, `version`
- `base_confidence`
- `decay_rate` (numeric)
- `conflict_penalty` (numeric)
- `source_weight` (numeric)
- `effective_confidence`
- `calculated_at`

**Formula (spec)**
```
effective_confidence =
  clamp(0, 1,
    base_confidence * source_weight
    - conflict_penalty
    - decay_rate * days_since_update
  )
```

**Thresholds (spec)**
- `>= 0.90` — trusted
- `0.75–0.89` — standard
- `0.60–0.74` — caution (AI warn)
- `< 0.60` — block for AI & guard

### 4) User Override + HITL
**Table: `knowledge_user_overrides`**
- `id` (uuid, PK)
- `user_id`
- `entity_type`, `entity_id`
- `proposed_change` (jsonb)
- `confidence_hint` (numeric, nullable)
- `status` (pending | accepted | rejected)
- `reviewed_by` (uuid, nullable)
- `review_reason` (text, nullable)
- `created_at`, `reviewed_at`

**Table: `knowledge_human_reviews`**
- `id` (uuid, PK)
- `override_id`
- `decision` (accept | reject | merge)
- `diff_applied` (jsonb)
- `review_reason`
- `created_at`

### 5) Auto‑Update Pipeline
**Table: `knowledge_auto_updates`**
- `id` (uuid, PK)
- `source`
- `source_version`
- `status` (pending | running | completed | failed)
- `started_at`, `completed_at`
- `summary` (jsonb)

**Table: `knowledge_backfill_jobs`**
- `id` (uuid, PK)
- `entity_type`, `entity_ids`
- `status` (pending | running | completed | failed)
- `affected_diary_days`
- `created_at`, `completed_at`

## Explainability v3
- Каждая рекомендация/отчёт содержит:
  - `canonical_id`, `knowledge_version`
  - `source`, `effective_confidence`
  - `diff_summary` (если изменилась версия)

## Lifecycle Diagram (text)
```
Import/User Override
        │
        ▼
Normalization → Conflict Detection → HITL Review
        │                     │
        │                     └─ Reject → Audit Log
        ▼
Create New Version → Version Diff → Confidence Decay
        │
        ▼
Backfill (diary) → AI Invalidate (outdated/requeue)
        │
        ▼
Explainability v3 (version & diff)
```

## Contracts (Phase 7.2 readiness)
- Program consumes **verified knowledge version**
- AI input_context includes `knowledge_version` + `effective_confidence`
- Guard blocks AI if `effective_confidence < 0.60`

## E2E Scenarios (71–75)
- 71: Канон обновился → история версий доступна
- 72: Confidence decay снижает доверие устаревшему источнику
- 73: User override → conflict → HITL → новая версия
- 74: Auto‑update не ломает прошлые дневники (safe backfill)
- 75: AI‑программа использует последнюю verified‑версию

## Definition of Done
- Версионирование канона формализовано (snapshots + diffs)
- Confidence имеет динамику и влияет на AI/guard
- HITL встроен в эволюцию знаний
- Backfill и AI invalidate согласованы с версиями
- Контракты готовы для Phase 7.2
