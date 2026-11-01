# Fixed SQL gateway transport

The three protected gateway functions live in the private potok_nutrition schema. The existing public request/status HTTP entrypoint has no privileged client, and default public RPC routing cannot be treated as a working transport. This change adds `createGenerationSqlGatewayV1`, a direct backend SQL adapter, and `createSqlTransportGenerationWorkerV1`, which composes it with the existing SQL-backed weighted worker. The existing Edge entrypoint remains unchanged and unbound.

## Operations and trust boundary

Only load_generation_request_v2, record_generated_week_gateway_v2 and activate_generated_week_gateway_v2 are accepted. Statements name those functions literally, bind request UUID and record hex as parameters, and pass decoded bytea without parsing/rewriting the plan. Extra account/revision fields, malformed UUID/hex, arbitrary SQL/RPC names and direct internal writers are rejected before driver access. Existing response decoders validate exact reply shape and request identity. Raw query/connection exceptions become a fixed error with no database detail or retries.

The actual SQL identity check runs in the same statement as the gateway call. Effective current_user must be service_role, while session_user must be a nonowner session without superuser, BYPASSRLS, CREATEROLE, CREATEDB, replication or postgres membership. A postgres connection followed by SET ROLE service_role is rejected. JWT/GUC role labels do not establish execution identity. The reviewed gateway still supplies its own database permission/currentness boundary; this adapter does not replace it or authenticate an end user.

This narrows the adapter's operation surface; it does not claim service_role is a least-privilege database role. The caller is a trusted backend supplying a dedicated, already admitted driver. The source reader and gateway require their respective correct SQL sessions. No SET ROLE, SET SESSION AUTHORIZATION, login provisioning, pool construction, credentials, schema exposure or owner fallback is implemented in production code.

Runtime gates default false and are checked around each SQL await. Losing a reply after a commit is an uncertain outcome, not a rollback; recovery continues the original request by its stored status. The composed worker test proves the same independently validated bytes survive the new transport and a committed-but-lost record reply does not regenerate or record twice. PLAN creates no FACT.

## Verification limits

Six adapter tests and two new composed-worker cases cover fixed statements/parameters, exact bytes including Unicode/SQL-like text, malformed inputs/rows, request substitutions, default/mid-await gates, suppressed SQL details, no retries and recovery. Preparation/metric/authority/gateway/Auth responses in the composed scenario remain explicit synthetic fixtures.

The ninth native PostgreSQL suite executes these exact transport statements in the fixed loopback disposable database. Its three gateway functions are intentionally synthetic contract-shaped fixtures: they record operation/request/payload to a private fixture table. Tests prove exact bytea delivery, real session/effective-role checks, denial of owner SET ROLE, fake JWT/GUC labels and privileged login identities, and absence of direct service_role table access. Fixture SET SESSION AUTHORIZATION is a local superuser test mechanism, not real backend login/TLS provisioning, the actual generation writer or an installed-path menu test. The existing eight native suites remain separate coverage.

## Deployment still requires admission

The Staging source reader remains NOLOGIN. An injected SQL interface is not an admitted connection. Do not silently enable LOGIN, use owner credentials, impersonate a reader on an owner connection or expose private schemas to make this factory runnable. Backend identity/session provisioning, TLS, secret handling/rotation, concurrency/pool behavior and the protected gateway admission need a concrete reviewed deployment step. No additional hosting service is selected by this change.

The catalog/policy/source publication and record-time provenance/currentness gates remain outstanding before an ordinary-account installed-path acceptance and separately approved activation. PR278's approved installation remains complete; this change installs no SQL, grants no role, deploys no Edge function and leaves the generator inactive. Cooking remains deferred and unknown physical quantities remain unknown.
