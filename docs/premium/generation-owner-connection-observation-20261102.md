# Owner-reported restricted Staging connections — 2026-11-02

Evidence source: terminal output supplied by the owner in the master chat on
2026-11-02, using the files checked out from PR288 commit
`c265983878cf389dbe7af0f03bffbe9442d98b94`. This note records that observation;
the agent did not independently connect from this executor. No secrets or private
database rows are retained here.

## Observed manual acceptance

- The public CA passed `validateGenerationCa` locally (`CA_OK`).
- Normal hostname lookup in psql initially failed. A separate DNS AAAA lookup
  returned an IPv6 address and a TCP connection to port 5432 succeeded.
- The owner connected using both the fixed Staging hostname and the current DNS
  address, with `sslmode=verify-full` and the selected public CA. The administrative
  session reported TLS 1.3. An initial password rejection was followed by an
  owner-performed administrator password reset and successful connection.
- `pg_roles` showed both expected restricted roles with LOGIN, connection limit 2,
  and no SUPERUSER, CREATEROLE, CREATEDB or BYPASSRLS attributes.
- The owner completed separate `\password` prompts for reader and gateway without
  a reported error, then authenticated independently as each role.
- Each role executed the retained `probe.readonly.sql` with
  `default_transaction_read_only=on`. Both returned
  `connectionChecksPassed: true`, `mayActivate: false` and all ten checks true:
  session identity, role attributes, memberships, function allowlist, table
  access, ownership, schema access, TLS, timeouts and read-only probe.

## What remains open

The password-file-based JavaScript verifier has not been run on the owner's Mac.
The manual probe used password prompts and an explicit address. The new optional
route selector is tested offline, not a claim of another hosted execution.

No backend secret-store installation or actual `pg` pool/worker connection has
been observed. Passwords remain under owner control; they were not supplied to the
agent. An administrator password rotation can require updating existing clients
that use it; the owner has not supplied a complete inventory of such clients.

The dashboard had shown `Unhealthy`; the successful SQL connections do not prove
that every project service recovered. Full service health is not closed here.

PR288's atomic source fence remains an unapplied candidate. Fresh hosted
inventory, reviewed exact gateway pins and separate approval are required before
its installation. Actual graph persistence, account/Auth boundaries, reviewed real
sources/catalog/policies and request-to-open-menu acceptance remain separate
gates. No merge, deploy, source publication, runtime activation, FACT write or
historical recalculation is established by these connection results.

Physical recipe portions and cooked yields remain unknown where untested.
The generator remains inactive. PLAN != FACT.
