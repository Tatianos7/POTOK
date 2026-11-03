# Inactive managed generation runtime

`createStagingGenerationRuntimeV1` connects the existing fixed-Staging node-postgres pools to the existing pooled restricted SQL worker. It accepts trusted backend CA/password configuration and independently admitted policy bodies, comparison mode and convenience source. Construction returns an inactive runtime by default and uses lazy pools. It does not read process credentials, mount a route, schedule work, deploy Edge, publish a catalog or enable generation.

`createManagedGenerationRuntimeV1` is the backend composition boundary for separately supplied pool factories. The Staging wrapper always chooses the existing fixed-host/TLS/role factory; it offers no host, role, connection URI or owner fallback. Neither factory is a source-admission authority. All existing validation, exact SQL identity, parameterized transaction, source-currentness, record and activation checks remain in the worker.

The runtime exposes only `continue(requestOperationId)` and `close()`. At most one continuation is active per runtime instance; overlaps fail with a fixed busy error, without queuing/retrying. The same gate protects the worker and both pools. Closing synchronously closes that gate before awaiting pool shutdown; a late worker response cannot be returned as success. Close is idempotent and remains closed after failure. Construction failures close any returned partial pools and report a distinct fixed cleanup failure when that cleanup fails. Driver details/configuration are not attached to those errors. An uncertain COMMIT retains the existing same-request recovery contract; there is no automatic write repeat.

This bound is per instance. A future deployment must review the complete process/replica budget against the installed two-connection limit per role and current max-two pool settings. Creating several instances is not authorization for extra connections. The adapter's existing destruction acknowledgement/deadlines do not prove immediate remote cancellation; no stronger shutdown guarantee is introduced here.

## Fresh read-only Staging observation

Observed 3 November 2026, 12:58:11 Europe/Moscow, before this source change:

- The separately identified `POTOK Staging` project `ozidryfvhkcbtpnulakq` reports ACTIVE_HEALTHY.
- The existing SELECT-only patch inventory reports installedReady=true, all 11 common checks true, installed functions true and private helper valid. No installer was replayed.
- Manifest heads=0, generation policy heads=0, validation input rows=0, warning rows=0 and preparation source rows=0. These aggregate counts establish absence at observation time, not acceptance/readiness of future sources.
- The Edge function inventory is empty. No worker deployment is claimed.

No hosted write was executed. The earlier specific PR291 apply approval is not reused to insert sources or deploy a worker. The authoring catalog and local viewer from PR295–299 remain outside the admitted runtime. Deferred cooking does not approve that catalog, fabricate measurements or satisfy warning/policy provenance.

## Validation and next gates

Seven new tests use the real restricted worker/transaction composition with explicit pool doubles: default inactivity, ACTIVE recovery without regeneration, concurrent denial and mid-query shutdown rollback/discard, external gate closure, partial-configuration cleanup (including identical source/gateway pool denial), failed/idempotent close, and construction/close of real lazy Staging pg pools with synthetic configuration and no acquisitions. All 43 focused runtime/pg/transaction/gateway/SQL-weighted-worker tests pass with zero skips, alongside TypeScript, targeted ESLint and the full build/postbuild. The deeper producer/storage paths remain separately evidenced by those existing regressions. This is not a new hosted connection, complete actual-catalog generation, real Auth or Staging request-to-menu E2E.

Before an installed-path acceptance run, backend secret binding and its execution environment, admitted catalog/policy/warning sources, request dispatch and authenticated client mounting still need concrete review and implementation. No new external provider has been selected or connected. Any proposed new provider/cost/data transfer must first follow the owner's external-services notice rule. Any Staging write/deployment and generator activation still require their separately scoped approvals. PLAN remains distinct from FACT.
