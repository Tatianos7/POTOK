# Private full-copy API transport

This is the next bounded step after the owner-provided PRIVATE_CANDIDATE_COMMITTED_OK for #212. It starts only PostgREST and performs anonymous readiness/schema-boundary checks. It does not yet start Auth, create accounts, test A/B ownership, run application UI, issue authority, verify payments or approve a hosted release.

## Design

`scripts/security/accumulated/private-api.mjs --start-private-api` accepts no arbitrary URL or target. Run from the original owner backup folder with all five dependency hashes checked and the pinned read-only platform-boundary SQL beside the script. It reuses #212's strict target/image/volume/isolation checks. The successfully committed private installation receipt must be unique and match the twelve public inputs. All original rows, final rights/source contracts and empty authority are verified read-only before and after API startup. Runtime data-directory/listen-address/cron guards must still match. Original files/container remain unchanged.

The fixed API container `potok_private_rest_2026-10-27` shares the captured candidate's existing network namespace using `--network container:<full-id>`. The database retains network none; no network is created or attached. Both database and API bind only their shared loopback. The API gets no volume mounts, no published ports, a read-only root filesystem, dropped capabilities and no-new-privileges. It cannot connect to the host or internet. The temporary Node HTTP probe uses the same namespace without mounts or credentials. No source Docker socket is mounted anywhere.

Images are fixed tags PostgREST 16.5 and official Node 24.22.1-alpine3.23, then captured immutable local image IDs. The owner confirmed both binaries and arm64 images. Main supports this observed arm64 environment only. The actual executable is read from image configuration; passing --version as the executable is forbidden. Public image metadata/IDs are not credential material.

PostgREST connects as authenticator, never postgres or supabase_admin. Owner's read-only TCP probes confirmed authenticator and supabase_auth_admin can connect and have neither superuser nor BYPASSRLS. The captured candidate password is URI-encoded in memory, and a fresh independent random JWT key is generated. The API exposes only public; database-config overrides/pre-request hooks and notification listening are disabled explicitly for this bounded transport probe. This configuration is not proof of hosted configuration parity.

The script stores api.env (credentials and fresh JWT key), non-secret state.json, and operation logs in a new private-api-* directory under the private backup (0700 directory / 0600 files). Never upload this folder to GitHub/chat or paste api.env. Credential-read output and all inspect JSON (which may include Env) are redacted before log writes. Only technical success/phase markers reach the terminal. No private HTTP response body, OpenAPI schema or row data is printed.

The Node probe waits for HTTP readiness and requires extensions and potok_delivery requests to return 406/PGRST106. It checks actual responses, not only environment strings. A failed attempt leaves the isolated API/evidence available for diagnosis, but does not claim success. Do not repeat blindly; the fixed-name guard stops duplicate startup. This step does not drop or stop any owner database/volume. After HTTP success the full read-only committed verifier runs again before PRIVATE_API_READY_OK.

## Validation and limits

Seven unit checks cover URI encoding and fixed roles/settings, exact namespace/executable command assembly, post-start substitution/port/mount rejection, success markers without response metadata, unexpected exposure, wrong 406 error and redacted sensitive operations. A CI-only synthetic PG17 container is created with network none; real PostgREST 16.5 and Node share its namespace for the same HTTP probe. The transport fixture cannot target an owner database, requires GITHUB_ACTIONS and numeric run ID, and removes only its captured disposable containers/volume. It does not claim twelve-candidate/full-copy app acceptance. Native transport CI must pass on the exact published head before the owner receives the startup command.

Next: reviewed Auth setup with private local mail capture, two synthetic users, real token validation and owner/foreign profile/data tests. The current API has a new key, so old backup/hosted JWTs cannot be used. Full browser acceptance needs a separately reviewed local access path; do not add host ports or attach bridge networking casually. Hosted Production/Staging remain untouched. Generator/payment activation remains off.

Primary references: https://docs.docker.com/engine/network/#container-networks ; https://github.com/PostgREST/postgrest/releases/tag/v16.5 ; https://hub.docker.com/_/node .
