# Open Food Facts Import Cleaner Dry Run Tuning Review

- Date: 2026-09-07
- Branch: `master`
- HEAD: `f376d2f open food facts import cleaner dry run implementation`
- Reviewed tuning report: `reports/open-food-facts-import-cleaner-dry-run-tuning-2026-09-06.md`
- Reviewed cleaner: `scripts/open-food-facts/offImportCleaner.ts`
- Reviewed fixture: `scripts/open-food-facts/fixtures/ru-sample-2026-09-06.json`
- Reviewed tests: `scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
- Reviewed dry-run report: `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md`
- Reviewed dry-run JSON: `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.json`
- Target package: `OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_TUNING_REVIEW`
- Verdict: **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_TUNING_REVIEW_READY**

## Scope

Review the Open Food Facts Import Cleaner Dry Run Tuning package before commit. This review checks cleaner/scoring changes, fixture metadata, tests, generated markdown/JSON outputs, tuning report quality, and safety boundaries.

This is review-only. No implementation code was changed during this review, except for creating this review report. Runtime app code was not integrated with Open Food Facts, UI was not changed, config/dependency files were not changed, dependencies were not added, live API calls were not made, new data was not downloaded, API keys/secrets were not used, Supabase client was not used, SQL was not executed, DB/import/staging/production were not touched, RLS behavior tests were not run, Premium write paths were not touched, and no PR/commit was created.

## Executive Summary

The tuning package is sound and commit-ready as a local dry-run artifact.

The changes address the implementation review findings without weakening catalog safety:

- synthetic fixture rows are labeled clearly;
- weak brand-like display names are downgraded and no longer keep misleading high display-name scores;
- `святой-источник` is not `candidate_ok`;
- duplicate risk still overrides candidate acceptance;
- `per_100ml_needs_handling` remains conservative and now slightly lowers overall score;
- generated markdown and JSON outputs are regenerated and agree on classification counts;
- focused tests now cover the requested edge cases.

No blocker was found.

## Reviewed Files

- `scripts/open-food-facts/offImportCleaner.ts`
- `scripts/open-food-facts/fixtures/ru-sample-2026-09-06.json`
- `scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
- `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md`
- `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.json`
- `reports/open-food-facts-import-cleaner-dry-run-tuning-2026-09-06.md`

## Blocker Findings

No blockers for committing the tuning package as a local dry-run artifact.

## Non-Blocker Findings

### 1. Product-type token list is intentionally small

The cleaner now uses display-name product-type tokens instead of letting category tags fully rescue weak names. This is safer, but the Russian product-type list is still a small heuristic list.

Impact:

- Some valid names may go to `needs_language_review` until the token list grows.
- This is acceptable because review routing is safer than accidental verified-catalog readiness.

Recommendation:

- Grow product-type signals from reviewed false positives during larger dry-runs.

Severity: non-blocker.

### 2. Broad review-or-reject tests remain in a few legacy cases

Some earlier tests still allow `needs_language_review|auto_reject` for ambiguous language/noise cases. The new tuning tests add stricter expectations for missing barcode, missing brand, negative nutrition, suspicious nutrition, non-food category, weak brand-like display, and summary counts.

Impact:

- A few ambiguity tests still preserve flexibility while thresholds are owner-reviewed.

Recommendation:

- Convert broad assertions to exact classifications after owner approves stricter thresholds.

Severity: non-blocker.

### 3. Generated dry-run report remains labeled as implementation output

The regenerated dry-run report still carries the implementation package target/verdict, while the tuning report separately documents the tuning package and updated counts.

Impact:

- This is acceptable because the dry-run report is the stable generated output artifact.
- The tuning report records the tuning context and before/after behavior.

Recommendation:

- If future dry-runs need fully versioned report identities, add a run label or tuning version to the runner output.

Severity: non-blocker.

## Cleaner / Scoring Assessment

The cleaner changes are conservative and aligned with the approved strategy.

Confirmed:

- `candidate_ok` still requires clean Russian display, barcode/brand identity, complete usable nutrition, market relevance, and no duplicate conflict.
- `святой-источник` now routes to `needs_language_review`, not `candidate_ok`.
- Its `ru_display_name_score` is reduced to 0.2 and `overall_quality_score` to 0.73.
- Category tags no longer fully compensate for weak display text.
- Duplicate barcode/name-brand risk still returns `needs_duplicate_review` before candidate acceptance.
- Mixed Russian/Latin and noisy names still route to review/reject.
- `per_100ml_needs_handling` remains a quality reason and subtracts 0.05 from overall score.
- Non-liquid clean rows are not penalized by the per-100ml rule.

