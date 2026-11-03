# Node placement and read-only rehearsal: 3 November 2026

Decision for the next test: use the owner's existing laptop to check the actual
Node transport first. No new hosting purchase, account, deployment, Staging write,
source admission or generator activation is performed by this change. A laptop
is a temporary test host, not a production service or a 24/7 availability promise.

## Why host selection needs an IPv6 gate

The implemented worker pins direct connection to
`db.ozidryfvhkcbtpnulakq.supabase.co:5432`, not a session/transaction pooler. Supabase
documents direct endpoints as IPv6 by default; IPv4 direct access requires its
IPv4 add-on (Pro or above). Enabling that add-on changes endpoint IP support; it
must not be purchased/enabled implicitly. This assessment describes the current
code path, not a fresh DNS or subscription observation for Staging.

Sources checked on 2026-11-03:

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://selectel.ru/services/cloud/vps-vds/
- https://timeweb.cloud/services/vps-linux
- https://timeweb.cloud/docs/cloud-servers/manage-servers/create-server

| Option | Observed public offer / limitation | Decision now |
| --- | --- | --- |
| Existing laptop with Node 24 | No additional server rental; IPv6/DNS/TLS and passwords must pass on that actual network | First read-only rehearsal |
| Selectel **VDS** 2 vCPU / 4 GB / 50 GB | Public page lists 650 RUB/month, but explicitly says this VDS line is IPv4-only | Not a drop-in host for the pinned direct IPv6 path; other Selectel product lines are not covered by that conclusion |
| Timeweb Cloud Linux VPS | Public page starts at 900 RUB/month; IPv4 is separately listed at 150 RUB/month. Free public IPv6 exists only in some regions | Candidate for later quotation; exact 2-vCPU/4-GB price, region/IPv6 availability and bill total not verified in an account |

These are public offers, not a reservation, final quote or guarantee of eligibility.
Do not compare Selectel's 2/4 configuration price with Timeweb's unspecified minimum
as equivalent machines. Region, traffic, taxes/options and payment terms must be
checked for the actual chosen configuration before approval. Do not commit to an
annual plan to perform a connection test. A suggested initial 2-vCPU/4-GB host is
an engineering starting point for measurement, not proof of 12,000-user capacity.

The pooler is not selected as a silent IPv4 workaround: exact login identity,
transaction/currentness semantics and TLS would need separate acceptance.

## New external-service notice, before any future provisioning

A VPS would run our existing Node algorithm continuously, not outsource menu
generation to an AI provider. It is needed when we move beyond manual laptop
testing to an always-available worker. Today the laptop and existing CI suffice
for preparation/transport checks, so delaying rental does not prevent that work.

A selected host would receive the worker code, two restricted database passwords
and, during generation, request/account identifiers, nutrition targets, dietary
restrictions and candidate/selected meals in worker memory. Database, Auth and
stored plans remain in Supabase; this is still an additional data-processing host.
No new provider receives these real credentials or user data in this change.

Before provisioning, the owner must approve the provider, region, exact recurring
cost/budget, access model and data-processing placement, and supply host access
through an approved secret channel. No root keys/passwords or OTPs belong in chat.
No legal compliance conclusion follows merely from a server being located in Russia.

## What the new checker does

The artifact now contains `potok-generation-connection-check.cjs` alongside the
disabled worker and `manifest.json`. This checker has no request UUID or generator
dispatch path. Its gate is **separate**:
`POTOK_GENERATION_CONNECTION_CHECK_ENABLED`. Setting the worker gate does not
enable the checker, and enabling the checker does not enable generation.

Both role configurations are first admitted by the worker's existing Node CA/TLS
factory. It then opens at most one connection at a time, with the same fixed host,
role, CA, channel binding and timeouts. Pool max is reduced to 1, startup is forced
read-only, and the transaction starts with `BEGIN READ ONLY`. It executes the
existing reviewed metadata SELECT, then `ROLLBACK` and destroys/releases the lease.

The SELECT is byte-identical to `generation-connection/probe.readonly.sql`, enforced
by a test. It checks session identity, narrow role attributes, memberships, exact
function allowlist, absence of table/sequence access and ownership, schema usage,
actual SSL, timeouts and read-only state. Looking up function privileges does not
invoke those functions. No business rows, generation/source locks or write RPCs
are accessed. Driver/cleanup failures are sanitized, and no retry/host fallback
occurs. A PASS only proves this connection/metadata stage, never source readiness
or generation activation.

The shared private-file reader is extracted from #306 without relaxing its UID,
permissions, size, UTF-8, symlink or duplicate-key checks.

## Laptop handoff

1. Download the package attached to the PR's successful general CI run. Extract it
   in a private local folder. Do not upload that folder after adding configuration.
2. Confirm `node --version` is Node 24; the manifest records the exact CI version.
3. Run `node ./potok-generation-connection-check.cjs` with its gate unset/empty.
   Expected outcome: DISABLED. No config or network is used by this smoke.
4. Locally prepare a regular, UID-owned 0600/0400 file using this exact schema.
   Replace placeholders only on the laptop, using the public CA and the two already
   established restricted-role passwords from the password manager. Never send
   the resulting JSON, passwords or full terminal environment to chat. JSON PEM
   newlines must be encoded as `\n`; use a JSON editor rather than shell interpolation.

```json
{
  "contract": "potok-staging-node-connection-config-v1",
  "secrets": {
    "ca": "PUBLIC_ROOT_PEM_FROM_THE_EXISTING_OWNER_FILE",
    "readerPassword": "LOCAL_SECRET_ONLY",
    "gatewayPassword": "DIFFERENT_LOCAL_SECRET_ONLY"
  }
}
```

5. Run the connection-only command, replacing only the config-file path:

```sh
POTOK_GENERATION_CONNECTION_CHECK_ENABLED=true node ./potok-generation-connection-check.cjs /absolute/private/connection-config.json
```

This command does not set `POTOK_GENERATION_WORKER_ENABLED` and cannot generate a
plan. Return only the small JSON report (`outcome`, role/check flags, `mayActivate:false`),
never configuration. DNS/IPv6 failures are not silently routed to a different IP,
pooler or host. The old psql/hostaddr observation does not prove this Node transport
works; this exact checker is intended to establish that missing evidence.

An enabled generation attempt remains a separate future action requiring admitted
runtime sources, independently pinned policies, a real test request, scoped Staging
write approval and ordinary-account Auth-to-plan acceptance. None are inferred
from a successful connection report.
