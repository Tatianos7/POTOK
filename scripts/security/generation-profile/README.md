# Offline full-worker profile

This diagnostic exercises the existing managed runtime, restricted SQL gateway and transaction adapters, goal-derived preparation, weighted selection, graph construction, independent validators and record/activation **protocol**. SQL responses, catalog, warning/policy authority and accounts are explicit synthetic fixtures. No socket, real database commit, Auth session, hosted source publication or generation endpoint is created.

The fixture previously embedded in `generationSqlWeightedWorkerV1.test.ts` is shared without changing its existing defaults. Its extra slot-count parameter allows both 7-slot and 28-slot weeks. Cases are ROBUST_CONVENIENCE_BOUNDS with unknown convenience (one/four slots per day) and STRICT with an explicit synthetic known-convenience source (four slots). These are small deterministic cases, not a worst-case catalog or proof all 1024 combinations were evaluated.

## Reproduce

From the repository root, using the locked dependencies:

```sh
node --import tsx scripts/security/generation-profile/run.ts 3 > /tmp/potok-node-profile.json
node scripts/security/generation-profile/build.mjs /tmp/potok-generation-profile
```

The second command creates an ESM **diagnostic** bundle, Buffer injection and a non-deployable metadata report outside the repository. It resolves extensionless source imports, preserves/normalizes `node:` built-ins and maps the existing pinned pg 8.23.1 import to `npm:pg@8.23.1`. It does not change production source/TLS validation or produce a serving function.

The standalone Deno toolchain can be obtained transiently with `npm exec --yes --package=deno@2.1.4 -- deno --version`. This version is explicitly a local comparison target; it is not a claim about the currently deployed Supabase runtime. With the project as the current directory and its already installed node_modules:

```sh
npm exec --yes --package=deno@2.1.4 -- deno run --no-config --node-modules-dir=manual --cached-only --deny-net --deny-env --allow-read=node_modules,/tmp/potok-generation-profile /tmp/potok-generation-profile/worker-profile.mjs 3 > /tmp/potok-deno-profile.json
```

`--cached-only` and manual local npm resolution prevent remote module fetching during the diagnostic; runtime network/environment access are denied. Installing the toolchain is a separate local setup operation, not a hosted deployment. No database password is requested. Both pool-factory probes use public test trust roots, synthetic passwords and the default-disabled gate.

## What the numbers mean

- Fixture setup/signing is outside the measured interval. Runtime construction through ACTIVE and output invariants are inside it. Synthetic source/gateway response processing during continuation is included; this is not isolated production worker CPU.
- Samples run serially, with a new fixture/runtime each time. No concurrent-load or throughput conclusion is permitted.
- Node CPU is process user+system CPU, not Supabase request CPU accounting. Deno 2.1's `process.cpuUsage()` compatibility stub returns zeroes with a warning: Deno CPU is therefore **null**, never reported as zero work.
- RSS snapshots and Node's cumulative process high-water RSS are process metrics that include modules and fixture data. They are not per-request allocation or Edge isolate peak measurements. Deno's high-water value is left null.
- Samples are bounded to 1–5. All cases assert ACTIVE, seven days, expected slot counts, one record/activation, two final authority reads and zero FACTs. A profile is not a VALID/admission or activation receipt.

## Observed outcome, 3 November 2026

`observation-20261103.json` retains nine Node and nine standalone-Deno samples. The synthetic full calculation succeeds in both runtimes. The real lazy Staging pg/runtime factory passes its default-disabled construction/close probe in Node but **fails during construction in Deno 2.1.4**. A separate public-certificate capability probe identifies `crypto.X509Certificate.prototype.checkIssued` as unimplemented. The existing production CA validation calls that method and correctly fails closed. No validation was skipped to obtain a pass.

Local timing/CPU values are useful for identifying missing performance headroom, not for comparing directly to a hosted 2-second CPU limit. The large cases are only four-meal synthetic fixtures, not worst-case accepted data. No Docker/Supabase Edge Runtime execution, real hosted TLS/identity or load acceptance was completed. Source and manifest admission remain required independently.

Next: prepare an explicit compatible certificate/driver packaging approach without weakening CA/hostname/identity checks, then repeat in the actual Supabase Edge Runtime with CPU/memory enforcement. Do not deploy the Node assembly as-is or interpret successful standalone-Deno calculations as successful Edge hosting. No provider purchase, hosted write or activation occurred.
