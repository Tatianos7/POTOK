# Restricted runtime SQL rights installed — 1 November 2026

Applied the exact [PR282](https://github.com/Tatianos7/POTOK/pull/282) Staging login/permission package from immutable commit `03e7b5681023a36a0e225f8404c1b82b220672ff` to `ozidryfvhkcbtpnulakq`. The owner replied “Продолжи работу” immediately after the explicit question about applying these rights in Staging with generation inactive. This authorizes this bounded operation, not credentials publication, generator activation or Production.

Source: `docs/premium/drafts/generation_runtime_logins_v1.sql`. SHA256: `3350df015b5c0f4839c9ca440ff39178d942696b5ce5a2961fb47c50e98619c0`. Migration name: `generation_staging_runtime_logins_v1`. The approved SQL definitions/role/grant scope were unchanged; only local transaction lock/statement timeouts were added for the operator's apply. Exact-head CI had passed build/regressions and all ten native suites before installation.

## Independent verification

Fresh preflight at 2026-11-01T17:53:13.369181+00:00 confirmed the existing reader was NOLOGIN with exactly four readers, the gateway role was absent, all seven function bodies/configurations matched, no reader application-table/sequence rights existed and the operator could administer the role and grant database CONNECT.

The guarded transaction succeeded. A separate postcheck at 2026-11-01T17:55:10.665725+00:00 confirmed committed state:

- Both potok_generation_reader_v1 and potok_generation_gateway_v1 allow LOGIN, have connection limit2, and retain no SUPERUSER/BYPASSRLS/INHERIT/CREATEROLE/CREATEDB/replication capability.
- Reader has exactly its four admitted source functions; gateway has exactly load_generation_request_v2, record_generated_week_gateway_v2 and activate_generated_week_gateway_v2. Neither runtime role inherits another role; no service_role membership is granted.
- Effective application table/sequence rights, owned relations, owned functions and owned schemas are zero for both roles. Schema USAGE and database CONNECT are granted; schema CREATE is absent.
- Each role has pg_catalog search_path and default statement/lock/idle-in-transaction timeouts of 30/5/10 seconds. Defaults are not immutable limits against a compromised credential holder.
- The managed postgres administrative memberships granted by supabase_admin have ADMIN true and INHERIT/SET false. This is operator administration, not outbound runtime inheritance. Existing membership was preserved; the platform created the same owner-administration membership for the new role.
- All seven retained function bodies/configurations remain unchanged. Validation inputs, final warnings, preparation sources, published manifests and published policy heads remain zero. Edge inventory remains empty; security advisor comparison found no new findings. Existing unrelated advisories are not resolved by this change.

Sanitized evidence: `scripts/security/generation-connection/install-observation-20261101.json`. It contains role/function metadata and aggregate counts, no user records, credentials, JWTs, OTPs, password hashes or private keys. The raw password storage was not queried.

## Remaining connection setup

LOGIN permission is not a configured connection. No password was read, generated or provisioned by this operation. The new gateway was created with PASSWORD NULL as reviewed; the existing reader password was not changed. Do not infer usable credentials or successful managed TLS from a role flag.

Secure private password/managed-secret configuration and a real `verify.mjs` check using the project CA with certificate/hostname validation remain required. The actual Supabase password/TCP/TLS verifier was not run with fabricated or owner credentials. The native suite's earlier successful SCRAM/TCP tests were confined to the disposable loopback database and explicitly did not prove managed TLS. No secret should be sent in chat or committed.

Runtime/client mounting, pool/rotation lifecycle, independently admitted policy/catalog/warning sources and ordinary-account installed-path menu acceptance remain outstanding before a separately approved activation. No business source was published, no generator/Edge was activated/deployed, no master merge occurred and Production was not operated on. PLAN remains distinct from FACT, and cooking remains deferred.