The tuning did not make scoring softer for risky rows.

## Fixture Assessment

The fixture update is appropriate.

Confirmed:

- four synthetic edge-case rows are marked with `_fixture_kind: synthetic_edge_case`;
- each marked row has `_fixture_note`;
- the intentional duplicate tomato paste row is clear;
- the Ukrainian-marker row is clear;
- `Вода с лимоном`, brand `Тест`, is clear as a per-100ml edge case;
- `Драже M&M` is clear as a missing-macro edge case;
- no product photos/images are introduced;
- no secrets, API keys, user private data, or Supabase data are present;
- no raw provider payload blob beyond the narrow fixture fields is introduced.

## Tests Assessment

Focused cleaner tests now pass 24 cases.

Coverage confirmed:

- clean RU `candidate_ok`;
- missing `product_name_ru`;
- Latin primary name;
- mixed RU/Latin name;
- suspected non-Russian Cyrillic;
- OCR/scan noise;
- missing calories;
- missing macros;
- all-zero water review;
- all-zero non-water reject;
- duplicate barcode;
- duplicate normalized name + brand;
- fixture-order duplicate behavior;
- per-100ml handling;
- `candidate_ok` is not verified promotion;
- resolver does not invent Russian names;
- fixture metadata;
- missing barcode;
- missing brand;
- negative nutrition;
- suspicious high nutrition;
- non-food category;
- weak brand-like display name;
- runner summary snapshot.

Residual test risk:

- a few intentionally broad language/noise tests should become exact once owner thresholds are final.

## Generated Output Assessment

Generated markdown and JSON were regenerated from the local fixture and agree on counts.

After tuning counts:

- Total rows processed: 19
- `candidate_ok`: 4
- `needs_language_review`: 7
- `needs_quality_review`: 3
- `needs_duplicate_review`: 1
- `auto_reject`: 4

Reason-code counts are also present in JSON and markdown. No photos/images, secrets, Supabase output, app-runtime integration, or live provider API output were introduced.

The generated outputs continue to present cleaner results as dry-run evidence only, not verified catalog import data.

## Tuning Report Assessment

The tuning report is complete enough for commit.

Confirmed:

- explains what changed;
- explains why the changes were made;
- includes before/after counts;
- highlights the `святой-источник` behavior change;
- documents the fixture metadata decision;
- documents scoring changes;
- lists tests added;
- confirms safety boundaries;
- recommends owner threshold review before larger samples or any import/storage work.

## Safety Assessment

Safety boundary is preserved.

Confirmed:

- local dry-run only;
- no runtime app integration;
- no UI changes;
- no config/dependency changes;
- no new dependencies;
- no Open Food Facts live API calls;
- no API keys;
- no secrets;
- no new data download;
- no import into POTOK DB;
- no Supabase client usage;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no real table writes;
- no service-role keys;
- no RLS policy changes;
- no Premium writes;
- no diary runtime writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR;
- no commit.

Search for network/DB indicators in the touched Open Food Facts script/report scope found no live API or Supabase integration; provider URLs remain fixture/provenance strings only.

## Required Fixes

No required fixes before commit.

## Optional Improvements

Optional later improvements:

- expand Russian product-type token coverage from owner-reviewed false positives;
- make ambiguous language/noise tests exact after thresholds are approved;
- add a generated JSON schema smoke test;
- add runner snapshot tests for markdown sections if report format stability becomes important;
- add a tuning/run version field to generated outputs if multiple dry-runs share the same date.

## Verification

- `git diff --check`
  - Result: passed.
- `npx tsx --test scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
  - Result: passed, 24 tests.
- `npx tsx scripts/open-food-facts/runOffImportCleanerDryRun.ts`
  - Result: passed after sandbox escalation for local `tsx` IPC; no API/DB/SQL/network work.
- `npm run build`
  - Result: passed, with existing Vite/Browserslist/chunk-size warnings.

## Final Recommendation

Commit the tuning package and this review report as local dry-run artifacts.

Do not use the cleaner output for verified catalog import yet. The next step should remain owner review of tuned thresholds/examples before any larger sample, provider persistence, schema apply, runtime Open Food Facts fallback, or catalog promotion.

## Final Verdict

**OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_TUNING_REVIEW_READY**
