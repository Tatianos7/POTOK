# Local official Edge Runtime: full worker, driver and resource canary

This continues PR #303's isolated CA check. It does not deploy a function, change
Staging, admit sources, turn on the generator or establish hosted acceptance.

## Separate evidence

The new `generation-edge-worker.yml` runs the official Edge Runtime v1.77.9 image,
pinned by the same multiarch digest as the CA canary. Its main service only routes
five fixed diagnostic paths. Each request creates a fresh **user worker**, with
256 MB memory, 150 s wall time and 2,000 ms soft/hard CPU limits. No credentials or
host environment variables are passed into the user workers. All npm code is
bundled from `npm ci`, including the pinned pg 8.23.1 dependency; workers need no
runtime module downloads. These CI-only bundles are not deployable app artifacts.

1. `pg`: real disposable PostgreSQL 17 with an ephemeral signed TLS certificate,
   two synthetic login roles and connection limit 2. The actual pg driver and
   `adaptGenerationNodePgPoolV1` connect, bind the extended query protocol, verify
   `current_user == session_user == requested role` and inspect the connection's
   SSL flag. Both roles must succeed with valid TLS and reject wrong CA, wrong
   server name and wrong password. Public roots pass the portable CA validator.
   The local host configuration is intentionally separate from the fixed Staging
   factory; this does not verify Staging passwords, CA provenance or grants.
2. `small`, `robust`, `strict`: one full managed-worker protocol run per isolate,
   with the shared synthetic SQL fixture, producing 7 or 28 planned meals. It
   retains weighted selection, graph building, validation, final-authority reads,
   record/activate protocol and output assertions. SQL adapters are synthetic:
   their record/activate calls do not create real database rows. Facts remain empty.
3. `cpu`: a deliberately CPU-bound negative control must be cancelled. A response
   code alone is insufficient: the checker also requires a resource-limit event
   in the runtime logs. Computation cases may honestly report resource cancellation;
   a green diagnostic CI job does **not** mean every generation case completed.
   Unexpected crashes and failed TLS checks fail CI rather than becoming a limit result.

Resource limits cover module load and fixture setup as well as the request.
Profiler timings still exclude fixture setup, and its `cloudLimitsEnforced:false`
field remains accurate: the outer canary separately records **local** user-worker
limits. Deno CPU and peak RSS measurements remain null. Process RSS is not isolate
memory. Local user-worker limits do not prove parity with hosted CPU accounting.

The exported profiler now lives in `profile.ts`; `run.ts` remains its compatible
CLI/re-export. This prevents an imported diagnostic handler from accidentally
executing the CLI's three-case run on module load. Default Node/offline profiling
behavior is unchanged; optional case selection and skipped factory probes are explicit.

## Reproduce

Run the GitHub Actions workflow on this branch. It creates and removes only its
named diagnostic containers/network. Private test TLS keys stay in runner-temporary
files and are never uploaded. Only the synthetic JSON observation is an artifact.

Source for the user-worker API and limits options:
https://github.com/supabase/edge-runtime/blob/v1.77.9/examples/main/index.ts

Remaining gates: actual hosted connection/role admission, reviewed runtime inputs,
catalog worst-case compute, ordinary-account Auth-to-persistence-to-UI acceptance,
global pool budgets, load testing and explicit activation approval. This experiment
provides no capacity claim for 12,000 users.

CI observations will be recorded after the actual run.
