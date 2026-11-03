# Local official Edge Runtime: full worker, driver and resource canary

This continues PR #303's isolated CA check. It does not deploy a function, change
Staging, admit sources, turn on the generator or establish hosted acceptance.

## Separate evidence

The new `generation-edge-worker.yml` runs the official Edge Runtime v1.77.9 image,
pinned by the same multiarch digest as the CA canary. Its main service only routes
five fixed diagnostic paths. Each request creates a fresh **user worker**, with
256 MB memory, 150 s wall time and 2,000 ms soft/hard CPU limits. No hosted credentials or
host environment variables are passed into the user workers. All npm code is
bundled from `npm ci`, including the pinned pg 8.23.1 dependency; workers need no
runtime module downloads. These CI-only bundles are not deployable app artifacts.

1. `pg`: real disposable PostgreSQL 17 with an ephemeral signed TLS certificate,
   two synthetic login roles and connection limit 2. The actual pg driver and
   `adaptGenerationNodePgPoolV1` connect, bind the extended query protocol, verify
   `current_user == session_user == requested role` and inspect the connection's
   SSL flag. Both roles must succeed with valid TLS and reject wrong CA, wrong
   server name and wrong password. Test roots pass the portable CA validator.
   The exact bundled TLS fixture must first pass all eight checks in Node. Negative
   cases require the expected CA/name/authentication failure reason; an unrelated
   driver crash does not count as successful protection.
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

## Observed result: compatibility blocked

Evidence: workflow run [41635439760](https://github.com/Tatianos7/POTOK/actions/runs/41635439760),
job 125915333476, tested commit `39e513d383928c49a50813f29b1f90dc98329383`.
The synthetic observation is committed in
`generation-edge-worker-observation-20261103.json` beside this document.

| Check | Result |
| --- | --- |
| Node: same pg bundle, database, CA and both roles | All eight positive/negative checks pass |
| Edge: valid pg connection, both roles | Fails during acquire with `TypeError: Cannot read properties of undefined (reading '0')` |
| Edge: wrong CA / wrong DNS name | Both rejected for the correct TLS reason, for both roles |
| Edge: wrong password | Not established: the same earlier driver failure prevents the expected PostgreSQL `28P01` response |
| Small generation: 7 meals | Completes under local limits; measured worker interval about 669 ms wall time |
| Robust generation: 28 meals | CPU hard-limit cancellation; no successful output |
| Strict generation: 28 meals | CPU hard-limit cancellation; no successful output |
| Deliberate CPU negative control | Cancelled with CPU-limit log evidence |

The pg failure's internal cause is not yet isolated. It must not be labelled a
certificate-validation failure or a proven SCRAM defect from this evidence alone.
The Node baseline rules out a shared broken certificate/role fixture. Its success
does not prove hosted Staging admission either.

The **full Edge canary remains failing**, deliberately: positive database connection
is a required compatibility gate. The diagnostic does not turn that failure green
or weaken channel binding, TLS checks or worker limits. Separate CA CI and the
PostgreSQL admission workflow pass on the tested commit. Four profile tests,
targeted lint, TypeScript, production build/postbuild and an offline bundled Deno
smoke with Node globals removed pass locally. Existing general build warnings remain.

Next work is to isolate the pg/Edge acquire incompatibility and reduce/bound full
worker CPU, or prepare a separately reviewed Node worker path on existing hosting.
There is no basis yet to deploy this worker as a hosted Edge generator.
