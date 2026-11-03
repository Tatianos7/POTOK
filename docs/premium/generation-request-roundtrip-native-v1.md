# Native request-to-menu roundtrip

This extends the disposable PostgreSQL Graph V2 suite with the retained public request and status functions, the actual request identity guard and goal target table, and the application request controller and menu renderer. It runs only against the existing fixed-loopback disposable database in the native CI fixture.

The scenario begins without a request row for a new synthetic account. The public SQL endpoint creates the request and immutable canonical input. A deliberately lost successful response is recovered with the same idempotency key, including concurrent replay. Wrong-protocol replay and identity mutation are rejected. A synthetic accepted proposal is bound to the SQL-issued input, recorded and activated through the restricted gateway. The real application controller waits through GENERATED, reads only after ACTIVE, decodes the stored graph and renders seven days. The account's four ledger operations are accepted exactly once, and the FACT event relation remains empty. Foreign and anonymous sessions cannot use the account's request.

## Boundaries

- The client uses actual PostgreSQL queries as a restricted login with a local authenticated role and explicit fixture claim. Supabase Auth, JWT verification, PostgREST, hosted TLS and browser interaction are not exercised.
- Account, entitlement, authority, goal target, catalog and accepted proposal are synthetic. Proposal construction and validation use the existing trusted fixture; this does not test automatic worker selection or publish real catalog evidence.
- The request relation and supporting authority relations retain the existing reduced fixture schema. Exact retained public function bodies and selected identity/target guards are installed; this does not claim a full hosted schema reproduction.
- Rendering is server-side markup of the real component, not a phone/browser end-to-end test.
- No hosted writes, runtime deployment, generator activation, secret binding, history recalculation or Production operation are part of this change. PLAN remains distinct from FACT.

Run `POTOK_GENERATION_STORE_NATIVE=1 node --import tsx --test scripts/contracts/generation-validation-graph-v1.test.ts` only with the documented disposable native fixture. Without the opt-in, native execution is skipped. The `PostgreSQL graph` CI job supplies PostgreSQL 17.6 and the isolated test credentials.
