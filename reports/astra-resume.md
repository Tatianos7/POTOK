# POTOK resume — 2026-09-19

**NOT LAUNCH READY. Continue here; do not restart the audit.**

Owner steering: canonical export is **PARKED / OPEN_EXTERNAL_DEPENDENCY**.
Do not retry/bypass it. Premium Nutrition/Plan implementation is **ON HOLD** until
the owner supplies a separate new product-contract prompt. The old plan gap audit
is context only. Continue only independent local safety work; no payment integration.

## Git / authorization

- Worktree: `/Users/urijurij/Desktop/POTOK/.worktrees/workout-muscle-map-foundation`.
- Branch: `master`.
- Current HEAD: `4fed6b38eecfd636843e94fbbb1aaba7de62b722`.
- Local commit not pushed: `4fed6b3 fix: harden account and diary boundaries and recipe preflight`.
  It contains exactly the 27 paths in the main audit's “Exact commit allowlist”.
- **NO PUSH / NO DEPLOY.** No subsequent commit or staging performed.
- SQL is forbidden in this session, including the saved read-only draft artifacts.
  No DB/schema/RLS/data/billing mutation is authorized. No service-role workaround.
- All **229 baseline owner dirty/untracked files are unchanged** by SHA-256.
  Original manifest: `/tmp/potok-launch-audit-2026-09-18/baseline.json`.
  Never stage all files or discard baseline work. If the temporary manifest is
  unavailable in a future environment, do not assume unrelated dirty files are ours.

## Completed after the approved commit

1. Focused historical report/runtime cross-check for resolver, recipe save,
   identity, Premium plan/catalog, entitlement/payment and release gates.
2. Shared exact canonical resolver for analyzer, recipe-save name fallback and
   favorites: explicit ambiguity, complete counted reads, no first-row/fuzzy UUID
   guessing; own-user visibility and failed/partial catalog reads fail closed.
3. Recipe validation before writes: positive finite grams, valid nutrition and
   totals, unresolved/ambiguous statuses cannot save even with a UUID; fresh name
   resolution recalculates that ingredient from the matching food. Selected valid
   snapshots are preserved. Recipe/favorite account mismatch rejects.
4. Analyzer passes user scope and invalidates stale analysis/account results.
   Mounted browser proof is still missing.
5. Premium catalog/Today adapter preserves unknown nutrition instead of showing
   zero; genuine zero remains zero. Premium writes stay disabled.
6. Local Food Core workbook inspected read-only. All ten candidate ingredients
   matched after correcting three candidate semantic IDs. Four local portion
   nutrition previews computed and independently checked with Decimal arithmetic.
   **Strict canonical dry-run: 0 valid / 4 rejected**, no UUID mapping invented.
7. Follow-up resolver fix: contradictory snapshots of the same UUID fail closed
   before visibility filtering (nutrients, identity, owner/source, review/access,
   naming). Identical duplicates remain valid; aliases merge without mutating
   inputs. Alias target IDs must match the requested set, not just its count.
8. Recipe preflight snapshots inputs before async lookup and rejects total gram
   overflow. Graph reads preserve missing/invalid nutrition instead of fabricating
   zero; re-save is rejected, genuine zero/numeric strings preserved. Historical
   records, graph source preference and saved header totals are unchanged.
9. Entitlement reads now reject requested-account/session mismatch before RPC;
   matching and implicit-current-account flows preserve existing Free/Premium
   capability policy. Four in-memory behavioral tests; no live RPC probes.
10. Extended recipe metadata draft with precision/scale, RLS flags/table grants;
    documented atomic-save acceptance cases and capability-policy source gaps in
    the existing checkpoint report. No SQL executed, no server contract enabled.

## Checks

- Latest focused safety regression: **36 passed**.
- Latest broad regression: **141 files; 1078 tests; 1077 pass; 0 fail; 1 skipped**.
  The skipped diary integration test requires dedicated Supabase test env.
- `npm run build`: **PASS**, including TypeScript and Pages fallback.
- `npm run lint`: **FAIL**, 121 existing errors / 491 warnings. Diagnostic diff
  versus original baseline: **0 added, 11 warnings removed**.
- `git diff --check`: **PASS**. New artifacts also checked for whitespace.
- Independent local-preview arithmetic, source hashes and strict rejection: **PASS**.
- Last browser backend discovery: `[]`; **NOT_TESTED_BROWSER**. SSR/static tests are
  not mobile/mounted behavior proof.
- Latest logs: `/tmp/potok-launch-audit-2026-09-18/park-{focused-tests,tests,build,lint}.log`.
  Initial build caught the Supabase join object/array typing boundary; fixed by
  explicitly rejecting malformed relation arrays. Final full tests/build passed.

Lint triage: no new errors are introduced. Existing errors include unused code,
spacing and switch declarations. `FoodDiary.tsx` has a `no-unsafe-finally` return
for stale requests; source review alone does not establish a new data-loss bug.
Do not start a mass unrelated lint cleanup; global lint remains a release gate.

## Parked blocker — OPEN_EXTERNAL_DEPENDENCY

