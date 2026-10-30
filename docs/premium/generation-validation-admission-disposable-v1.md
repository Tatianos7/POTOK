# Generation validation admitted reader — disposable v1

Status: **DISPOSABLE DATABASE ROLE/RECEIPT MODEL / NOT DEPLOYED**.
Base: #247 at `7a3abe735c19219765d1833725f67fe416ade34a`.

## Implemented boundary

A dedicated `potok_generation_reader_v1` role has NOLOGIN, NOINHERIT,
NOSUPERUSER, NOBYPASSRLS, no ownership or table access. Its only new privilege is
EXECUTE on a private, fixed-search-path admitted reader. No credentials,
membership, login grant, HTTP endpoint or Edge execution are configured.
The SECURITY DEFINER wrapper requires that exact database session identity;
an arbitrary SET ROLE or user-editable JWT/GUC claim is not accepted as identity.
Account identity and all pinned data derive from the durable request, never
from a caller-supplied account or Premium flag.

The wrapper invokes the existing unmodified
`assert_generation_request_current_v2` and
`is_effective_entitlement_v2` dependency chain. Its checks cover effective
Premium and exact attestation revision, current pending selection, Goal,
provision lineage, week/timezone, preference/safety, manifest integrity and
policy head. No second entitlement calculator or permissive fallback is added.
An explicit fail-closed equality check under the same held locks additionally
rejects missing JSON lineage/identity fields; a NULL comparison in an existing
PL/pgSQL IF is not treated as proof of equality.
Retained exact prerequisite definitions were read from Staging catalogs only on
30 October 2026; their body hashes, ownership, search_path, volatility and
definer metadata are checked before installing the disposable model. They are
not mock functions returning a supplied authorized boolean.

The admitted reader then requires independent owner-registered storage-review
bindings for both source packages. Nonempty `source_receipt_ref` labels alone
are insufficient. Bindings pin request, account, source kind, exact stored raw
SHA256, policy SHA and warning proposal SHA. Registration cannot substitute a
different account, label or payload. Binding/revocation records are private,
RLS/FORCE RLS enabled, append-only and inaccessible to the reader role and all
application roles. No publisher/registration RPC is exposed.

Source revocation is append-only, not an edit or deletion. The revocation
trigger takes the same actual common-account gate as the existing request
admission. The wrapper is VOLATILE deliberately: after waiting at that gate,
its receipt lookup must see a revocation committed by the previous holder.
The native tests exercise both orders. A consistent earlier read never grants
permission for a later activation after revocation.

## Compatibility and driver

The #247 storage helper remains STABLE and SECURITY INVOKER. Its inner guard now
requires the postgres **current execution context**, allowing the narrow admitted
SECURITY DEFINER wrapper to call it. Direct execution remains ungranted; a reader
session is denied even if a test temporarily grants helper EXECUTE. The original
storage/immutability/concurrency suite runs independently to verify compatibility.

The explicit admitted driver factory uses only
`read_admitted_generation_validation_source_v1` with bound request/SHA parameters.
It does not fall back to the unadmitted fixture helper on authorization failure.
The wrapper locks request/selection/current authority rows and the common account
gate; it is not the old side-effecting load/attempt function and does not change
request status or create a ledger attempt. It requires a normal transaction and
cannot run inside `BEGIN READ ONLY` because its admission checks acquire row locks.
Keep the transaction short; do not run external generation while holding it.

## Native acceptance scope

Two fresh PostgreSQL 17.6 jobs run the unchanged storage scenario bodies and the
admission suite independently. Shared fixture construction was extracted without
duplicating nutrition calculations. Minimal base tables are synthetic; the six
retained admission/canonical/account-gate function definitions are actual source.
Synthetic Premium ledger entries exercise GRANT/REVOKE/expiry/broken lineage and
stale attestation; no live Premium or source approval is issued.

The admitted service -> actual gates -> source reader -> existing source loader
-> actual week validator path is tested end to end. Negative cases cover missing
or substituted receipt bindings, fake role/claims, private table and issuer
access, stale Goal/selection/authorities/policies, manifest corruption, immutable
history and concurrent source withdrawal. A second pure test verifies that the
admitted SQL factory never retries through the unadmitted reader.

`SET SESSION AUTHORIZATION` on a local superuser test connection models the real
database authorization identity and definer/invoker boundary. It is **not** proof
of real backend login credentials, TLS/rotation, Supabase user JWT verification,
end-user HTTP isolation, managed role provisioning or an active worker. Native
tests must not be described as acceptance of those deployment layers.

## Remaining gates

Owner-registered storage-review bindings establish a restricted database trust
root for the prototype. They do not authenticate external food-source provenance,
prove clinical/culinary review, replace Food/Nonfood evidence issuance or authorize
an operator to publish a real recipe. No real binding or publication is created.
A compromised database owner remains outside this trust boundary. Independently
reviewed real source receipts and measured recipe yield/servings remain required.

Account closure/retention/erasure, the full original schema and real backend/user
authentication still require separate integration acceptance. New immutable
account-linked RESTRICT references are not a completed deletion policy. The
admission snapshot is not a reusable DB capability: protected record/activate
must recheck entitlement/currentness/source withdrawal at their own transaction
boundaries. No live installation, role creation, SQL apply, generator, payment,
flags, deployment or merge is performed by this package.

All SQL artifacts, including retained prerequisite definitions, reject a database
other than the fixed explicitly marked disposable target before their first DDL.
Preserve those guards; prepare a separate reviewed artifact for any later Staging
installation after resolving the remaining gates.
