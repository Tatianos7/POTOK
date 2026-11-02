# Runtime connections — restricted candidate

Current installation status: the scoped LOGIN/grant package was applied on Staging on
2026-11-01; see [installation receipt](generation-runtime-logins-install-20261101.md).
The candidate/pre-install descriptions below are historical. On 2026-11-02 the
owner supplied successful manual password/TLS/read-only probe results for both
restricted roles; see [owner connection observation](generation-owner-connection-observation-20261102.md).
This is not a worker-pool connection or request-to-menu acceptance.

## Local certificate preflight — 2026-11-02

Before launching psql, the verifier reads only the selected public CA file and
requires one PEM root certificate, no extra PEM objects, at most 64 KiB, the CA
constraint, a valid self-signature and a current validity interval. Password-file
contents are never read by the JavaScript verifier. This check validates local
certificate structure; it does not independently establish that a root belongs to
Supabase. Download it from the project's authenticated database settings. libpq's
verify-full still performs the actual server chain/hostname check.

The owner's downloaded public Supabase Root 2021 CA passed local parsing/validity
preflight on 2026-11-02. This does not prove live TLS or password authentication,
and the uploaded certificate is not copied into the repository.

| Sanitized error | Owner action |
| --- | --- |
| GENERATION_CONNECTION_CA_INVALID | Download the public project CA again; select the certificate file, not a password/key/bundle. |
| GENERATION_CONNECTION_CA_NOT_CURRENT | Check the computer's clock and obtain a current project CA. |
| GENERATION_CONNECTION_PSQL_NOT_FOUND | Install/locate psql before rerunning the read-only verifier. |
| GENERATION_CONNECTION_HOSTADDR_INVALID | Supply one numeric IPv4/IPv6 address from the fixed Staging host's current DNS records; omit the selector to use normal DNS. |

All errors omit raw certificate bytes, driver stderr and private paths. Unit tests
cover valid/invalid/self-signature/validity/file failures, credential non-reading,
missing psql and the existing fixed-host/role/TLS/read-only probe construction.
No password, database write, SSL enforcement toggle, deployment or activation is
performed by this preflight.

The installed source reader is NOLOGIN and therefore is not a usable password login. Giving it an injected query callback in a test did not establish a real backend connection. Staging metadata also confirms service_role is NOLOGIN and BYPASSRLS; the worker should not obtain that broad role through an owner session. This candidate prepares separate narrow source and gateway logins. No new hosting provider is required or selected.

## Exact SQL scope, not yet installed

`docs/premium/drafts/generation_runtime_logins_v1.sql` requires the installed PR278 package, postgres operator identity, unchanged seven source/gateway bodies/configuration, the existing four-reader allowlist and no unreviewed memberships. It:

1. Creates potok_generation_gateway_v1, without inherited roles/admin/BYPASSRLS, and grants only schema USAGE, database CONNECT and EXECUTE on the three existing protected load/record/activate gateways.
2. Enables LOGIN on that role and the existing potok_generation_reader_v1. The reader retains its same four function grants; no service_role membership, application table/sequence grant or business data is introduced.
3. Limits each role to two connections and sets default statement/lock/idle-in-transaction timeouts to 30/5/10 seconds, with pg_catalog search_path. These are defaults for trusted backend connections, not immutable resource capabilities against a compromised credential holder.
4. Asserts effective table/sequence denials and function counts before commit. Managed owner-only administrative memberships are allowed; runtime roles themselves may inherit no roles. The observed reader grant to postgres from supabase_admin has ADMIN true and INHERIT/SET false and is not removed.

New gateway password is NULL; existing reader password is neither read nor changed. The package does not provision credentials, start a connection/pool, configure an Edge secret, publish sources or activate generation. A secure separate password/secret setup and actual managed connection acceptance are still required. Earlier NOLOGIN installation-preflight observations remain historical; do not rerun old installers to reset an approved login configuration.

This exact LOGIN/grant change is NOT covered by the earlier four-source installation approval. Do not apply it without new specific owner approval.

## Explicit runtime code

`createRestrictedGenerationSqlGatewayV1` accepts only its exact gateway session/effective identity, safe role attributes and no outbound memberships. It reuses the existing fixed-operation/byte/response decoder; it never switches to service_role. `createRestrictedSqlTransportGenerationWorkerV1` composes it with the SQL-backed weighted worker. Existing service-role factories are unchanged. No runtime or Edge entrypoint defaults to the new path.

