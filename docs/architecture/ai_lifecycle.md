# AI Lifecycle (Canonical)

## States
- `queued`
- `running`
- `validating`
- `completed`
- `outdated`
- `failed`

## State Machine
- `queued → running → validating → completed`
- `queued → running → failed`
- `completed → outdated` (on input change)
- `outdated → queued` (requeue)

## Dedupe (input_hash)
- `input_hash = hash(normalized_input_context)`
- Unique by `(user_id, input_hash)`
- If duplicate exists in `queued/running/completed`, no new row created.

## Idempotency (idempotency_key)
- Every external request uses `idempotency_key`.
- Duplicate idempotency_key returns existing record.

## Rate-Limit
- Per user and per request type.
- Hard limits for AI plans and report interpretations.

## Explainability
- `explainability` is required on `completed`.
- Includes data sources, goals, constraints, confidence.

## Guard Layer
- Safety and hallucination checks run in `validating`.
- If guard fails → `failed` with `error_message` and `guard_status`.

## Feedback Loop
- User feedback stored in `ai_feedback`.
- Feedback linked to AI record and used for ranking/retraining.

## Versioning
- `model_version` is required for `completed`.
- `input_context` stored for reproducibility.

## Reproducibility
- Same `input_hash + model_version` must be reproducible.

## Required Fields (per AI record)
- `user_id`, `request_type`, `input_context`, `input_hash`, `model_version`
- `status`, `result`, `explainability`, `created_at`, `updated_at`

