# Exact retained proposal admission V3 — stage 3 protocol

## What is implemented

An inactive backend transaction protocol connects the real exact optimizer result to an immutable retained proposal snapshot, duplicate replay, reopening and uncertain-commit recovery. It shares the unchanged existing GenerationAuthorityRecheckV1 currentness rules, extracted from Graph V2 finalization without changing that legacy path. It is not a new rights ledger, publication issuer, Graph V2 coercion or active-plan state machine.

The service is disabled by default. A trusted transaction implementation must lease an already authenticated exclusive connection, reuse existing request/account/Auth/Premium/currentness guards and locks, bind every exact source/metric read to that same transaction, and resolve only after COMMIT acknowledgement. The source package must come from those real guards, never caller JSON, editable JWT flags or a label. No SQL adapter, table/migration, source/metric issuer or hosted connection is implemented or applied by this stage. These are explicit next integration dependencies; the synthetic transaction fixture is not a PostgreSQL implementation.

## Admission and retention

Before any insert, load the locked request and authenticated actor/account/input/proposal binding. Reuse existing account/selection/week/timezone/Goal/target/preference/safety/entitlement/manifest/composition/validation/optimization/generation revision checks and verified Premium state. Re-run the exact optimizer inside that transaction and compare the complete proposal with the submitted canonical representation. Re-read current admission after preparation; a revocation or changed source packet blocks before insertion. Real locks remain necessary to exclude the final check-to-COMMIT race.

The retained snapshot binds operation, owner, input digest, proposed plan revision, exact canonical proposal bytes/hash, graph/optimization/proposal digests and the admission-source byte hash. It has a separately versioned hash domain, empty facts and the explicit purpose RETAINED_PROPOSAL_NOT_ACTIVE_PLAN. It does not change the existing request/selection state, activate a plan, write diary consumption or assert publication of the real catalog. It preserves all exact quantities and nutrition strings/rationals from the admitted immutable proposal.

The backend store must enforce one immutable snapshot per request using the existing durable request identity, reject conflicting payloads, and never replace old bytes. Same operation/canonical proposal returns the existing snapshot. The protocol only reports SNAPSHOT_RECORDED after the store's successful transaction resolution. No successful callback alone establishes a successful COMMIT.

## UNKNOWN and reopening

Any exception after insert dispatch, known uncertain COMMIT or lost committed-release acknowledgement returns UNKNOWN_RETRYABLE. This label instructs read-only recovery; the service never repeats an insert automatically. recover() only loads and verifies a visible retained snapshot. If no row is visible it reports RECOVERY_UNRESOLVED, not proof of rollback or permission to retry a write.

open()/recover() recheck current actor/Premium/request authority, recompute the exact proposal, then verify the stored identity, complete canonical bytes, digests and empty facts. They never insert. Current conditional admission failure blocks reopening; this is not a historical active-plan reader and does not recalculate or rewrite any historical diary FACT. Persistent post-activation read semantics remain separate.

Every result says planActivated=false and factsWritten=false. A recorded retained proposal is not an activated/writable user plan. The child graph/proposal's authority NONE / accepted=false / canRecord=false / canActivate=false flags remain unchanged. Final database admission/storage and application/UI opening still require the next SQL adapter/schema/role and end-to-end integration work.

## Verification

Synthetic serialized transactions cover real exact-optimizer integration, owner binding, Premium/revision failures, duplicate/concurrent replay, rollback, immutable byte/digest substitutions, lost commit acknowledgement, non-writing recovery and gate closure. Existing Graph V2 finalization/validator/worker tests cover the extracted shared checks. No actual database write or approval for real sources/recipes is performed. Node strict-TLS CI is separate from the retained-protocol tests; the unresolved upstream Edge gap is documented in docs/security/node-execution-edge-capability-20261106.md.

Local validation: 871 existing exact/legacy/Node-host/transaction/profile tests plus 12 retained-admission tests passed (883 total). Strict TypeScript, targeted ESLint and production build passed. Node bundle build and a disabled CLI invocation passed without opening a connection. The Node TLS workflow YAML and all embedded shell scripts parse. Native TLS/database and hosted workflow results remain separate; this stage does not claim native PostgreSQL retained-V3 storage acceptance.
