# Disposable PostgreSQL transaction lifecycle acceptance

This suite exercises createGenerationTransactionClientV1 against persistent
loopback PostgreSQL sessions. It adds an eleventh isolated CI matrix job.
The test role can insert/select only in a dedicated fixture table. These fixture
grants are not the installed source/gateway grants or real generation authority.

The harness uses one persistent psql subprocess per exclusive lease. Fixed SQL
statements and fixture-only parameter substitution keep each command in the same
actual transaction. It is a test harness, not the production parameterized driver
or pool. No dependency or hosted credential is added.

The suite checks persisted COMMIT, rollback after an executed INSERT's reply is
dropped, an actually committed write with a lost COMMIT reply, gate closure before
commit, SQL-error/disconnected-session cleanup, and parallel queries using distinct
backend PIDs. It verifies that all harness sessions have closed. Dropped replies
are deterministic injections after psql reports execution, not real network loss.

Native execution is allowed only with POTOK_GENERATION_STORE_NATIVE=1 and the
fixed loopback database potok_generation_store_disposable. The current workspace
has no psql/PostgreSQL service; local discovery therefore skips the native test.
Actual execution evidence must come from the exact-head CI lifecycle job, with
zero skips. A local skip is not acceptance.

TLS is deliberately disabled for the loopback fixture. This does not establish
managed Supabase TLS, secret provisioning/rotation, production-driver cleanup,
source admission, a source-revocation/record-commit fence or menu E2E.
No hosted database, runtime activation, FACT or Production operation occurs.
