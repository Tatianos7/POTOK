# POTOK security hardening — deployment readiness gate (2026-10-21)

Status: **NO-GO for cloud deployment**. Review-only planning in Draft PR #184. No Staging or Production writes authorized.

## What passed
- Commit `32c26aa`: POTOK PR Checks, Supabase grants review guards, and disposable Supabase Auth/PostgREST integration all PASS.
- These tests exercise a **simplified local fixture**, not a replay of the complete production DDL or the two proposed SQL drafts.
- Review SQL quoting repair: commit `34eb33b`. CI after this commit must be checked separately.

## Blockers before a deployable migration
1. **Candidate parity:** replay the exact final SQL (minus review-only transaction wrapper) in a disposable Supabase instance seeded from real Production schema definitions; compare actual function bodies, signatures, grants, RLS, column privileges and role inheritance. Do not infer deployability from simplified fixtures.
2. **RPC contract preservation:** compare production `get_entitlements` and `get_paywall_state` business behavior against the proposed function. The review draft replaces `get_entitlements` and might lose existing logic; it must not be promoted unchanged without a behavioral diff.
3. **Trusted purchase flow:** confirm server-side provider receipt validation, authenticated actor mapping, event idempotency, and allowed service-role writers. `start_purchase`/`restore_purchase` must not be client-callable with arbitrary `p_user_id`. Do not treat a `restored` response as proof of paid entitlement.
4. **Writer inventory:** search all client, edge, backend, scheduled jobs and SQL functions for profile, subscription, entitlement and billing-event writes. Preserve ordinary user profile edits while preventing privilege-field changes.
5. **Privilege proof:** test effective privileges including column grants, role inheritance, `PUBLIC` grants, and default privileges. Verify client roles cannot TRUNCATE, TRIGGER, REFERENCES, MAINTAIN, write finance or change `has_premium`/`is_admin`; verify legitimate trusted flows remain operational.
6. **Negative tests:** anonymous, authenticated A/B, service_role; cross-account reads and writes, forged purchase/restore, repeat idempotency, RLS, error codes, and legitimate account owner profile edits.
7. **Operational plan:** record baseline schema/grants and backups; prepare exact forward SQL, rollback SQL, monitoring queries, and abort conditions. Explicit approval for Staging first, then staging acceptance and **separate** explicit Production approval.
8. **Broad public exposure:** audit remaining public tables and future table default privileges; this targeted change alone does not close the full audit.

## Safe rollout sequence (not yet authorized)
1. Finalize reviewed patches and reproducible disposable acceptance; fail closed on drift.
2. Obtain explicit owner permission to apply to **Staging**. Take baseline, execute in one controlled transaction where feasible, verify role/RPC behavior, capture logs, rollback on failure.
3. Obtain separate explicit owner permission to apply to **Production** after staging sign-off. Execute approved version only; monitor errors and business purchase/profile paths.

## Stop conditions
- Schema/function body differs from reviewed snapshot.
- Any cross-account privilege path remains.
- Legitimate profile writes or verified purchase/restore stop working.
- Missing rollback, payment-authority evidence, or explicit environment-specific approval.

Do not merge Draft PR #184 or deploy either review SQL file as-is. Both SQL drafts are wrapped in `BEGIN; ... ROLLBACK;` and are not deployment migrations.

## Additional read-only Premium RPC findings (2026-10-21)
- Production RPC signatures and SECURITY DEFINER/search_path settings match the review draft.
- get_entitlements accepts a supplied user UUID without enforcing auth.uid ownership; proposed denial changes anonymous behavior.
- get_paywall_state already checks can_spatial for spatial access. Owner approved verified server-side can_spatial only.
- start_purchase and restore_purchase record billing events but do not validate payment receipts or caller ownership. Their responses are not evidence of a paid entitlement.
- CI passed 3/3 at commit 920410d8f8df1511d262558c0f2c88dca50a20d5; payment-provider verification and Production parity remain unproven.
- Next gate: inventory actual trusted server writers and receipt verification, review rollback and negative tests. NO-GO remains.

## Payment writer and receipt verification gate — 2026-10-21

**Verified:** The current production `start_purchase` and `restore_purchase` functions only append billing events and return success-shaped status objects; they do not authenticate a payment provider or verify a receipt. The disposable PostgREST acceptance script exercises these functions using a service-role credential and fixture-only payment values; this validates RPC permissions and event idempotency, **not payment authenticity**. The tracked-source inventory script (`scripts/contracts/premium-rpc-callsite-inventory.mjs`) scans `src/`, `supabase/functions/`, `api/`, `server/` and `scripts/` on checked-out PR HEAD and emits an artifact; GitHub default-branch search returning zero matches cannot establish absence of other writers.

**Required evidence before rollout:** Identify each actual privileged server writer and payment provider integration; verify signed/provider-origin evidence server-side, link purchases to the authenticated account, reject replay or conflicting idempotency payloads, prevent arbitrary user ID injection, and ensure entitlement grants are derived only from verified provider state. A `restored` or `started` RPC response must never grant Premium. Capture exact PR-HEAD inventory artifact and review every privileged path. Do not deploy any paid integration or invoke a payment provider for this audit. **NO-GO remains.**
