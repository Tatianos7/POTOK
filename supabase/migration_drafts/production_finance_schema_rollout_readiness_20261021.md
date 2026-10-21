# Production finance schema parity and rollout readiness — 2026-10-21

Status: **NO-GO / review only**. Production project `dtsdnhbcwpbfrhcazqkb` was queried **read-only**. No staging or production writes, no payments, no subscriptions purchased, no PR merge.

## Direct Production catalog findings

- `subscriptions`: primary key `id`, unique `subscriptions_user_idx(user_id)`, FK `user_id -> auth.users(id) ON DELETE CASCADE`, `plan` CHECK `free|pro|vision_pro`, `status` CHECK `active|canceled|past_due|trial`.
- `entitlements`: primary key `id`, unique `entitlements_user_idx(user_id)`, FK `user_id -> auth.users(id) ON DELETE CASCADE`, `tier` CHECK `free|pro|vision_pro|coach`.
- `billing_events`: primary key `id`, unique `billing_events_idempotency_idx(idempotency_key)`, FK `user_id -> auth.users(id) ON DELETE CASCADE`, `provider` CHECK `app_store|play_store|vision_pro`.
- `user_profiles`: primary key `id_user`; indexes `user_profiles_email_idx` (partial), `user_profiles_phone_idx` (partial), `user_profiles_user_idx`. Trigger `update_user_profiles_updated_at` fires BEFORE UPDATE and calls `update_updated_at_column()`.
- No triggers were listed by `information_schema.triggers` for the three finance tables. This is a catalog observation, not a full function dependency audit.

## Disposable parity update
The local Auth fixture now mirrors finance `ON DELETE CASCADE` and the three unique indexes. It intentionally does not claim full production DDL parity (nullability/defaults, all profile indexes/triggers and RLS policy semantics still require comparison).

## Security blockers / deployment gates
1. Exact production schema, grant inheritance, triggers, RLS policies and function dependencies must be reviewed before deployment; avoid relying on local fixtures as authoritative.
2. Client `entitlementService.canRealtimePose` permits `pro` without `can_spatial`, whereas Production paywall `spatial` checks `can_spatial`. Requires owner product decision, not a silent security patch.
3. `start_purchase` and `restore_purchase` must be connected only to trusted verified-provider backend authority. The existing local service_role test uses fake receipt/event data and **does not prove receipt verification**.
4. Confirm server-side callers, rollback, rollout sequencing, monitoring and verified Staging acceptance. Obtain separate explicit owner approval before any Staging/Production change.
5. Do not use paid subscriptions or paid third-party testing services for this review.

The review SQL must retain `ROLLBACK` and remain outside deployable migrations until the above gates are satisfied.
