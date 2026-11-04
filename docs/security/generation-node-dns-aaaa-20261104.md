# Explicit AAAA resolution for the read-only Node checker

Owner laptop observation, 2026-11-04: Node 24.11.1 on macOS returned
`ENOTFOUND` from `dns.lookup(fixedStagingHost,{all:true})`, while a separate
`Resolver.resolve6` query succeeded and a TCP connection to the returned IPv6
address on port 5432 completed. This localizes a system-name-resolution problem;
it does not establish TLS, password or role acceptance.

The Supabase project metadata was read-only verified as ACTIVE_HEALTHY with the
same fixed database hostname. No passwords, private config or user data were
collected, no schema/data changes were made and no generator was activated.

## Explicit mode, fixed authenticated identity

The connection checker accepts `POTOK_GENERATION_CONNECTION_DNS_MODE=DNS_AAAA`.
SYSTEM remains the default. Invalid modes fail before connection; there is no
automatic retry with another resolver, host, pooler, password or SQL request.
The generation worker entry is unchanged and still uses its existing transport.

The AAAA resolver queries **only** the existing fixed Staging hostname through
Node's independently created resolver with default configured DNS servers. It
does not select Google/Cloudflare or change system DNS, `/etc/hosts`, global Node
lookup methods or environment proxy settings. The resolver has one try per server
and an independent total deadline of five seconds; abort/deadline cancels it.
Replies must be a bounded nonempty list of numeric unscoped IPv6 addresses.
The first reply is selected once per invocation; it is not logged or stored.

Both normal CA/password configurations are admitted before DNS/socket work. Only
the pg transport `host` becomes the returned numeric address. TLS `servername`
remains the fixed Supabase DNS hostname; CA, `rejectUnauthorized:true`, TLS minimum,
channel binding, role names, startup selectors and all read-only checks remain
unchanged. Pinned pg 8.23.1's TLS upgrade retains an explicit servername for numeric
IP hosts. Native TLS verification authenticates that hostname, not the numeric IP.

This distinction is tested with a real TLS server on IPv6 loopback: the correct
named certificate succeeds; a wrong DNS name or wrong root CA fails. Synthetic
private keys remain only in test memory. Those automated TLS tests alone do not
prove a real Staging login; the subsequent owner-local acceptance is recorded below.

The output additionally reports the selected mode and a fixed `failureStage`
(`CONFIG`, `DNS`, `ACQUIRE`, `QUERY`, `VERIFY` or `CLOSE`) on failure/stop. It never
prints passwords, CA contents, connection strings, IP addresses or raw errors.
Existing report outcome/check fields and `mayActivate:false` are retained.

Primary references:
- https://nodejs.org/docs/latest-v24.x/api/dns.html (lookup vs resolve; Resolver defaults, cancellation and timeout)
- Locked pg 8.23.1 `lib/connection.js`, TLS upgrade's explicit servername and numeric-host handling
- The existing worker's fixed `generationStagingPgConfigV1` and native TLS tests

## Owner handoff

Download the **new** successful CI artifact from this PR, unpack it and switch the
terminal into that unpacked folder. Keep the existing private config in
`$HOME/.potok/connection-config.json`; no password re-entry or file copying into
the download directory is needed. The older executable ignores the new variable,
so merely re-running it from the old folder will not enable this mode.

Then run only the connection checker:

```sh
POTOK_GENERATION_CONNECTION_CHECK_ENABLED=true POTOK_GENERATION_CONNECTION_DNS_MODE=DNS_AAAA node ./potok-generation-connection-check.cjs "$HOME/.potok/connection-config.json"
```

Share only the small JSON report. A successful local result must include
`outcome:"PASS"`, `dnsMode:"DNS_AAAA"`, `failureStage:null`, two successful role
checks and `mayActivate:false`. Connection success is not generation approval or
runtime-source readiness. The program still runs only BEGIN READ ONLY, the reviewed
metadata SELECT, ROLLBACK and cleanup. A failure should now identify its stage.

Automated validation covers resolver reply/timeout/abort contracts, exact TLS-name
preservation, native IPv6 TLS rejection cases, fixed SQL, default SYSTEM behavior,
explicit mode, invalid mode, cancellation and no fallback/pool acquisition on DNS
failure. No paid service, new provider or deployment is introduced.

## Owner-local connection acceptance, 2026-11-04

The owner ran the updated checker twice on macOS / Node 24.11.1. Both reports
returned PASS, DNS_AAAA, null failureStage, both expected roles passed with empty
failedChecks, and mayActivate:false. The exact sanitized reports are retained in
`generation-node-owner-connection-observation-20261104.json` beside this document.
They are owner-reported terminal observations, not an agent replay or a verified
checksum measurement on the owner's machine.

This establishes actual Node/TLS login and the reviewed read-only role-metadata
checks from that laptop/network at the time of the two runs. No passwords, config
contents, numeric server addresses, business rows or local personal paths are
stored in the observation. It does not establish worst-case load, worker hosting,
source readiness, an ordinary-account generation flow or permission to activate.

The read-only transport gate is now complete for this laptop. No more repeated
connection probes are needed without a change or failure. Next, separately prepare
the same explicit resolution mode for the generation worker (which still uses
SYSTEM), review runtime-source readiness, and prepare one scoped Staging test.
A real generation write and generator activation remain separate approval gates.
