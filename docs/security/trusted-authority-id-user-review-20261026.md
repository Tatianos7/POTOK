# Trusted authority with the unchanged id_user profile

Review candidate only; no hosted installation or authority issuance is authorized by this document. The SQL always ROLLBACKs. Owner order remains security completion → fireworks → meal-plan generation → real purchase verification (#198). This work adds no payment provider, plan generator or runtime activation.

## Adaptation of the existing model

`trusted_authority_id_user_review_v1.sql` reuses the existing trusted v2 attestation table, its constraints/indexes/append-only triggers and all three reader bodies. It reuses the later shared-account gate helper and grant/revoke writers, adapting the latter to require an existing `user_profiles.id_user` row under KEY SHARE without updating it. Protected NULL capability input is explicitly rejected. Capability lineage locking, owner-SQL session restriction, statement clock, expiry/evidence/reason checks, signatures and immutable successors remain. The shared account gate is acquired before the profile and capability locks. Contention that makes an issued timestamp older than the preceding lineage head fails closed through the existing validator; do not blindly retry an ambiguous commit.

There are no new profile columns, triggers, grants, policies, row writes or legacy projections. All 17 fields, including coach/voice settings and the id_user key, retain their contract. Existing true/false has_premium/is_admin values are not evidence and are not copied into the ledger. Installation produces zero attestations; an actual administrator list/provenance and each later issuance need separate owner decisions. A grant/revoke changes only the private append-only ledger. Authoritative UI access must use the existing `AdminAccessService`/verified predicate, not raw legacy flags.

This is the existing v2 authority contract adapted to a different profile, not a second grant store. Legacy `entitlements`/paywall DTOs and other feature gates are not synchronized or replaced here. Broader Premium UI/catalog authorization and erasure/retention remain separate integration gates; do not infer universal Premium enforcement or paid access from these tests. The auth.users ON DELETE RESTRICT contract is retained: account erasure needs an explicit reviewed boundary and must not silently delete audit lineage.

## Preconditions and ordering

Fresh installation only: existing nonsuperuser postgres owner SQL channel with BYPASSRLS; PG17; exact 17-column id_user profile with false protected defaults, owner/RLS, UUID primary key and three self policies; profile column containment #190 already applied and ordinary column access present. Both private namespaces must be absent, as must the public verified predicates. This is not a Staging repair or an updater of already deployed authority. Existing infrastructure causes an atomic stop. No role creation, membership or attributes are changed by the candidate. Fixture bootstrap roles are disposable test setup only.

The fresh `potok_nutrition` namespace contains only the unchanged shared-account gate helper. No Graph tables, generation functions or activation is installed. Its existence means that the old full Graph activation draft cannot later be replayed verbatim; generation work must prepare a compatible forward package preserving this exact helper and writer bindings. Do not remove it to make an old preflight green.

Proposed release order extends #199: TRUNCATE/profile/anonymous/photo/finance containment, then this authority component, then the catalog candidate, with separately verified pg_trgm platform execution. This new combination is not yet the pinned seven-candidate acceptance. The isolated lifecycle/API tests below do not replace a full restored-schema combination, fresh drift/backup/recovery or exact Production approval.

## Source reproducibility and verification

`scripts/security/authority-profile/build.mjs --write-review` generates only the review SQL from tracked public sources; it has no DB connection. It verifies the public later-writer/helper body fingerprints and tests require the generated file to match exactly. The existing staging installer is left unchanged. Tests use synthetic accounts and profile/catalog data, never the private backup or live user rows.

SQL acceptance covers transactional review rollback; committed installation with no authority and unchanged profile schema/rows/grants; legacy/metadata non-authority; grant/revoke and same-claims access; independent Premium/admin and expiry; private API-role denial including service_role; ordinary settings upsert; invalid/unknown profile/scope/evidence/expiry and empty revoke; append-only/lineage/account-erasure restrictions; actual catalog RPC bodies for issued admin with immutable diary rows. Client impersonation grants in native fixture setup do not exist in the candidate.

Real local OTP/Auth/PostgREST acceptance uses the actual transpiled `AdminAccessService` with real Auth getUser checks and real RPC requests. It checks empty authority despite old flags, profile/settings upsert, owner-issued admin, no Premium implication, actual catalog RPC success/denial, same-token revocation, private profile visibility and unchanged diary rows. It reuses the fixed unlinked loopback-only disposable CLI project, keeps tokens/OTPs/status private, and accepts no hosted URL or project. It is not actual full browser/Profile UI or full restored-schema acceptance. CI must pass before either native or API success is claimed.

## Remaining release gates

Combine the exact adapter with all accumulated fixes on the restored complete schema and real application; review privilege drift and all old Premium/catalog access paths; decide administrator authority/provenance and retention/erasure; confirm platform extension execution, fresh recovery and monitoring; prepare exact forward migration/recovery and obtain separate owner approval. Do not activate generators/payments or convert these review wrappers to Production COMMIT commands directly.
