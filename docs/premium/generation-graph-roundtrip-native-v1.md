# Graph V2 persistence roundtrip — isolated native acceptance

This test closes the gap between marker-only inner writes in the source-fence
suite and pre-inserted Graph rows in the readback suite. It introduces no runtime
entrypoint, hosted SQL installation, credentials or generator activation.

`scripts/contracts/generation-validation-graph-v1.test.ts` runs as the fourteenth
isolated PostgreSQL matrix suite (`graph`). It admits only the existing fixed
loopback disposable database. Native execution must finish with zero skips before
claiming that the scenarios passed. Without explicit native opt-in, the static
SQL extraction check runs and the native parent is skipped.

## Retained production-candidate code exercised

- Exact protected inner `record_generated_week_v2` and
  `activate_generated_week_v2` function definitions, without body rewrites or
  synthetic marker writers.
- Exact operation, graph-revision and event DDL from the persistence draft,
  including idempotency uniqueness, terminal receipt checks, deferred account/
  selection/operation FKs, Graph V2 shape/digest checks and immutable guards.
- Retained load/record/activate gateways and the unapplied source-commit fence.
- Actual restricted TCP login, `pg` pool adapter, transaction client and restricted
  gateway transport. A deterministic fault is injected *after* actual COMMIT to
  exercise lost-reply recovery against persisted operations and graph data.
- Actual SQL graph and request readback functions, followed by the real client
  Graph V2 decoder and canonical byte/digest equality checks.

Scenarios cover digest rejection, revocation before record and before activation,
late activation failure with subtransaction rollback, separate record/activation
commits, idempotent recovery after each lost reply, current-head visibility,
foreign and missing identity, revoked entitlement, direct access denials and
immutable settled history. The real event table must remain empty: PLAN != FACT.

## Explicit fixture boundaries

Accounts, request rows, entitlement attestations and recipes are synthetic.
`auth.uid()` uses a local claim selector, not Supabase Auth/JWT verification.
The request starts from a pre-created REQUESTED row; the user request endpoint
and scheduler/worker selection algorithm are outside this suite. The retained
load gateway creates the actual attempt operation.

The existing runtime-source fixture provides reduced authority/selection/request
relations. The manifest-entry relation contains only the columns queried by the
writers; its complete publisher DDL and evidence publication pipeline are not
installed. Full graph/operation/event storage DDL is exercised, but this is not
acceptance of the entire restored application schema.

Loopback deliberately has TLS disabled. Owner-reported hosted password/TLS checks
are recorded separately in `generation-owner-connection-observation-20261102.md`.
This suite does not consume those passwords, establish hosted pool connectivity,
prove real catalog readiness, or run the phone UI. Unknown recipe yields and
physical portions remain unknown. Staging/Production, merge, deploy and activation
remain separate authorized steps.
