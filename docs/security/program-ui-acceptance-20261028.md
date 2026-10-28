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
