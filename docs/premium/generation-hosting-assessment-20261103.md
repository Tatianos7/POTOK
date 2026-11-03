# Where generation will run — assessment, 3 November 2026

Status: first hosting option to verify, not deployment or performance acceptance. Reviewed source base is PR300, `3430cd0c29a9b0adafdbbccdae26704ca8f60ddc`. The owner asked whether Staging can be used and whether generation will live inside POTOK without another menu-generation service.

## Answer and proposed placement

Staging is the test environment, not a separate kind of compute. A Supabase Edge Function can belong to the existing POTOK Staging project. The same architecture can later run in the Production project after acceptance and explicit activation. Supabase is already external infrastructure; using it does not mean buying a separate ready-made generator.

For the user, generation belongs to POTOK: the app submits a request and opens the confirmed saved menu. The authoritative selection, source validation and persistence run on our backend. Restricted database passwords never belong in the APK/browser. The current algorithms do not call an external AI or menu-generation API. This does not claim fully offline mobile generation.

First investigate the existing Supabase Edge runtime. Do not introduce a new hosting vendor, external AI API or paid account based only on Node.js being used in development. Hosted acceptance still needs an explicitly scoped Staging deployment/write package; the earlier PR291 installation approval does not authorize that package.

## Compatibility findings

| Area | Current source / official platform information | Required proof before deployment |
| --- | --- | --- |
| Execution | PR300 composes Node/pg pools and worker. Supabase Edge is Deno-based and supports npm and built-in Node APIs. | Build and execute the exact dependency graph in Supabase Edge Runtime. Node tests alone do not establish this compatibility. |
| Entrypoint | Existing `adaptive-nutrition-generate-v2/index.ts` handles user request/status; its generator and validator are null. Its deno.json maps supabase-js 2.88.0, not the worker's pg dependency. | Review a separate worker dispatch/auth boundary and explicit pinned packaging. Do not pretend the existing request/status function executes selection. |
| Computation | Hosted documentation lists 2 seconds active CPU per request and 256 MB memory. Long wall-clock limits include I/O and are not a larger CPU allowance. The actual producer can evaluate many combinations and revalidate/hash plans. | Profile representative/worst permitted catalogs and budgets in the exact Edge runtime, with headroom and failure recovery. Fast authoring previews and local unit-test durations are not hosted CPU measurements. |
| Connections | Existing adapter pins direct Staging host, TLS verification and distinct narrow roles, max two connections per pool. Each role has a separately installed two-connection limit. Edge can have several instances. | Verify actual DNS/TLS and execution identity from that environment, then review the global concurrency/connection budget. Single-attempt-per-instance does not impose a project-wide limit. |
| Pooling | Official guidance recommends serverless-appropriate pooled connections/drivers. Current SQL checks actual session_user/current_user and role attributes. | Do not silently swap to a pooled hostname/driver or weaken identity checks. Any change needs exact compatibility/currentness/transaction acceptance. |
| Secrets | Supabase supports project-side function secrets. PR300 only accepts injected trusted configuration; no secret store binding exists yet. | Bind the two narrow-role passwords and approved CA server-side without displaying their values. Do not put them into VITE variables, public clients or logs. |

The latest PR300 observation remains historical evidence: Staging was ACTIVE_HEALTHY with the patch installed, no Edge functions and no source/policy heads or validation/preparation rows. This assessment does not refresh those counts or assert they cannot change.

## Concrete next sequence

1. Prepare a local Edge compatibility/profiling package for the existing worker before selecting a new provider. This workspace currently has neither Deno nor Docker available; no Edge runtime execution is claimed here. Installing/using an appropriate local toolchain is distinct from a hosted deployment.
2. Resolve packaging, CPU/memory, verified restricted SQL identity and project-wide connection limits. Keep fail-closed validation and unknown-commit recovery. Do not lower nutritional/search acceptance standards to meet a platform limit.
3. Prepare a narrowly scoped Staging canary and source-data plan with exact deployment/write operations for review. No broad activation, recipe publication, Premium grant or test-account creation is authorized by this assessment.
4. After the needed approvals, bind server-side secrets and run the canary, then the independently admitted ordinary-account request → selection → stored plan → menu scenario. Authoring previews are not admitted recipe evidence; cooking stays deferred as already decided.
5. If measured limits show Edge unsuitable, document the measurements and explain the smallest alternative execution environment, data/permissions and verified costs before connecting or buying it. No new vendor is selected now. A trusted local Node process using Staging is also a possible developer test arrangement, not always-on hosting for released users.

## Cost and data boundary

No external AI/menu API is required by this implementation. Supabase compute, function invocations, database and traffic remain subject to the actual account's plan and quotas; this assessment does not establish free operation, a tariff change or the current bill. Official function pricing is metered above applicable plan quotas. Check account usage before a hosted pilot. No new provider, secret setting, database write, deployment, Production change or generator activation occurred during this assessment.

## Official sources checked on 3 November 2026

- [Edge overview](https://supabase.com/docs/guides/functions)
- [Dependencies and Node API support](https://supabase.com/docs/guides/functions/dependencies)
- [Runtime limits](https://supabase.com/docs/guides/functions/limits)
- [CPU-limit explanation](https://supabase.com/kb/troubleshooting/edge-function-cpu-limits)
- [Serverless database drivers](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)
- [Function environment variables and secrets](https://supabase.com/docs/guides/functions/secrets)
- [Function pricing](https://supabase.com/docs/guides/functions/pricing)

These platform capabilities identify a candidate, not proof that this particular worker has passed hosted acceptance. The owner external-services notice rule remains in effect; the next concrete work is compatibility/profiling, not an unsolicited service purchase.
