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
