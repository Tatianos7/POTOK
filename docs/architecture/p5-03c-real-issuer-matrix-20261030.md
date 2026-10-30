# Real issuer closure matrix — 30 October 2026

Scope: implementation of the missing disposable PostgreSQL harness from the
[test-first gate](p5-03c-real-issuer-closure-integration-gate-2026-10-20.md).
Based on Draft PR #183, `507ec2498bb855e720c7d74ee98c341b858b92bd`.
Generation source recovery #253 has passed both exact-head CI workflows at
`a166717d8d139323b45e6fdf691b6adf4d15d510`; it is a separate dependency stack.

## Changes

The old disposable transformer failed on the real Food issuer: it expected one
authority assignment although both real issuers deliberately have two. It now
requires exactly two, requires the first to be the entry statement, inserts
admission only after that statement and preserves the post-wait authority check.
Tests reject missing, additional or displaced anchors and changed actor bindings.

The new opt-in matrix reuses the original native Food acceptance cluster and real
trusted-entitlement migrations. Nonfood acceptance installs its unchanged draft
and runs its existing suite first. The matrix verifies installed issuer definitions
against source, reproduces the baseline missing admission with a synthetic
CLOSING reviewer, then mounts strictly transformed functions only inside that
cluster. The trusted authority implementation is compared before/after and never
replaced by an authorization stub.

Fourteen new native scenarios cover both actual issuer functions: missing state,
CLOSING, private-helper denials, exact replay, respective canonical/raw payload
conflicts, actor-scoped receipt recovery, both transaction orders, explicit rollback,
parallel reviewers of distinct roots, and definition-bound Nonfood zero nutrition.
Each race observes PostgreSQL session wait states before assertions; timer sleep
only keeps the first transaction open. Inventory checks include all thirteen
Food/Nonfood source/revision/event/head/receipt tables. Existing Food and Nonfood
acceptance cases continue to execute. No original SQL migration is changed.

## Running and limits

```sh
POTOK_FOOD_EVIDENCE_REQUIRE_DB=1 POTOK_NONFOOD_ACCEPTANCE=1 \
POTOK_CLOSURE_REAL_ISSUER_MATRIX=1 node --import tsx --test \
  --test-isolation=none scripts/contracts/food-evidence-disposable-db-v1.test.ts
```

This command requires PostgreSQL 17+ binaries and a non-root disposable test user.
It creates and destroys its own Unix-socket-only cluster. There is no database URL
option and PostgreSQL credential environment variables are ignored. Required CI
uses PostgreSQL 17.6 and fails instead of silently skipping a missing database.

Local source checks and the focused TypeScript check pass. Native local execution
is explicitly skipped because this executor lacks PostgreSQL binaries; the native
matrix result must come from the exact-head GitHub job, not from that skip.

The transition helper is a private fixture driven by the cluster owner, not a
user-facing account-closure endpoint. Auth claims simulate the verified PostgREST
boundary; real JWT signature verification and HTTP/RLS acceptance are not proved.
No real water approval, food approval, canonical ID, recipe publication or manifest
is issued. All review inputs and accounts in this matrix are synthetic.

`ACCOUNT_CLOSURE_IMPLEMENTED=false`, `LIVE_ERASURE_VERIFIED=false`.
The old intentionally RED source gate remains RED for unmodified migration drafts.
No Supabase/STAGING/production calls, erasure, Edge deployment, merge, generator
activation or PLAN-to-FACT writes are included.

Next gate: review native results, then propose minimal inactive real issuer and
trusted account-state integration. Closure authorization, lock ordering with actual
account lifecycle operations, identifying evidence retention and live JWT/PostgREST
acceptance remain separate prerequisites. Do not deploy the candidate schema.
