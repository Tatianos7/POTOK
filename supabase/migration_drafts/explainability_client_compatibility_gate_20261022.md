# Explainability client compatibility — rollout blocker (2026-10-22)

Status: **NO-GO**. Review only. No cloud changes.

## Verified call sites (branch audit/supabase-public-grants-20261021)

- `programDeliveryService.getProgramExplainability`: calls `get_program_explainability` only when client `canExplain` is true. Proposed server RPC adds independent capability + ownership checks.
- `programDeliveryService.pauseProgram`: updates program status, inserts `program_guard_events`, then **directly inserts** `program_explainability`. Existing `public_api_privileges_hardening_review_20261021.sql` revokes client INSERT. Applying this draft alone would cause a silent evidence-write failure: current code does not inspect the insert error.
- `programDeliveryService.submitFeedback`: directly inserts `program_feedback` and calls adaptation. Client tier check is not server authorization. Separate `can_adapt` enforcement and feedback write contract required.
- `getMyPlanDTO` exposes `day.explainability_summary` from `getProgramDays`: must verify whether summary is sensitive Premium data and gate at the server source.

## Required before rollout

1. Replace client-origin explainability INSERT with an **atomic trusted server pause command** that verifies JWT identity, program ownership and allowed transition, persists status + guard event + explainability evidence in one transaction, and returns an idempotent receipt. Do not trust client-supplied program_type, reason or knowledge refs without validation.
2. Preserve user-facing pause for Free: `can_explain` gates reading detailed Premium evidence, **not** the ability to pause or record safety/audit evidence.
3. Route the client to the new command only after its server implementation and disposable Auth/PostgREST acceptance are ready. Deploy coordinated server/client changes; do not revoke old INSERT ahead of the compatible client.
4. Audit all `program_explainability` writes and alternate readers (views/RPCs), then test Free/Premium/other-user/anonymous access, pause and retry.
5. Audit `program_feedback` write privileges, `can_adapt` and adaptation execution separately.

## Deployment guard

Do not merge/deploy the review SQL or client changes based on green CI alone. This report documents a functional incompatibility; no server writer is implemented here.
