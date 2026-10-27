# Application acceptance after real private A/B OTP

## Confirmed owner checkpoint

On 27 October the owner verified all ten pinned files from #215 at `9cbc8af5cdfbecdcdb31adee599810dd152a15ee` and supplied `PRIVATE_AB_ORIGINAL_ROWS_OK` / `PRIVATE_AUTH_AB_OK`. Real OTP for two synthetic users, own profile access, foreign access denial and protected-write denial passed on the full isolated twelve-candidate copy. All 14888 original rows and Auth schema were preserved. This is owner terminal evidence, not direct access to the Mac. No private evidence was uploaded. Keep the private `private-auth-ab-*` state/result/original-row-hashes files on that machine; do not request tokens or copied original data in chat.

The new Auth remains on shared loopback 13002, API on 33001. The previous Auth is stopped and retained; the SMTP/template worker has exited. Any future browser login must supply the narrow synthetic-recipient capture again. Do not rerun installation, wipe Auth or use the old exact-14888 checker against intentionally added test records.

## Current browser regression

`combined-api/profile-recovery.mjs` extends the existing real Login/Profile/AuthProvider/profileService browser run. It does not mock profileService, Auth or PostgREST. It requires the already authenticated A/B browser fixture, uses the current B session, and adds no users or authority grants:

| Scenario | Required evidence |
| --- | --- |
| B pending queue incorrectly names A | No profile mutation, B remote first name unchanged, mismatched queue retained |
| Legacy B queue contains ordinary fields plus privilege/provenance/timestamps | Ordinary first name/height persisted by real API; HTTP body contains only id_user/first_name/height; protected fields excluded |
| Quarantine | Names only, exact owner B and requires_trusted_authority status; no provenance value |
| Forged offline cached is_admin/has_premium | Actual getProfile returns both false |
| Old privilege setter methods | Explicit ProfilePrivilegeWriteBlockedError |
| Reload on B | Same B authenticated, actual AuthProvider false admin/Premium; ordinary changes still remote |
| Existing A offline edit | Exact serialized queue unchanged throughout B recovery |

The fixed isolated synthetic workflow already applies later paywall/projection/history/quarantine follow-ups before browser execution. It remains a deliberately synthetic schema and cannot be relabelled full restored UI acceptance. No request body, JWT, OTP or user row is logged by the new helper. The result marker is `PROFILE_RECOVERY_BROWSER_OK`; whole-run success still requires the existing final browser marker and database verifier. CI must pass before claiming these assertions succeeded.

## Full-copy browser preparation and remaining gates

The next concrete package is `private-browser-package-20261027.md`: separate public runtime preparation and one-shot fixed-target full-copy profile browser controller. It reuses captured A/B identities and the pre-A/B original row multiset. Package preparation/CI alone do not imply owner execution. Do not repeat prior installers or publish private evidence.

The #216 exact-head browser run passed legacy recovery, account isolation and fail-closed cached privileges on its synthetic schema, alongside production build and root regressions. The next transport implementation is documented in `private-browser-gateway-20261027.md`: a narrow fixed-loopback gateway used by the same real application browser harness. It is not yet an owner browser launcher and does not change the full-copy pending status below.

The owner can pause Mac work now. Preparation and source/CI review run without their terminal; full-copy execution requires that Docker machine again (or its existing remote desktop). This work does not expose its isolated database/API on host or public ports.

The next implementation must provide an exact-source application harness and browser inside an isolated execution boundary. The actual client expects `/auth/v1` and `/rest/v1` on one base URL, while the copied services use separate loopback ports. A reviewed local gateway must allow only these two paths to captured loopback targets; unknown paths/upstreams fail closed. The browser must receive an ordinary client key only, never authenticator credentials or a signing secret. Dependencies/browser runtime must be pinned and validated before access to copied data; repo env files and production URLs must not be loaded. The public app bundle must be reviewed for hosted URL fallbacks and all browser network requests restricted to the local gateway/harness. No Docker socket or database volume belongs in the browser container.

Reuse the two exact successful A/B IDs from private state, not arbitrary real accounts. Fresh OTP must come from actual Auth via a capture allowing only these addresses; tokens remain memory-only. Keep the issuer inactive/authority empty in full-copy tests. The existing CI-only admin grant/revoke commands are prohibited on the copied database.

Full-copy postconditions must reuse the original row multiset reference from #215 (not a new baseline that accepts prior tampering), unchanged Auth metadata and exact final twelve security/source contracts. Test mutations must be limited to the captured synthetic IDs/related records; report which synthetic profiles/rows are intentionally mutable. Any added diary/photo/program data needs an explicit identity-scoped manifest and narrowly extended preservation proof, not blanket exemptions. Existing owner rows and stored files remain unchanged.

Remaining acceptance matrix:

1. Actual Login/Profile/AuthProvider/profileService: profile/avatar persistence, refresh, offline recovery, forged cached privileges and account isolation on the full copy.
2. Diary/photo/catalog ordinary operations and owned/foreign access with exact existing schema; photo metadata success is not proof that original Storage binaries are served correctly. A Storage service is not running in this private stack yet.
3. Program summary/owned reads, execution status/reason and explicit unsupported legacy creation behavior; no plan consumption inference (`PLAN != FACT`). Trusted generator and Edge stay off.
4. Exact release/client diff, fresh target read-only drift, managed extension/default/exposure boundary, privately verified recovery and a reviewed forward migration.
5. Exact owner approval of the hosted batch/window, then committed-state checks after the authorized deployment.

These are remaining outcomes, not an assertion that five more terminal commands suffice. No full-application pass, hosted change, release approval or fireworks milestone is claimed. After the agreed security milestone: fireworks, meal-plan generation, then provider receipt verification #198.
