# Private Auth serve readiness

This is a bounded continuation of owner-confirmed PRIVATE_API_READY_OK in #213. It starts Auth v2.197.0 explicitly with the serve subcommand and checks health, unchanged original rows and unchanged Auth schema definitions. It does not create or sign in users, send mail, run OTP/A-B ownership tests, verify the full UI, issue authority or approve a hosted release. An absent custom auth.users trigger is not treated as a defect; the checked-in profileService ensures a missing profile via its own API insert path.

## Exact upstream behavior reviewed

Read v2.197.0 cmd/root_cmd.go, cmd/serve_cmd.go, cmd/migrate_cmd.go, internal/storage/dial.go, internal/api/apiworker/apiworker.go and internal/conf/configuration.go from the official supabase/auth repository. Root runs migrate followed by serve; the explicit serve command enters the server routine without calling migrate. Storage dialing opens a connection rather than migrating. Background index creation is separately conditional; its two controls are explicitly disabled here. Cleanup and template-refresh controls are also disabled. No root/default or migrate invocation is allowed in the prepared runtime command.

Sources: https://github.com/supabase/auth/blob/v2.197.0/cmd/root_cmd.go ; https://github.com/supabase/auth/blob/v2.197.0/cmd/serve_cmd.go ; https://github.com/supabase/auth/blob/v2.197.0/internal/api/apiworker/apiworker.go ; https://github.com/supabase/auth/blob/v2.197.0/internal/conf/configuration.go .

## Private runtime contract

The explicit flag is --start-private-auth, fixed container potok_private_auth_2026-10-27. It requires the same fixed candidate/baseline/volume/image checks and network none as #212, the existing healthy isolated API identity/state from #213, the original three backup checksums and all six unchanged portable dependency hashes. It reuses the successful twelve-candidate receipt and original-row fingerprint verifier before and after startup. Auth tables/columns/defaults/indexes/constraints/function bodies and ACLs/triggers are separately snapshotted and compared locally. This is not a claim about every cluster catalog or all future Auth operations.

Auth connects as supabase_auth_admin and shares only the fresh local API JWT key. It never uses a hosted token, original backup JWT key or postgres/superuser connection for the Auth server. The inspected API env must exactly match the private saved env before reuse. Credential-bearing inspect output is suppressed in logs. Original SQL verification still runs read-only as the nonsuperuser postgres owner channel.

The Auth server shares the captured candidate network namespace without mounts or published ports. Its read-only root filesystem and dropped capabilities match the API transport model. Both API_HOST and port settings bind to shared loopback. Email delivery points only at loopback port 11025; no SMTP receiver or mail test is started by this step. Email autoconfirm, phone, external password lookup, telemetry, cleanup, index creation and background template refresh are disabled. Signups remain configured for the later synthetic test but are inaccessible outside the private namespace. Auth namespace/migrations are neither replaced nor initialized artificially on the owner copy.

Private-auth-* evidence (0700 / files 0600) contains local auth.env with credential/JWT material, state.json with captured IDs/API-folder reference, an Auth metadata baseline and redacted operation logs. Do not upload or paste that folder/env/metadata. HTTP body/version is checked inside the temporary credential-free Node probe; only technical markers are printed. PRIVATE_AUTH_READY_OK requires the exact v2.197.0 health response, live serve-command/isolation/env checks, unchanged Auth metadata, complete original-row/final-security-contract checks and API readiness afterwards.

On PRIVATE_AUTH_STOPPED do not retry. Auth/evidence remain isolated for diagnosis. Stopping after a failed post-check is not proof that no change occurred; consult the private comparison and preserve the unchanged baseline/backup. The script never alters or deletes either database volume. It does not contact Production or Staging.

## Validation

Six local unit cases cover fixed role/URI/key binding, loopback delivery, disabled background writes/telemetry, the explicit serve argument, running-container substitution and exact-version health with private response suppression. The Docker transport fixture now starts a real Auth v2.197.0 against a deliberately incomplete synthetic auth schema with a sentinel migration record. Health must succeed and all schema definitions plus the sentinel must stay unchanged: a default-root migration invocation would fail this check. This proves serve transport behavior without claiming real OTP/schema/application compatibility. Wait for exact-head native transport CI before issuing the owner command.

Next gate remains local-only OTP capture, two synthetic users, actual profile creation/own/foreign/protected-field checks and original-data preservation/controlled test cleanup. No acceptance is inferred from a health response alone. Payment verification stays #198 after meal-plan generation, and generation/Edge activation stays off.
