# MyProgram UI gate after the owner-confirmed client/API pass

The owner confirmed `PRIVATE_PROGRAM_CLIENT_OK` in program-client-KTEgS1. Do not
repeat the earlier SDK/Storage/profile stages. This gate is actual existing Login
and MyProgram UI, not newly invented day-action buttons.

Read-only metadata on POTOK confirmed get_active_program(text) returns TABLE,
get_program_phases(uuid) returns TABLE and get_program_status(uuid) returns jsonb.
The client previously passed the active-program array through as a single object;
the screen could therefore present an existing plan as empty. The proposed client
accepts the documented array, selects exactly one active/paused row of the requested
type, and rejects malformed/ambiguous responses. Explanations use that same type.

Existing pause/resume now require an authenticated owner, one matching parent,
an unchanged account and exactly one confirmed status PATCH. They never write
protected program history/guard records. A zero-row/error response is not success.
No SQL policy, GRANT, generator activation or hosted change is proposed.

The guarded release-review packet now pins the two updated client files at source
commit 996a81c30906000b9cb6ffe88456a98b55cb692f, alongside the unchanged execution
service and Node version. The twelve SQL pins and the review-only unconditional
stop/ROLLBACK are unchanged. This updates source inventory, not hosted approval.

The bounded UI controller reuses the previously built immutable browser image.
Two hash-verified public source files are supplied in memory to Vite's loader;
database/Auth responses are not mocked, redirected to a hosted endpoint or replaced.
The historical runtime test materializes the original two files from hash-checked
public fixtures at d642823fa8486c1ee3ce0443531e881d606c7628 and verifies all original
602 runtime inputs. It also requires the old builder to reject the changed current
source tree. No historical runtime manifest, digest or production guard is weakened.
No new archive, npm install or browser rebuild is needed on the Mac. Browser traffic
is limited to loopback; the credential-free gateway permits only listed reads/RPCs
and status PATCHes bound to manifest parent/owner IDs. The worker has no database
URI, signing secret, service-role material, bind mount or Docker socket.

For the two existing synthetic OTP accounts, the browser opens the actual nutrition
program screen, sees the future fixture day, clicks Pause/Continue, reloads, verifies
the generator button remains disabled, and checks foreign parent reads are empty.
There are four button actions. Training UI and start/complete/skip UI are not claimed:
the existing screen has no such day-action buttons, and no new ones are added here.

The four-program seed is temporary. Exact cleanup compares every fixture field,
allowing only ordinary session annotations and parent active/paused status/update
timestamps. It deletes only the 24 manifest rows in dependency order. Independent
checks require fixture absence, unchanged 112 protected tables/current security,
empty authority, unchanged Storage catalog and all 63 original binaries.
Failures retain private logs and never automatically replay or broadly clean up.

The same browser bundle, seed and cleanup run on disposable Supabase in CI before
the Mac command is supplied. A green CI gate is not a Mac result. Mac success is
`PRIVATE_PROGRAM_UI_OK`; releaseReady remains false until separate hosted review,
exact owner approval and deployment/post-apply verification.

The disposable combined CI accounts already own legacy active programs. The UI CI
setup therefore creates two separate synthetic identities via ordinary captured OTP
and their ordinary profile INSERTs, before taking the preservation baseline. It does
not retire/delete legacy plans or weaken ambiguity detection. The browser then logs
into those initialized identities with real OTP. This CI-only bootstrap is absent
from the Mac controller, which admits only the original two receipt-bound accounts.

## Mac stop and bounded diagnostic revision

The first owner run `program-ui-xX8FUk` stopped under the broad
`independent-after-proof` tail. Saved before/after reports show unchanged
protected contents, security capture and Storage; the cleanup log has no SQL
error. The worker failed at `resume-0`, with unknown runtime and a gateway
404 for `workout_days`. Its container exited 1 after about 31 seconds, with
OOMKilled false and no saved page-crash, browser-closed or disk-full marker.
This does not identify whether the action, status wait or subsequent reload
failed, and it is not Mac UI acceptance. Do not replay the old worker.

The revised worker splits resume and reload into six named checkpoints and
emits only boolean error categories, page/request failure counts and bounded
PATCH counts. It never emits original exceptions, stacks, DOM, credentials
or URL queries. The existing workout-days GET dependency is forwarded through
the ordinary user's RLS-protected API; no write route or database grant is
added. All assertions and independent preservation/cleanup checks remain.
A new owner run requires the revised pinned package after CI verification;
there is no automatic retry of the stopped run.

## Auth-only reload admission after the second Mac stop

Owner run program-ui-MzDK4M passed the first owner's pause/resume (two PATCHes)
and stopped at reload-program-0. Protected contents and Storage match, with no
cleanup SQL error. A separate credential-free Chromium reload probe and a
credential-free Vite/Login/MyProgram import/reload probe both passed without
network failures. These probes do not prove authenticated UI recovery.

