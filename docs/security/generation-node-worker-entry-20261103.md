# Standalone Node worker entry, disabled by default

Continues #305. This prepares a reviewable executable, not hosting or activation.
No Staging command was executed. The existing Supabase request/status endpoint is
unchanged and has no dispatch connection to this process yet.

## Execution boundary

The trusted operator supplies one already-created request UUID and one private
configuration-file path. The process calls the existing fixed-Staging Node runtime
once, closes both pools and exits. It creates no HTTP endpoint, queue, timer,
request claim, automatic retry, source admission or FACT. The request must already
be eligible for the existing continue protocol; knowing a UUID does not replace
its SQL authorization/currentness checks.

`POTOK_GENERATION_WORKER_ENABLED` must be exactly `true` to perform any work.
Without it, the process returns DISABLED without reading configuration or opening
a connection. That switch is an operator control, **not** owner approval. A scoped
Staging-write approval remains required before an enabled invocation.

The host accepts Node 24 on Linux/macOS with POSIX file ownership. The reviewed
build/test version comes from `.node-version`. It explicitly refuses Deno rather
than attempting a weaker TLS fallback. No container, service account, provider,
machine or paid resource is provisioned by the build.

## Configuration contract

The file must be a regular file owned by the worker UID, mode 0600 or 0400, with no
group/other permissions. Final-component symlinks are refused. A nonblocking open
prevents FIFO opens from hanging; non-regular files are rejected. Reads are bounded
to the observed size, at most 2 MiB; invalid UTF-8, BOM, changed size and duplicate
JSON keys fail closed. Secret-manager mounts must provide an appropriately owned
regular file; default symlink/group-readable mounts do not meet this contract.

Exact top-level fields:

| Field | Value / source |
| --- | --- |
| `contract` | `potok-staging-node-worker-config-v1` |
| `secrets` | Exact string fields `ca`, `readerPassword`, `gatewayPassword`; trusted server secret storage |
| `optimizationPolicyRaw` | Independently pinned policy as primitive JSON string |
| `metricPolicyRaw` | Independently pinned metric policy as primitive JSON string |
| `comparison` | Exactly `ROBUST_CONVENIENCE_BOUNDS` |
| `limitsRaw` | Primitive limits JSON string, or explicit null to use reviewed existing defaults |

The existing runtime admits policies, secrets, CA and limits; this file format does
not confer publication authority. Unknown fields are refused. There is no host,
port, DSN, role or project selector: existing Staging project, two narrow login
roles, verified TLS, channel binding, pool and SQL bounds remain fixed.

This entry intentionally supports unknown convenience through the existing explicit
robust comparison. STRICT configuration is rejected rather than downgraded. An
independently admitted convenience transport would be needed for a future strict
entry. No score or warning source is fabricated.

Never place credentials in arguments, Git, browser settings, CI artifacts or chat.
The package and manifest contain no private configuration. Successful output only
includes a fixed contract, outcome and allowlisted status; raw errors, request
contents, reason payloads, credentials and plan data are never printed.

## Build and safe smoke

From the repository with locked dependencies installed:

```sh
node scripts/security/generation-node-worker/build.mjs /tmp/potok-node-worker-v1
node /tmp/potok-node-worker-v1/potok-generation-worker.cjs
```

The second command stays disabled unless an operator has separately set the gate.
For a guaranteed disabled smoke, set that variable to an empty string for this
command. The standalone CommonJS bundle includes its reviewed npm dependencies;
only Node builtins remain external. It runs outside the repository without a
runtime npm install. `manifest.json` records the Node/pg pins, input graph and bundle
SHA-256. Neither file belongs in the public app `dist` directory.

After explicit approval, invocation arguments are ordered as request UUID then
private configuration path. This document deliberately does not provide a working
enabled invocation or real configuration. File paths are operator configuration,
never browser/request data.

| Outcome | Exit code | Meaning |
| --- | --- | --- |
| DISABLED | 0 | No attempt performed |
| RESPONSE / ACTIVE | 0 | Runtime returned ACTIVE |
| RESPONSE / other allowed status | 2 | Preserve actual status; no successful-generation claim or retry |
| STOPPED | 130 | Abort observed; no late successful result reported |
| FAILED | 1 | Sanitized failure; effects may be uncertain |

SIGTERM/SIGINT close the shared enabled gate and call idempotent runtime shutdown.
Abort during construction closes any subsequently returned runtime without dispatch.
All error paths await cleanup; a cleanup failure becomes FAILED. An in-flight
COMMIT can have succeeded even when its reply is lost or the process is killed:
use the existing read-only status/UNKNOWN recovery contract before a separately
authorized retry. Do not configure scheduler retries on nonzero exits.

The host supervisor must set wall/CPU/memory and hard-kill grace budgets. Node's
heap limit is not a process RSS limit; cooperative signal handling cannot interrupt
synchronous CPU work. This entry does not claim a hard process deadline. Start
with one process; every additional process multiplies pools, so the global DB role
connection budget must be reviewed before concurrency or polling is introduced.

## Validation and remaining gates

Nine host tests exercise default inactivity, private-file admission, raw-only config,
abort races, exact cleanup, uncertain statuses, fixed output and a standalone
disabled/no-config bundle smoke. Existing runtime/pool regressions are included in
the local targeted run (30 total). General CI builds and uploads the disabled
bundle and manifest as `disabled-node-generation-worker` for review, with no
deployment or hosted credentials.

Real host selection/access, secure configuration provisioning, independently
admitted runtime sources, ordinary-account Auth-to-persisted-plan acceptance,
supervisor budgets and scoped activation approval remain open. The previous Edge
TLS incompatibility is unchanged; this is an explicit Node entry, not an automatic
fallback or an Edge fix. There is no 12,000-user capacity assertion.
