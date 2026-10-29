# Production installation evidence — 2026-10-29

## Owner authorization and backup
The owner explicitly authorized permanent installation and compatible client publication in the conversation after reporting encrypted cloud roundtrip verification:
POTOK_BACKUP_2026-10-29.tar.gz.age: OK
CLOUD_BACKUP_ROUNDTRIP_OK
Earlier owner-reported local decryption, cmp and gzip validation remains applicable. No passwords or backup contents retained here.

## Fixed source and execution
Project: dtsdnhbcwpbfrhcazqkb (POTOK), independently resolved ACTIVE_HEALTHY.
Source: 9a09dffad6da34882788dd0539aad4197e3e1eaf.
Forward SHA256 independently reproduced: 90744f3efe8781c0f57723b667577d6c19262e7fb1256e2502ef9ea7e4e05124.
Fresh exact baseline readonly file completed successfully before apply.
Exact target-twelve-forward.pending-approval.sql submitted ONCE through project-bound execute_sql; response successful with empty result. No replay, no apply_migration wrapper, no generated activation or entitlement issuance.
Independent exact postcommit readonly file completed and returned:
- status TARGET_TWELVE_COMMITTED_CONTRACTS_OK
- readOnly on
- observedAt 2026-10-29T17:47:50.624965+00:00
- publicTables 81
- authorityRows 0
- publicMetadataSha256 3afbd6f002aedf5f38b8ad34c517d4f302128b4cca59bea285a061e493becc0b
- clientPublished false, httpAcceptance false, releaseReady false

This timestamp is the independent observation, not a claimed exact COMMIT timestamp.
Selected installed contracts passed; no fresh postcommit all-row digest proof is claimed.

Additional readonly verification: pg_trgm schema extensions; extensions.similarity('potok','potok') = 1; waiting lock sessions = 0.

## Limited HTTP observations
Using only the project's enabled publishable key, without user authentication:
- GET /auth/v1/settings: 200.
- GET /rest/v1/foods?select=id&limit=0: 401 / 42501. Independently verified anon SELECT false, authenticated SELECT true; no anonymous food rows exposed.
- GET table endpoints with Accept-Profile potok_control, potok_nutrition, potok_delivery: each 406 / PGRST106 (schemas not exposed).

These are limited external boundary checks, not authenticated application acceptance.
Security advisor output remains nonempty: eight mutable search_path warnings, six authenticated SECURITY DEFINER warnings, leaked password protection warning, one no-policy info for the deliberately private access_attestations table. Do not claim zero advisor warnings or change unrelated contracts automatically.

## Compatible client: still pending
Release ref security/client-release-candidate-20261029 independently still points to 1976b330111a802942af7e29161050e316990f99.
Existing exact CI 40876404381 confirmed success; release CI 40876404620 was previously accepted.
Before apply GitHub Actions in_progress and queued counts both zero.
GitHub connector exposes no new workflow_dispatch action; CLI GitHub credentials absent. No client workflow submitted this turn.
Continue via the existing client-publication-runbook-20261029.md. Independently recheck ref and competing runs immediately before one dispatch. Do not merge the draft chain into master or move the release ref.
After deployment: verify build and deploy success, exact SHA and URL, then owner existing-account checks for profile, diary/photos and My Program. No generator, Edge activation, purchases or mass test data.
The overall security milestone is NOT yet closed.
