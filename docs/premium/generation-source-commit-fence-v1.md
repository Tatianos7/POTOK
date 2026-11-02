# Stored source revocation fence — review candidate

The inactive worker validates through a source connection, releases that
transaction, then records through a separate gateway connection. An admission
check before that gap cannot prevent a committed revocation during the gap.
PR287's short per-query transactions deliberately do not solve this race.

`drafts/generation_source_commit_fence_v1.sql` adds an internal invoker helper
and inserts it into the existing record and activation gateways. Exact retained
function bodies/configurations and both enabled revocation triggers are checked
before installation. The old gateways' ACLs, ownership, SECURITY DEFINER mode,
volatility and search_path are preserved. No function signature, role, direct
table privilege, source table or public API is added. The helper has no app,
reader, gateway or service-role EXECUTE grant; the protected gateways invoke it
as their existing postgres owner. It does not expose an owner-source fallback.

## Transaction boundary

The helper uses the existing current-request gate in its established order:
request row, common account gate, current entitlement/selection/authority,
manifest and policy heads. Despite its historical name, the common account gate
takes an **exclusive transaction advisory lock**. Both stored receipt and producer
revocation triggers already use exactly that gate. The lock is retained through
the actual gateway transaction commit. No lock is held across menu generation,
an external service call or the source/driver await gap.

Only READ COMMITTED is accepted. The VOLATILE helper performs its provenance
queries after acquiring the gate, so a revocation that committed while it waited
must be observed. A prior REPEATABLE READ/SERIALIZABLE transaction snapshot is
rejected before an inner writer can run. Native engine failures are not retried
by this package, and existing gateway error/status handling is retained.

Successful ordering means that the source was admitted at record/activation
commit. A revocation can commit afterward. This does not delete or rewrite an
already recorded plan/receipt, and it does not imply perpetual source validity.
Already terminal gateway replies remain historical/idempotent status recovery;
they create no new plan or activation. A new activation after a source revocation
is checked again and blocked.

## Exact scope of revalidation

The supplied canonical plan bytes are bound to the same account, selection,
request input digest and proposed plan revision. The retained currentness gate
is supplemented with null-safe Goal/selection/entitlement lineage checks.

The helper then requires:

- The stored INPUTS receipt and the final WARNINGS receipt for this exact raw
  proposal SHA-256, with matching account/input/storage hashes and no revocation.
- The current admitted METADATA record for the input/evidence/policy context,
  including a matching allocation for every selected slot/revision.
- For each selected slot/meal digest, its admitted MEAL_WARNING record, matching
  the final warning entry and the same context; revoked/missing records fail.
- Complete selected-slot/warning coverage, no duplicate selected slots and
  verified raw source-storage hashes. Unknown fields/quantities are not filled.

This is a **stored generation-source admission fence**, not a new food evidence
issuer, nutritional validator, warning evaluator or proof of independent review.
It does not independently reconstruct the underlying Food/Nonfood evidence
revocation chains or rerun TypeScript optimization/validation inside SQL. Missing
real reviewed catalog/policy/source admission remains a separate gate. Unselected
candidate warning rows are outside this selected-content fence.

## Verification

The thirteenth disposable PostgreSQL suite installs the actual source storage,
admission/revocation guards, retained current-request gate and retained outer
record/activation gateways. It tests installer drift/late-failure atomicity,
helper denials, same-request replay, each required revocation class, isolation
rejection and activation after a recording. Two real concurrent sessions exercise
both lock orders, observing an actual PostgreSQL lock wait rather than relying
on an arbitrary sleep to arrange the race.

The inner Graph record/activation writers in that fixture are explicitly
synthetic marker writers. The fixture proves whether the retained gateway can
reach them atomically under real source revocation; it does **not** prove the
complete Graph writer schema/constraints, ordinary-account Auth, managed TLS or
request-to-menu E2E. Fixture-only lifecycle/marker reset is not a production
history-maintenance procedure. Native execution requires the fixed loopback
disposable database; a local native skip is not a passing execution receipt.

## Rollout status

Unapplied review candidate. Historical SQL and already installed sources are
unchanged. Installing it would intentionally change two gateway body pins; old
PR282/PR278 installers must not be rerun to restore their previous baseline.
Before any separately approved Staging application, refresh the actual body,
trigger, grant and dependency inventory and prepare its exact bounded package
and postchecks. This PR does not perform that hosted installation.

Generator remains inactive. No hosted write, credential setup, catalog/source
publication, runtime mounting, Edge deployment, master merge, FACT write,
historical recalculation or Production operation. Laptop TLS/password acceptance,
real catalog/recipe readiness, full inner-writer/ordinary-account E2E and separate
activation approval remain outstanding. Physical cooking remains deferred.

References: [PostgreSQL advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS),
[snapshots and application consistency](https://www.postgresql.org/docs/17/applevel-consistency.html).
