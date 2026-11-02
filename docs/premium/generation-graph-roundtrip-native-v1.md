# Graph V2 persistence roundtrip — isolated native acceptance

This test closes the gap between marker-only inner writes in the source-fence
suite and pre-inserted Graph rows in the readback suite. It introduces no runtime
entrypoint, hosted SQL installation, credentials or generator activation.

## Recipe identity defect and bounded correction

The retained inner writers match manifest recipe IDs using the nonexistent
flattened `component.recipeId`; the Graph V2 contract carries the ID in
`component.recipe.recipeId`. Exact canonical component snapshots still match,
but a valid Graph cannot pass the old manifest query. The native regression first
requires that the original writer reject the valid fixture with
`manifest component missing`.

`drafts/generation_graph_recipe_identity_v1.sql` is a separate **unapplied**
candidate. It replaces exactly one recipe-ID selector in each of the two pinned
inner functions. Before/after body hashes and owner/security/signature/ACL
postchecks restrict the change; second-function drift or a late failure rolls
back both replacements. Existing recipe revision, portion, eligibility and exact
snapshot comparisons are retained. Baseline SQL drafts are unchanged.

Fresh hosted inventory and separately approved installation are required. This
test does not establish that current hosted bodies match these pins.

`scripts/contracts/generation-validation-graph-v1.test.ts` runs as the fourteenth
isolated PostgreSQL matrix suite (`graph`). It admits only the existing fixed
loopback disposable database. Native execution must finish with zero skips before
claiming that the scenarios passed. Without explicit native opt-in, the static
SQL extraction check runs and the native parent is skipped.

## Retained production-candidate code exercised

- Exact protected inner `record_generated_week_v2` and
  `activate_generated_week_v2` definitions, then the bounded identity correction
  above; no synthetic marker writers.
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
