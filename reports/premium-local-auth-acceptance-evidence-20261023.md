# Premium RPC — local Auth/PostgREST acceptance evidence (2026-10-23)

Status: **PASS on disposable local Supabase only; NOT deployed to production or staging.**

## Verified CI evidence
GitHub Actions run 39896438537, job 120227885185 (commit `4592dffc82602800c9e547e2e3835072f0c66428`) completed successfully. Inspected job logs, not merely workflow status.

The job starts disposable Supabase services without historical POTOK migrations, installs `scripts/contracts/supabase-local-auth-fixture.sql`, replays the exact review table-grant and Premium RPC SQL in the disposable environment, then runs real Auth/PostgREST requests.

Log assertions confirmed:
- `PASS: exact Premium RPC review SQL replay in disposable local Supabase`.
- `PASS: Free user cannot self-grant can_adapt/can_explain via PostgREST`.
- `PASS: Premium RPC own reads, cross-account denial, anonymous denial, purchase RPC client denial`.
- `PASS: trusted service_role purchase and restore persist events and retry idempotently`.
- `PASS: explainability Free denial, Premium own access, cross-owner isolation, anonymous and direct-table denial`.
- `PASS: atomic adaptation permissions, concurrent idempotency, stale CAS and forced rollback`.
- `PASS: server-owned future nutrition recalculation, past-day preservation and concurrent idempotency`.
- `PASS: forced nutrition replan failure rolls back all writes`.

Separately, the isolated PostgreSQL entitlement ownership acceptance job passed in workflow run 39896438516, and the static entitlement compatibility guard passed.

## Limits and release gate
These tests establish disposable acceptance for the **review SQL**, not the security of currently deployed production RPCs. The deployed `get_entitlements` remains an identified cross-account read risk until separately remediated. The local fixture is intentionally reduced and does not prove full production schema parity. A successful replay does not authorize deploying a multi-purpose SQL draft.

Before rollout: complete repository/server caller inventory; isolate the entitlement fix from purchase/explainability changes; review migration, downgrade/rollback, grants and production compatibility; obtain explicit approval for any cloud change. Preserve Free diary FACT and existing Premium user experience.

No cloud changes were performed by this evidence review.
