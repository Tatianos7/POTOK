# Knowledge ↔ AI Integration Layer

## Integration Targets
- AI plans (meal/training plans) use canonical IDs only.
- Pose Coach uses biomechanics templates from Exercise KB.
- Programs reference canonical food/exercise families.
- Reports map all metrics to canonical entities.

## Explainability Links
- Every AI output includes:
  - canonical_food_id / canonical_exercise_id
  - source KB version
  - rule or template reference
  - effective_confidence (after decay)
  - diff_summary when version changed

## Data Flow
- KB → normalization → versioning → AI input_context
- AI output → explainability with KB version + confidence
- User feedback / overrides → HITL → new KB version

## Phase 7.2 Contract
- Programs consume only `verified` knowledge versions.
- AI must log `knowledge_version` and `effective_confidence`.
- Guard blocks outputs when `effective_confidence < 0.60`.

