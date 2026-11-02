# Inactive generation transaction lifecycle

The direct SQL ports previously delegated session cleanup entirely to a supplied
driver. The optional createPooledRestrictedGenerationWorkerV1 now composes the
existing restricted worker with one exclusive lease and one normal transaction
per adapter query. Source and gateway pools are distinct trusted dependencies;
using different objects alone is not proof of separate database credentials.

Each call pins parameters before acquiring a connection, checks the activation
gate around asynchronous work, then runs BEGIN, the adapter statement and COMMIT.
On failure before COMMIT it attempts ROLLBACK and discards the lease. A failed
COMMIT reply is unknown: the lease is discarded without retrying SQL or claiming
rollback. Release failure after confirmed COMMIT is reported as committed with
cleanup failure. Late gate closure hides a result even if the transaction has
committed. Existing worker same-request status recovery remains necessary.

The pool contract requires exclusive leases, bounded acquisition/query/close,
and destruction rather than idle-pool return when discard=true. The adapter
awaits release exactly once and exposes only fixed errors, never driver details.
The backend driver must enforce these requirements; this interface cannot force
a defective driver to settle promises or destroy a socket. No driver/library,
pool, credential, network connection, server route or automatic activation is
created here. Fixed SQL is supplied by trusted server adapters, not request input.

Normal transactions are deliberate: source readers lock current rows. Locks end
with each short transaction; this does not provide the outstanding provenance
fence between source validation and a later gateway record transaction. Do not
claim that source revocation and record commit are now serialized together.

Eight focused tests cover success/cleanup, acquire/BEGIN/query/rollback failures,
lost COMMIT replies, gate races, parameter pinning and release failures. Sessions
are explicit test doubles. They do not establish real PostgreSQL/TLS behavior or
prove a driver/pool lifecycle. Existing SQL/native suites remain separate.

Generator remains disabled by default. Managed password/TLS setup, actual pool
acceptance, source admission and installed-path menu acceptance remain outstanding.
No database write, source publication, deployment, FACT write or Production change.