The restricted transport still relies on a trusted driver and actual credential/session admission. It cannot prove network authentication from a supplied interface or defend against a compromised database owner. Runtime source calls require short normal transactions because their currentness gates lock rows; the verification script below is a separate SELECT-only session and must not be reused as the worker's read-only execution connection.

## Connection verifier

`node scripts/security/generation-connection/verify.mjs` is fixed to the direct Staging host db.ozidryfvhkcbtpnulakq.supabase.co, port5432/database postgres and the two exact role names. It runs only metadata SELECTs, requires certificate/hostname verification (verify-full), enforces private readable password-file mode, strips inherited database/session selectors, and emits only sanitized check outcomes. It does not read password-file contents or print driver stderr, credentials or connection strings. Direct-host reachability, including IPv6 support, is not presumed proven.

The owner supplies absolute local paths in POTOK_GENERATION_PGPASSFILE and POTOK_GENERATION_CA. The password file should have mode0600 (or owner-read-only) and two libpq entries for the fixed host/database/role names; real passwords belong only in the private file and managed backend secret store. Download the project CA through [Staging database settings](https://supabase.com/dashboard/project/ozidryfvhkcbtpnulakq/database/settings). No real password or service key should be sent in chat. The verifier selects those private file paths; it does not provision the secrets or copy them into the app.

### Optional explicit numeric route

If system name lookup fails but a current DNS query and TCP check confirm a route
to the fixed host, the trusted operator can set `POTOK_GENERATION_HOSTADDR` to one
numeric IPv4/IPv6 address. It is passed to libpq as `PGHOSTADDR` while `-h` remains
the fixed Staging hostname. `verify-full`, the selected CA and password-file
matching against the hostname remain intact. No address is embedded in source,
persisted by the verifier, returned in observations or discovered automatically.
The operator must recheck DNS when an address changes; this is an explicit route,
not a permanent IP pin or proof of address ownership by itself.

Empty values, hostnames, URIs, lists, ports, whitespace, brackets and scoped IPv6
interface selectors fail locally before files are read or psql starts. An omitted
selector keeps normal hostname lookup. Inherited libpq route/session selectors
are still excluded. A failed connection is not retried with another address and
TLS verification is never weakened. This option applies only to the separate
read-only verifier, not the inactive `pg` pools.

PostgreSQL documents both hostname verification and password-file matching for
combined `host`/`hostaddr` in [libpq connection parameters](https://www.postgresql.org/docs/18/libpq-connect.html#LIBPQ-PARAMKEYWORDS).

Checks cover real session identity, safe LOGIN attributes/connection limit, memberships, exact private function allowlist, absence of application table/sequence rights/owned objects, schema usage without CREATE, TLS, bounded defaults and read-only probe state. Missing TLS or a contradictory/missing check cannot produce readiness. A successful connection check still has mayActivate=false; it is not catalog admission, Premium verification or installed-path menu acceptance.

[Official SSL documentation](https://supabase.com/docs/guides/platform/ssl-enforcement) explains verify-full and project CA selection. This candidate changes no global SSL setting and triggers no database restart.

## Verification scope

The new native suite uses actual password/SCRAM TCP authentication to the fixed loopback disposable database, the retained source/gateway bodies, the role candidate and its real privilege checks. Test credentials are explicitly disposable and are never hosted secrets. It proves no password was silently provisioned for the new gateway, baseline/late-postcheck failures roll back role changes, correct identities reach actual source/gateway gates, cross-channel function/table access is denied, and source/gateway privileges remain four/three. These are synthetic request/authority fixtures, not a real menu or managed Supabase connection.

Loopback deliberately has TLS disabled. Consequently the metadata probe must report TLS=false and overall connection readiness=false while its other checks pass. Actual managed TLS/certificate validation and secret rotation/pool lifecycle still need acceptance after separately approved configuration. Offline tests verify safe command construction, file modes, missing/forged checks and error suppression. Existing legacy worker/SQL transport behavior remains covered.

No live role/grant/password write, source publication, deployment or activation was performed by preparing this candidate. Cooking remains deferred, unknown physical quantities remain unknown, and PLAN does not create FACT.

