# Account-state registration and Staging review packet

Status: INACTIVE IMPLEMENTATION / NOT APPLIED. Follows #255 at
`ed5ebd7d5f4ed2afcf82e8be50ebe03a0051667c` (all four workflows passed;
persistent PostgreSQL matrix 54/54, candidate 49/49, zero skips).

## What changes for the future app

The server needs a trustworthy account-state record before catalog review/issuance
can proceed. An Auth account alone is not proof that a pre-existing account has no
pending closure. Registration does not grant admin, Premium, source approval or
permission to generate plans. Closing never resets to ACTIVE through registration.

The new draft creates two separate paths:

- New non-anonymous Auth INSERT: an isolated private trigger writes ACTIVE and
  its Auth-creation provenance in the same transaction. Failure rolls back the
  signup and state together; no exception is swallowed. Anonymous INSERT and
  subsequent conversion are not silently registered. No profile/user metadata
  supplies authority. Other existing signup triggers remain installed.
- Existing accounts: an SQL-owner-only function consumes an independently reviewed
  permit bound to one account, exact Auth creation timestamp, source-manifest hash
  and explicit expiry. No real permits are authored in this work. Wrong/expired
  permits, mismatches, different permits and CLOSING states fail closed. Concurrent
  exact replay creates one registration. No automatic bulk backfill exists.

Both permit and provenance tables have FORCE RLS, explicit SQL-owner policies and
no client privileges. Their immutability and RESTRICT references deliberately do
not claim an implemented retention/erasure lifecycle. Permit validity is an explicit
authorization input, not a chosen personal-data retention period.

Existing-account order remains shared entitlement gate → live Auth row lock →
account gate/state row lock. New Auth INSERT is a separate uncommitted identity
event: it takes the account gate only, avoiding inversion of the existing actor
gate/Auth-row order. It cannot supply a committed live session before signup commits.
The trigger never changes existing state with an upsert. Deferred checks bind
provenance to Auth/state and reject expired review permits at COMMIT.

## Exact prepared files

- `supabase/migration_drafts/account_state_registration_v1.sql`: inactive registration code.
- `supabase/migration_drafts/account_state_registration_v1.preflight.sql`: SELECT-only
  schema/role/Auth-trigger fingerprint inventory and aggregate readiness. It emits
  no user names, emails, per-account IDs or source bodies.
- `scripts/contracts/p5-03c-account-registration-native-v1.ts`: native tests added
  after all existing issuer/closure tests; they use synthetic permits only.
- The CI matrix retains candidate and persistent-draft modes, adding a separate
  registration-draft mode with real PostgreSQL and REQUIRE_DB=1.

## Owner-review packet before any Staging write

1. Pin this PR's exact tested SHA and required prerequisite SQL hashes. Confirm
   effective SQL owner/permissions, Auth `id`/`created_at`/`is_anonymous` types and
   that the Staging target is the approved target. No production target is allowed.
2. Run the prepared read-only preflight only in an authorized session. Review every
   existing Auth INSERT trigger and its function hash, owning role and failure
   behavior; the installer requires the exact reviewed inventory digest. Copying
   a newly observed digest is not an approval. Re-review after any drift.
3. Author a separate, minimal legacy-account review manifest: actual closure checks,
   exact account/creation binding, independent source hash, reviewer decision and
   permit validity. Auth existence and a profile flag cannot substitute for review.
   This work supplies no real account IDs, ACTIVE decisions or expiry defaults.
4. Review signup effects and recovery before apply. Auth trigger failures can block
   signup. Native tests cover atomic failure and an existing signup trigger, but
   real Supabase OTP/Auth transport is still NOT VERIFIED.
5. Obtain explicit permission for the exact Staging SQL/hook changes and any named
   synthetic Auth fixtures. Apply prerequisites in reviewed order with generator,
   Edge and catalog issuance runtime still inactive. No permission is inferred from
   green CI or this document.
6. In Staging, verify new ordinary-account OTP/signup, anonymous/legacy cases if
   supported, A/B denial, no admin/Premium grant, exact replay, closure races,
   stale permits, source drift and failure rollback. Preserve historical diary
   snapshots and verify unrelated profile/signup behavior. Use real signed JWTs
   through PostgREST; SQL claim fixtures are not that proof.
7. Postcheck exact function/trigger/role metadata, state/provenance aggregate counts,
   fixture cleanup and unchanged real content. A Staging pass does not authorize
   production, merge, publication or generator activation.

## Recovery and remaining gates

Review a trigger-disable recovery action before enabling the hook. If signup fails,
an explicitly approved recovery may disable only this registration hook, preserving
all state/provenance and other Auth triggers. New missing state then blocks evidence
issuance; do not reopen CLOSING, delete records or retry by marking every account
ACTIVE. No recovery command is executed or implicitly authorized here.

Global writer/read integration, authoritative checks of pre-existing closure intent,
real Auth/PostgREST, finite retention/erasure and independently verifiable nonpersonal
catalog preservation remain open. No data is erased, no CLOSED state is issued,
and no actual product/water review or recipe publication is created.

`ACCOUNT_CLOSURE_IMPLEMENTED=false`, `LIVE_ERASURE_VERIFIED=false`.
