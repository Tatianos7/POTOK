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

The bounded UI controller reuses the previously built immutable browser image.
Two hash-verified public source files are supplied in memory to Vite's loader;
database/Auth responses are not mocked, redirected to a hosted endpoint or replaced.
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
