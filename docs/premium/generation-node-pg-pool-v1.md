# Inactive node-postgres pool adapter

This package closes the driver gap after PR286: the transaction client can now
lease a real `pg` client rather than a supplied query callback or psql fixture.
`pg` and its TypeScript declarations are pinned to 8.23.1 in the lockfile.
There is no new hosting provider, runtime entrypoint, route or activation.

## Boundaries and configuration

`createStagingGenerationNodePgPoolsV1` creates separate lazy reader/gateway pools
for the existing two narrow roles on the fixed direct Staging host, port 5432,
database postgres. Construction opens no socket; acquisition is disabled by
default. It takes an owner-provenance public CA and two distinct nonempty passwords
from trusted server configuration, never from the app or request input. Nothing
loads a password from a repository file, logs a configuration/error object, uses a
connection URI or provisions/rotates a hosted credential.

The CA receives bounded root/validity checks. TLS requires certificate/hostname
validation, explicit servername and TLS 1.2 or newer. Fixed explicit startup values
exclude inherited PG host/user/password/SSL/options/replication selectors. Local
CA parsing does not establish its provenance or prove an actual TLS connection.
The existing SELECT-only password/TLS verifier remains a separate laptop step.

Each pool has max=2, 5-second connection/acquisition timeout, 30-second server
statement timeout, 5-second lock timeout, 10-second idle-transaction timeout and
35-second client query deadline. The adapter permits at most two pending
acquisitions; it does not allocate an unbounded application queue. Excess work
fails with a fixed busy error. Idle clients expire after 10 seconds; maximum
connection lifetime is 300 seconds. These are per-pool limits, not a deployment
wide connection budget. Multiple processes/replicas require a reviewed budget
against the installed per-role two-connection limits before mounting.

## Lease and failure handling

- Each transaction uses one exclusive client. Extended-query parameters are
  bound separately; no interpolation or multi-statement simple-query fallback.
- Acquisition and query deadlines never trigger a repeat. A late acquisition is
  destroyed. Concurrent queries on one lease and queries after release are denied.
- Query errors/timeouts remove the client from the pool and request destruction.
  Local socket closure is not acknowledgement of remote cancellation. PostgreSQL
  can continue a running statement until disconnect detection or its server
  statement timeout; the independent server/idle-transaction deadlines remain
  necessary. Once disconnection is processed, uncommitted work is aborted. A dispatched COMMIT remains
  uncertain; the existing transaction wrapper reports UNKNOWN and its caller
  must use same-request recovery rather than resubmit the write.
- Release is idempotent at the adapter boundary. Discard waits for the driver's
  end event with a 2-second acknowledgement bound. Missing acknowledgement fails
  explicitly; it is not claimed as proof that a remote socket has disappeared.
- Shutdown blocks acquisition, destroys active leases and drains idle clients.
  Idle/checked-out error events are handled without printing driver details.
  The supplied low-level pg pool must be exclusive to this adapter.

Trusted server composition, when separately admitted, can pass `sourcesPool` and
`gatewayPool` to the existing `createPooledRestrictedGenerationWorkerV1`, using
the same activation predicate. This PR does not mount that composition. Pool
construction is not role/function admission; existing SQL identity/currentness
checks and the real connection acceptance remain necessary.

## Verification and remaining gates

Unit tests use explicit event-emitter driver doubles, plus offline parsing of the
actual pg Client configuration. They cover parameter pinning, timeouts, late
leases, gate races, shutdown, missing close acknowledgement, acquisition bounds,
sanitized failures and uncertain COMMIT. They do not prove a hosted connection.

A twelfth isolated CI matrix suite uses actual pinned pg TCP sessions on the
fixed disposable loopback PostgreSQL database. It verifies bound special text,
backend isolation, pool saturation/recovery, timeout destruction, SQL-error
cleanup, multiple-statement rejection, persisted COMMIT with injected lost reply
and active shutdown. Final pg_stat_activity inspection requires no fixture
sessions after the explicit fixture server deadline (1 second, plus 2 seconds
for scheduling/observation), rather than treating a local end event as immediate
server termination. Loopback TLS is deliberately disabled. Local native discovery skips
without explicit opt-in; only actual execution with zero skips is acceptance.

Still open: protected hosted passwords, actual CA/hostname/TLS and restricted
identity acceptance, deployment connection budget/secret rotation, admitted real
sources/catalog/policies, the cross-transaction source-revocation versus record
commit fence and ordinary-account request-to-menu E2E. The new adapter does not
close these gates. PLAN never becomes FACT automatically. Cooking remains
deferred; physical quantities stay unknown. No hosted database mutation,
publication, deployment, master merge, generator activation or Production action.

References: [pg pooling](https://node-postgres.com/apis/pool),
[pg client](https://node-postgres.com/apis/client),
[TLS configuration](https://node-postgres.com/features/ssl).
