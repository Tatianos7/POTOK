# Generation Staging installation review — 1 November 2026

This package gathers four existing, unchanged SQL candidates after PR277. It does not merge the draft stack into master or deploy the app. Source base: `8711dc1157dd70372b53e30627797c97a18cafd8`; master observed at `555d3263ce20e70ae59576e9dd3e2d2c4a97240e`. The weighted worker and menu flow are prepared in the stack, while the Edge entrypoint remains unbound.

## Exact bounded scope

The manifest at `scripts/security/generation-staging-package/manifest.json` pins each original UTF-8 byte stream by SHA-256. Apply order:

1. PR268 `generation_preparation_source_v1.sql`: request-only private reader; reader allowlist grows from one to two functions.
2. PR269 `generation_producer_sources_v1.sql`: two empty forced-RLS private source/revocation tables and guarded admitted producer reader; allowlist grows to three functions. No source rows are inserted.
3. PR271 `generation_goal_preparation_source_v1.sql`: current-goal reader, bringing the allowlist to four functions. No goal value or profile default is written.
4. `generation_plan_readback_v2.sql`: authenticated own-request/current-head menu reader. No anon or service-role execute grant; no table or data write.

No package installs a recipe, catalog, policy body, warning assessment, Premium entitlement, credentials, SQL login, generator/Edge route, activation flag or FACT. The NOLOGIN reader stays without direct table privileges. The metadata extension remains useful for stored source compatibility even though the goal-derived preparation path does not need metadata rows.

## Fresh read-only Staging observation

Project `ozidryfvhkcbtpnulakq`, 2026-11-01: 18/18 installation-baseline checks passed. Nine existing function bodies/owner/configuration/security/volatility values match. Reader is NOLOGIN/NOSUPERUSER/NOBYPASSRLS and has only the original admitted validation reader in the private function allowlist. Installed source tables retain forced RLS. Required goal/readback relation and column shapes match, including graph_contract_version smallint. The four proposed public/private readers and two proposed tables are absent.

Inputs, final warnings, provenance bindings and revocations each have zero rows; published manifests: zero. The sanitized observation is `scripts/security/generation-staging-package/observation-20261101.json`. These are dated metadata/count observations, not permission to apply or proof of source readiness.

Run the SELECT-only `preflight.readonly.sql` through the independently verified Staging connection before any future operation. `extensionBaselineReady=true` only reports baseline compatibility. `mayApply` and `activationReady` are always false. Database contents can change after the observation. No backups or recoverability of a future hosted installation are asserted here.

## Review tooling and rehearsal

`node scripts/security/generation-staging-package/build.mjs` verifies hashes/order/target label and reports metadata only. `--rollback-sql` emits one transaction ending in ROLLBACK. It preserves all inner definitions/guards and removes only the four original outer transaction envelopes. No apply mode, connector, credentials or live SQL executor is present. The target label is not database identity attestation; execution identity must be checked independently.

Offline tests reject tampered source bytes, target/revision substitution, path traversal, reordered dependencies and invalid transaction envelopes. The native `package` suite executes all four candidates together in the fixed loopback disposable PostgreSQL database; checks exact four-reader allowlist, authenticated-only readback grant and forced RLS; proves rollback restores the baseline; injects a late missing-goal-column failure to prove earlier objects roll back; and performs a fixture-only commit/reinstall-denial test with empty tables and no direct client/reader access. This does not replace the existing per-candidate validator/record/readback behavioral suites, real Auth or Staging E2E.

## Next operation and remaining gates

A future hosted installation requires explicit owner approval of this exact four-source manifest and Staging target, fresh preflight and independent postchecks. AGENTS.md states: “Treat STAGING as read-only unless a specific write or apply is approved.” The current work contains only source changes, disposable tests and read-only Staging queries.

Installation alone cannot deliver a real menu: the catalog is empty, upstream policies and warnings still need admitted provenance, the runtime SQL identity/gateway and client flow need reviewed mounting, and final record-time source-currentness/revocation behavior must be accepted before activation. Then test a real ordinary-account request → validated stored plan → confirmed menu, including wrong-account denial and same-request recovery. Existing successful OTP/security tests need not be repeated merely because this source package is new. No fresh login/OTP, user ID, secret or service key should be sent in chat.

Cooking and mutable recipe refinement remain deferred to the owner's month-long application testing. Missing actual yield/grams remain unknown; this does not authorize invented source data or public recipe approval. Production stays untouched; purchase verification remains after generation (issue198).
