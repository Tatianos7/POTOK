# Explicit portable CA validation

This closes the local Deno X509-method gap identified by PR302 without skipping a validation failure. The legacy Node factory still uses its original X509 checks. The new `createPortableStagingGenerationRuntimeV1` explicitly selects an asynchronous WebCrypto path; it is never chosen automatically after a Node error.

`@peculiar/x509` 3.1.0 and its required `reflect-metadata` 0.2.2 polyfill are exact dependencies, with transitive bytes pinned in the lockfile. They execute locally and send no certificate/password to a service. The implementation uses the library's certificate parsing and cryptographic self-signature verification with the explicitly supplied platform WebCrypto provider, without mutating the library's global crypto provider.

## Checks retained or made stricter

- Exactly one bounded PEM certificate, parseable and matching its DER bytes; no extra PEM objects.
- Basic Constraints must identify a CA, validity dates must be finite and current, duplicate extensions are rejected.
- Where Key Usage is present it must permit certificate signing. Authority/Subject key IDs must agree when Authority key ID is present.
- Self-issued subject/issuer identity and a valid cryptographic self-signature are required. Signature damage is rejected, not treated as a missing feature.
- Validity is checked again after asynchronous verification and when a prepared pool factory is invoked later.

Issuer+serial Authority Key Identifier variants are conservatively rejected as unsupported, rather than accepted without a proper issuer-name check. Unsupported signature algorithms likewise fail closed. This is not a claim of identical acceptance of every unusual certificate accepted by OpenSSL. The exact owner-approved Supabase root still needs validation before hosted admission; a test root is not its provenance evidence.

Both factory paths use one private renderer for the unchanged fixed Staging host, roles, TLS CA, rejectUnauthorized=true, servername, TLS>=1.2, channel binding, startup selectors, timeouts and pool bounds. Secrets are copied before awaits. Pool construction is lazy and disabled by default; no host/role/URI override, owner fallback or client credential path is added. Existing transaction/identity/currentness/record/activation protections are unchanged.

## Verification

Node contracts cover valid self-signed signatures, non-CA, expired/future roots, wrong Key Usage, conflicting key IDs, damaged signatures, duplicate extensions, malformed/multiple PEMs, public RSA/EC roots, secret snapshotting, delayed invocation after expiry and fixed configuration errors. A real loopback native TLS server with an in-memory synthetic key/chain accepts the correct CA/servername and rejects a different CA and wrong servername. That test is not a hosted pg connection or proof of Deno TLS behavior.

The cross-runtime full-worker profiler retains the old probe and adds a separate portable probe. Local Deno 2.1.4 still fails the legacy constructor as expected, while the portable default-disabled constructor/close succeeds. No checkIssued exception is caught and ignored inside a production factory.

The `Local Supabase Edge certificate compatibility` CI workflow runs an isolated certificate-only bundle in the official `supabase/edge-runtime` v1.77.9 image, pinned to multi-platform digest `sha256:6b850a2ccf0bf50ecac9accff8098095cd191c389c2a53c59b857aa0f53a8343` (tag/digests read from the official Docker Hub repository on 3 November 2026). It requires nine public-certificate cases to pass. The container gets no database credentials or user records and has no pg, worker dispatch or Staging configuration. Its port is published only on loopback and its filesystem is read-only except a temporary cache.

This CI canary verifies the new certificate implementation in an actual local Supabase Edge Runtime container. It deliberately reports hostedAcceptance=false, workerExecutionTested=false and cpuLimitsEnforced=false: it does **not** run the full pg worker, enforce production request CPU accounting or prove hosted Staging TLS/role identity. The generated canary is a diagnostic, not the deployable generator.

No Staging/Production write, hosted function deployment, secret provisioning or generator activation is part of this change. The remaining acceptance is the exact worker package, actual Edge request CPU/memory behavior, verified hosted pg/TLS identities and admitted source data, followed by an ordinary-account request-to-menu run. No protection is relaxed to meet a runtime limit.

Primary library references: [project documentation](https://peculiarventures.github.io/x509/), [certificate API](https://peculiarventures.github.io/x509/docs/api/classes/X509Certificate/). The installed 3.1.0 implementation of isSelfSigned/verify was inspected along with the pinned package metadata. Platform references and previously observed limits remain in the hosting assessment; library support alone does not establish hosted acceptance.
