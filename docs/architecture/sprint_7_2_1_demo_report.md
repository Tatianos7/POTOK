# Sprint 7.2.1 — Demo & Validation Report

## Pipeline (8 steps)
Input → KB resolve → Skeleton → Plan → Guard → Trust → Explainability → Persist

## Program Structure (program_id: b2c15cd8-6a3e-46ef-b7ca-345489283a34)
**Phases**
- phase_1: build (2026-01-20 → 2026-01-26), goal: progress
- phase_2: deload (2026-01-27 → 2026-02-02), goal: recovery

**Blocks**
- build block: 7 days (phase_1)
- deload block: 7 days (phase_2)

**Days (таблица)**
| Day | Calories | P | F | C | Phase | Block |
|---|---:|---:|---:|---:|---|---|
| 2026-01-20 | 1800 | 120 | 60 | 200 | phase_1 | build |
| 2026-01-21 | 1800 | 120 | 60 | 200 | phase_1 | build |
| 2026-01-22 | 1800 | 120 | 60 | 200 | phase_1 | build |
| 2026-01-23 | 1800 | 120 | 60 | 200 | phase_1 | build |
| 2026-01-24 | 1800 | 120 | 60 | 200 | phase_1 | build |
| 2026-01-25 | 1800 | 120 | 60 | 200 | phase_1 | build |
| 2026-01-26 | 1800 | 120 | 60 | 200 | phase_1 | build |
| 2026-01-27 | 1800 | 120 | 60 | 200 | phase_2 | deload |
| 2026-01-28 | 1800 | 120 | 60 | 200 | phase_2 | deload |
| 2026-01-29 | 1800 | 120 | 60 | 200 | phase_2 | deload |
| 2026-01-30 | 1800 | 120 | 60 | 200 | phase_2 | deload |
| 2026-01-31 | 1800 | 120 | 60 | 200 | phase_2 | deload |
| 2026-02-01 | 1800 | 120 | 60 | 200 | phase_2 | deload |
| 2026-02-02 | 1800 | 120 | 60 | 200 | phase_2 | deload |

**Логика фаз**
2 фазы: build → deload. При trust_score=50 структура разбивается на прогресс и восстановление для снижения риска перегрузки.

## Explainability (E2E 78)
Sample:
- decision_ref: `program_generation`
- knowledge_refs: `foods` v1
- effective_confidence: 0.95
- guard_notes: trust_score=50, conservative_factor=1
- version = 1

## Guard & Trust (E2E 79–81)
**A) trust_score=30**
- phases_count = 1
- plan_depth = basic
- макросы снижены (90% от цели)

**B) effective_confidence=0.55**
- guard_event создан: `risk_level=danger`, `flags=[low_confidence]`
- генерация блокируется

## Re-Plan & Versioning (E2E 82)
- версии: v1 (initial), v2 (trust_replan), v3 (constraint_replan)
- история доступна в `program_versions`
- explainability сохранена по версиям

## E2E Status (76–82)
PASS

## Verdict
Sprint 7.2.1 = Production Ready
