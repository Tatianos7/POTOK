# Eight committed candidates: actual API and application acceptance

This review adds one fixed disposable Supabase CLI 2.122.0 environment for the entire eight-candidate order pinned in `scripts/security/accumulated/inputs.mjs`. It is not Production/Staging or the owner's restored database. No hosted data, snapshots, keys or private backup is part of the fixture. The existing owner sequence and deferred payment issue #198 remain unchanged.

## One installation, then real clients

After fresh loopback-only Auth/Mailpit/PostgREST startup, two synthetic accounts sign in with real email OTP. Historical photo migrations are replayed with automatic grants absent. Synthetic 17-column profile, food/diary tables and complete public catalog/review and finance sources establish the legacy baseline. Broad legacy grants deliberately exclude photos, preserving the explicit photo-column contract. `rls_auto_enable()` is a harmless void stub, not real event-trigger behavior; normalization/base food/diary shapes are synthetic.

The complete pinned order is applied once in a single transaction as the existing nonsuperuser postgres owner channel: TRUNCATE, profile, anonymous RPC, photos, finance, empty id_user authority, catalog/history, pg_trgm. Final effective permissions, six authority/gate source contracts, empty authority and unchanged initial profile/diary rows are verified before COMMIT. The existing GIN index and extension relocation are checked again on later connections. This runs against the actual local Supabase image/mechanisms, unlike ordinary PostgreSQL fixtures that assign extension ownership to their test operator. It still does not prove hosted platform parity or permission for Production DDL.

## API/service coverage

Actual OTP/Auth getUser/PostgREST calls and the actual transpiled `AdminAccessService` check own/default finance and paywall reads, foreign entitlement denial, client finance writes/deletes and purchase RPC denial, service-role entitlement denial, preserved server purchase-event behavior without an upgrade, photo/deletion-marker repeated upsert and narrow column rights, profile/settings persistence, protected fields and foreign profile privacy. Owner-SQL issuance then exercises actual alias/missing-food RPCs for a verified admin whose stored flag remains false; legacy true flags do not authorize. Personal food/alias privacy and publication restrictions, retired history RPC denial (including service role), same-token revocation and complete unchanged diary rows are checked. Only this local server test receives the ephemeral service key; it is not passed to Vite/browser.

## Actual browser coverage

Playwright loads the existing Login, Profile, AuthProvider, profileService and Supabase client through an isolated Vite entry. Repository env files and Vite config are not loaded; only local URL/anon key enter the browser. Browser traffic is restricted to the two exact loopback origins and data URLs. No screenshots, traces, OTPs or tokens are uploaded.

Two additional synthetic accounts use actual email-code controls and automatic profile creation. Tests cover protected-write denial, food search after extension relocation, ordinary save, avatar file selection/persistence/reload, refresh, offline pending save/reconnect, A-to-B queued-profile isolation and foreign access denial. Issuing/revoking admin for B through the local owner channel changes the actual AuthProvider state after reload while the stored flag stays false, Premium stays false and the JWT digest is unchanged. Fresh SQL checks final effective permissions, six function contracts, four attestation events, four accounts, unchanged baseline diary values and GIN validity.

## Evidence and limits

CI must pass and its exact HEAD be recorded before claiming API or browser acceptance. Success markers are `EIGHT_COMBINED_API_OK`, `EIGHT_COMBINED_BROWSER_OK` and `EIGHT_LOCAL_VERIFY_APP_OK`. The underlying eight pinned review SQL files are unchanged.

This is one combined synthetic API/UI environment, not a full 112-table restoration, binary Storage upload, whole application journey, complete legacy Premium feature-gate audit, payment verification, provenance/retention/erasure acceptance or release approval. Persistent full restored-schema/application acceptance, hosted drift/platform execution evidence, fresh recovery and exact owner approval remain. The setup helper is CI-only and accepts neither a hosted URL/project nor an arbitrary Docker container. It never installs the generator or issues real authority.