Two GET-only reads with the existing anon key could not export configured public
foods: missing `foods.needs_review` (42703), then table permission denied (42501).
No usable live food rows were returned. Local XLSX/CSV import identifiers are
semantic TEXT, not the required UUID mapping. Historical staging UUID snapshots
do not establish current mappings/review/searchability. Do not weaken validation.

**External checkpoint when resumed:** provide an existing ordinary authenticated staging
read context through secure local configuration, or a current owner-exported
canonical-food file. Do not paste JWTs, passwords or keys into chat. Scope is
GET-only foods/aliases for the ten public core/brand semantic IDs in the availability
report, with exact project/timestamp/counts/UUID roots/nutrition and actual review
and searchability evidence. No service role, test-user creation, write probes,
SQL, RLS changes or production fallback. Read-only work is already authorized;
the missing dependency is secure authenticated access/equivalent export.

Recipe edit atomicity also remains unresolved: the client updates the recipe,
deletes graph rows and inserts replacements in separate requests. Existing SQL
RPC is not safe to enable blindly; deployed signature/trigger/version semantics
must be checked first. The metadata SQL artifact is draft-only and requires a
separate explicit exception to the current “no SQL execution” instruction.

## Exact next safe task / remaining checkpoints

The requested conflicting-UUID package and the independent recipe/entitlement
account-safety follow-ups are complete locally. Do not repeat their audit/tests
without a new change or failure. No further implementation in this reviewed scope
is justified by the currently confirmed server/product contracts.

**Next independent branch:** inspect owner-provided current staging metadata for
recipe RPC signatures/definitions, numeric limits, triggers, RLS/grants and recipe
version columns. Compare with the saved acceptance matrix; then prepare the exact
atomic-save RPC/client/rollback draft. No SQL access is needed if the owner supplies
the metadata as a local artifact. If using the existing metadata-only SQL drafts,
their execution requires a separate explicit exception to the current SQL ban.
No apply or actor write test is authorized by such a read-only exception.

Remaining owner/external checkpoints:

1. **Canonical export: OPEN_EXTERNAL_DEPENDENCY, PARKED.** Existing secure ordinary
   staging read context or current owner export with the evidence listed above.
   After owner un-parks it, run canonical preflight for the four candidates;
   keep `publishable=false`. Content approval/import is a separate later checkpoint.
2. **Recipe atomicity/security metadata.** Supply current metadata, or explicitly
   authorize only the reviewed metadata-read drafts in staging. A later exact
   SQL/RPC/RLS patch, fixture writes/cleanup and staging apply require separate
   review/approval; production approval is separate again. Existing non-atomic
   edits, read-error shadow fallback and deployed numeric limits remain unresolved.
3. **Server entitlement/capabilities.** Confirm actual deployed functions/grants/
   protective triggers and authoritative feature/paid-data policy. Source gaps
   (privileged writes, caller scope, client/server capability disagreement, flag
   types, expiry) remain unverified. No live-security PASS from client tests.
4. **Premium Nutrition/Plan: ON HOLD.** Wait for the owner's new contract prompt;
   no portion/target/persistence implementation under the previous assumptions.
5. **Payment: decision pending.** Provider/platform/merchant/markets and launch
   scope, or explicit exclusion. No integration or pricing/products created.
6. **Release.** Browser/mobile backend and ordinary staging actors for actual
   UI/read QA; reviewed authorization for any write fixtures. Legacy lint errors
   remain a release gate. Further commits/push/deploy require their own authorization.

No owner approval is needed retroactively for the completed local package. Further
atomic-save/server-security work needs concrete metadata/policy evidence; do not
ask for blanket mutation approval or restart the parked canonical blocker.

## Evidence and exact uncommitted package

- Main audit: `launch-readiness-audit-2026-09-18.md`.
- Cross-check, plan gaps and checkpoints: `recipe-resolver-safety-checkpoint-2026-09-19.md`.
- Source row/hash evidence and local preview: `recipe-local-availability-2026-09-19.json`.
- Payment/server findings: `payment-entitlement-audit-2026-09-19.md` (already committed).

Only these post-commit paths belong to this continuation (24 files):

```text
data/recipes/recipe-candidates-v1.json
docs/recipes/recipe-content-preflight.md
reports/astra-resume.md
reports/launch-readiness-audit-2026-09-18.md
reports/recipe-local-availability-2026-09-19.json
reports/recipe-resolver-safety-checkpoint-2026-09-19.md
scripts/sql/recipe-save-contract-read-only-audit.sql
src/pages/RecipeAnalyzer.tsx
src/services/__tests__/canonicalFoodResolver.test.ts
src/services/__tests__/entitlementService.account-scope.test.ts
src/services/__tests__/premiumCatalogService.test.ts
src/services/__tests__/premiumTodayAdapter.test.ts
src/services/__tests__/recipeAnalyzerReal.food-core.test.ts
src/services/__tests__/recipeResolutionSafety.test.ts
src/services/canonicalFoodResolver.ts
src/services/entitlementService.ts
src/services/favoritesService.ts
src/services/premiumCatalogService.ts
src/services/premiumTodayAdapter.ts
src/services/recipeAnalyzerReal.ts
src/services/recipeAnalyzerService.ts
src/services/recipesService.ts
src/types/recipe.ts
src/utils/nutritionCalculator.ts
```