The new --inspect-private-program-auth-reload mode performs real OTP for only
the original two receipt-bound synthetic accounts and observes AuthProvider and
MyProgram restoration after reload. It does not seed programs, execute SQL writes,
or allow any Data API PATCH/INSERT/DELETE. The gateway rejects all parent PATCHes
in this mode. OTP/verify/logout still modify the synthetic Auth sessions; this is
not a zero-database-write claim. Before/after original content/security/Storage
checks remain mandatory. Failure retains evidence with no automatic retry.
The ordinary full program UI assertions are unchanged. Diagnostics now distinguish
probe initialization, Auth status and bounded Chromium network failure codes.
Playwright 1.40 TimeoutError inherits Error.name, so timeout recognition also checks
the bounded timeout message signature without printing the original exception.

## Observed temporary filesystem exhaustion

Owner live observation of program-auth-reload-wLVJ5q collected 18 samples:
/tmp had only 2 MiB free under its 512 MiB tmpfs cap; /dev/shm retained all
256 MiB; worker cgroup peak was about 997 MiB; VM MemAvailable remained at
least 2072 MiB; soft file limit was 1048576. The prior failed worker recorded
net::ERR_INSUFFICIENT_RESOURCES, not a confirmed authentication defect.
Host disk/idle container totals alone did not reveal this separate tmpfs cap.

Only the new private program browser worker's /tmp cap is raised to 1 GiB.
This is an upper bound, not a preallocated 1 GiB reservation. No Docker Desktop
VM setting, database volume, image, API grant or browser assertion changes.
The worker reports bounded tmpfs capacity/free-space numbers on both failure
and success, captured before closing Chromium. Reuse the immutable cached
image. First run the no-program-write Auth reload admission; full fixture UI
acceptance remains pending until its own independent checks pass.

## Read-only precheck classification after the Auth reload pass

Owner program-auth-reload-9HiE7u passed with 488 MiB temporary free space,
unchanged protected/security/Storage snapshots and no program fixture writes.
The subsequent full UI command stopped at precheck before creating an evidence
folder, fixtures or browser worker. Do not replay it or replace the baseline.
Fresh storage-precheck-review-1TdGdc shows the full Storage snapshot, catalog
and relation fields match the program-client-KTEgS1 reference, readOnly=on.

program-precheck-review.mjs classifies remaining admission conditions against
that same reference, without browser/OTP, SQL writes, grants, seed or cleanup.
It admits only the owner backup directory, exact existing isolated candidate
ID/image/local Unix Docker endpoint and the prior hash-pinned 20-file package.
Every SQL command must declare a read-only transaction; the underlying pinned
queries are unchanged. Raw evidence stays in a new owner-only local folder.
Only changed field/table names, file-validity and contract booleans are printed.
A mismatch does not authorize updating the baseline or bypassing the full gate.

## Isolated Auth metadata mismatch

Owner read-only program-precheck-review-rDmzEe found original files valid, no
protected table/content or account-ID changes, no security capture changes,
no failed permission checks and passing final contracts. Only authMetadata
(the full raw pg_class/pg_attribute/pg_proc hash) differs. This is not yet
proof of a schema/security change or permission to bypass the guard.

program-auth-metadata-review.mjs compares the candidate with the saved original
logical Auth definition query from private-auth.mjs (unchanged 7b0cac6c pin),
and reads the original preserved local database's full raw Auth catalog. It
reports whether that raw catalog exactly matches the recorded client reference
hash before using it to identify differing categories/fields. If it does not
match, the tool cannot establish an exact raw reference and does not bless one.
Raw evidence remains private; no snapshots are replaced, SQL writes executed,
browser started, OTP sent, migrations or metadata corrections applied.

PostgreSQL 17 documents relpages/reltuples/relallvisible as planner estimates
updated by VACUUM/ANALYZE, and relfrozenxid/relminmxid as maintenance state:
https://www.postgresql.org/docs/17/catalog-pg-class.html . These are possible
sources of drift, not assumed explanations until the exact local comparison.
The diagnostic reports security and definition differences equally and performs
no exclusion or normalization of catalog fields.

The first Auth metadata reader stopped at original-read. Its query incorrectly
used the candidate's /tmp socket for both databases. The original CLI database
uses /run/postgresql (also shown by the original owner's successful default-socket
psql sessions). The revised reader binds each inspected fixed container to its
known Unix socket, passes that socket as a positional shell argument and rejects
other IDs. There is no TCP/alternate-socket fallback or database change. A regression
test covers both socket routes and target rejection; the metadata SQL is unchanged.


## Reviewed Auth continuity admission (2026-10-29)

Owner auth-metadata-review-XVMqYO reports no logical category changes against
saved pre-Auth-install definitions, no added/removed objects, unchanged complete
raw columns/routines, and only relpages/reltuples differences between the two
local databases. Neither current raw hash matches the old client hash. Therefore
this does NOT establish which raw fields changed historically from that hash;
no old snapshot is edited, rehashed or claimed to match.

