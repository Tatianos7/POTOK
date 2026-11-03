# Generation patch package — Staging review, 2026-11-03

Installation status: applied to Staging after explicit owner approval on
2026-11-03; independent installed-phase checks passed. See the
[installation receipt](generation-patch-install-20261103.md). The pre-install
observations below are historical; the generator remains inactive.

## Scope and current observation

The next bounded installation consists of PR288's stored-source commit fence,
then PR290's nested Graph V2 recipe-ID correction. It adds one private helper and
changes four existing function bodies. It adds no business tables, rows, roles,
memberships, worker grants, secrets, runtime entrypoints or activation flags.

On 2026-11-03 an independent metadata-only Supabase connection identified the
expected POTOK Staging project as ACTIVE_HEALTHY. The new SELECT-only inventory
returned `baselineReady=true`, `installedReady=false`; all eleven common checks
passed. The source-fence helper was absent and all expected original body pins
matched. Restricted roles retained four/three private function permissions and
their narrow attributes. This observation is time-bound, not continuing approval
or evidence of real catalog/menu readiness. No application records were queried.

## Exact source and build

Sources are fixed to PR290 head `56e14043863504d93d2d8281f7c6b63bf22c5837`.
The manifest is `scripts/security/generation-patch-package/manifest.json` and pins
the original full-byte SHA-256 for both SQL candidates, their order and PR IDs.
The builder independently fixes those same identities; changing a manifest hash
cannot authorize changed SQL. Historical candidates and installers are unchanged.

```bash
node scripts/security/generation-patch-package/build.mjs
node scripts/security/generation-patch-package/build.mjs --rollback-sql
node scripts/security/generation-patch-package/build.mjs --commit-review-sql
```

All commands are offline and accept no connection, credential, apply or deploy
option. The first prints a review summary and digests for both exact SQL artifacts;
the second prints a single transaction ending in ROLLBACK. The third prints the
COMMIT candidate for review only. None executes SQL or grants apply permission.
The project label is not database identity proof. A trusted operator must verify
the actual target separately and must never redirect this package to Production.

## Admission and postchecks

`inventory.readonly.sql` returns boolean metadata checks for original and installed
phases: exact source/security/configuration pins, the private helper, narrow LOGIN
roles and allowlists, client gateway denials, worker table/sequence denials,
private source RLS, revocation insert guards, graph/operation constraints and
immutable history triggers. It reads no passwords, function source text or
application data into its returned observation.

The generated transaction repeats baseline admission, uses 5-second lock and
30-second statement limits, executes both original candidates without their
individual transaction envelopes, then requires installed-phase admission.
Before/after snapshots cover every existing function in public, potok_nutrition
and potok_control. Only the four intended bodies may differ; other fields of
those functions, all other existing function bodies/metadata and all ACLs must
remain identical. Only the exact new private helper is excluded from this
comparison and it receives its own hash/security/ACL postcheck.

If baseline, exact-byte source validation, either candidate, preservation or a
postcheck fails, stop. Do not restore old function definitions, rerun old
installers, broaden grants or try to complete a partial installation automatically.
The combined transaction is atomic. An already installed or partially changed
state fails baseline admission and requires fresh review.

## Rehearsal and subsequent decision

The isolated native graph suite includes the combined package: successful review
must roll back both changes and preserve fixture data/baseline; a late package
error and a drifted table grant must also roll back; an explicit fixture-only
COMMIT rehearsal must pass installed checks before the actual graph roundtrip.
All prior lost-reply, immutable history, source-revocation and account-readback
scenarios remain. This is not a hosted rehearsal, full restored-schema acceptance,
real Auth, real catalog publication or phone UI E2E.

After checks pass, present this exact package for specific owner approval.
[AGENTS.md](../../AGENTS.md) requires: "Production and Supabase mutations require
explicit owner approval. Treat STAGING as read-only unless a specific write or
apply is approved."

Only after that approval may the trusted operator bind the verified Staging
target, refresh inventory, verify the exact `commitReviewSha256`, execute the
already reviewed COMMIT candidate and immediately require installed-phase
postchecks. The native suite rehearses those exact COMMIT bytes in its fixed
loopback database; neither that test nor the generator grants hosted authorization.

This package does not test a real worker connection, provision backend secrets,
mount a runtime, invoke generation, publish recipe sources or generate FACT.
Generator activation, deployment and merge remain separate decisions. Recipe
portions/yields remain unknown where not physically confirmed. PLAN != FACT.