An explicit fourth CLI argument admits that exact reviewed local evidence folder.
The ordinary three-argument guard remains unchanged. The reviewed mode requires
all six saved install-time logical Auth categories to match independently in the
reviewed candidate, original and fresh live observation. Complete raw catalog
objects must agree between reviewed original/candidate/live except ONLY relpages
and reltuples, the observed planner estimates documented by PostgreSQL 17. Other
maintenance fields (including relallvisible/relfrozenxid/relminmxid), physical file
identity, grants, owner, RLS, columns and function properties remain exact.
The live raw hash must match the separately captured protected snapshot; a race
stops admission. All non-Auth-hash protected fields and the existing security
capture guard are checked unchanged against program-client-KTEgS1 and again
before/after the test. Evidence records the historical hashes and detailed raw
observations, plus the exact two exclusions; there is no blanket metadata waiver.

First use --inspect-reviewed-program-precheck BASE PROGRAM_CLIENT REVIEW_DIR:
read-only contracts/content/files/Auth checks, no browser/OTP/fixture/SQL writes.
Only after this result passes can the same explicit reviewed admission be used
with --run-private-program-ui. That gate still must pass actual browser actions,
exact cleanup and independent postchecks. Production is untouched; full Mac UI
acceptance and release remain pending. Tests reject changed definitions/ACLs/RLS,
functions, object additions/removals, all other raw fields, unrelated rows/account
IDs/security, write-mode/superuser observations and mismatched raw captures.


### Expected authority FK triggers across the installation boundary

The first reviewed precheck stopped. Owner offline comparisons confirm the
candidate matches every saved logical category; the original differs only in
triggers: candidate-only=2, original-only=0, changed-existing=0. Both additions
are enabled RI triggers from the pinned authority account FK on auth.users,
referencing potok_control.access_attestations. That FK is declared in
trusted_authority_id_user_review_v1.sql (pinned f542e543 source / 8447c555 digest).
The original copy predates its installation; requiring equal trigger sets across
that boundary was a diagnostic error.

Only the comparison with the pre-install original now accepts this exact delta:
all original trigger OIDs/definitions/enabled states remain exact; precisely two
installed additions must have PostgreSQL RI names, enabled O, canonical full DDL
for AFTER DELETE/restrict_del and AFTER UPDATE/noaction_upd, that exact parent and
referencing table, immediate/nondeferrable row execution and no extra clause.
Every other logical category is exact. Reviewed candidate and fresh live metadata
must still match the saved installed baseline INCLUDING both triggers. Unknown,
disabled, changed, extra, duplicate or missing triggers fail. The controller now
prints a bounded Auth checkpoint on failure without private assertion details.
No SQL, application source, database trigger or saved baseline is changed.


### PostgreSQL OID JSON representation

The corrected owner precheck stopped at precheck-auth-original-trigger-rows.
The reader incorrectly required a JavaScript integer for the trigger OID, although
PostgreSQL can encode oid as decimal JSON text. The trigger identity reader now
accepts canonical decimal string or integer tokens in the positive unsigned
32-bit OID range, normalizes map keys only, rejects malformed/out-of-range IDs
and detects string/number duplicate identities. Full trigger rows/DDL/enabled
states still compare exactly. No metadata values or snapshots are rewritten.

Regression tests cover PostgreSQL-shaped string IDs and malformed/boundary/
duplicate identities. A separate disposable CI integration reads the unchanged
metadata query from actual PostgreSQL after the pinned authority installation,
requires its real oid strings and pg_get_triggerdef output to pass, and rejects
altered/disabled/different-table trigger fixtures. It uses only a read-only SQL
transaction and simulates the pre-install trigger-set delta in memory, never
claiming to recreate private owner evidence. Native success is required before
giving the owner another revised precheck command.

## Owner Mac acceptance — 29 October 2026

The native PG JSON/trigger check and all seven workflows on exact head 8706594
passed. Owner program-reviewed-precheck-ZYv4ss then returned
PROGRAM_REVIEWED_AUTH_PRECHECK_OK with all 22 package hashes valid.
The full owner program-ui-izBBNW returned PROGRAM_UI_TMP_FREE_MIB: 478 and
PRIVATE_PROGRAM_UI_OK: actual Login/MyProgram with two existing OTP users,
owned nutrition rendering, four pause/resume button actions and reload, foreign
read denied, generator disabled, exact fixture cleanup and original data/security
preserved. This closes the bounded Mac nutrition-program UI gate; do not replay
it. Training/day-action UI, whole-product acceptance and hosted release are not
claimed. Remaining release/recovery work and preserved related receipts are in
local-acceptance-checkpoint-20261029.md. No hosted mutation or release approval.
