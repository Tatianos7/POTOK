# Open Food Facts Import Cleaner Dry Run Tuning

- Date: 2026-09-06
- Branch: `master`
- HEAD: `f376d2f open food facts import cleaner dry run implementation`
- Source implementation review: `reports/open-food-facts-import-cleaner-dry-run-implementation-review-2026-09-06.md`
- Tuned cleaner: `scripts/open-food-facts/offImportCleaner.ts`
- Updated fixture: `scripts/open-food-facts/fixtures/ru-sample-2026-09-06.json`
- Updated tests: `scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
- Updated dry-run report: `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md`
- Updated dry-run JSON: `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.json`
- Target package: `OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_TUNING`
- Verdict: **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_TUNING_READY**

## Scope

Apply owner-approved tuning/polish to the local Open Food Facts import cleaner dry-run. This tuning addresses review findings around fixture metadata, weak brand-like display names, per-100ml scoring, and missing edge-case tests.

This remains a local dry-run artifact only. Runtime app code was not integrated with Open Food Facts, UI was not changed, config/dependency files were not changed, dependencies were not added, live API calls were not made, new data was not downloaded, API keys/secrets were not used, Supabase client was not used, SQL was not executed, DB/import/staging/production were not touched, RLS behavior tests were not run, Premium write paths were not touched, and no PR/commit was created.

## Executive Summary

Tuning is complete and keeps the dry-run conservative:

- synthetic fixture rows are explicitly labeled;
- weak brand-like/category-poor names no longer keep misleadingly high display-name scores;
- `per_100ml_needs_handling` still blocks direct candidate acceptance and now lowers overall score slightly;
- duplicate risk still overrides candidate acceptance;
- good Russian display names with real product-type signals remain eligible for `candidate_ok`;
- additional tests cover metadata, nutrition, identity, non-food, weak display-name, duplicate, and summary behavior.

No blocker was found after tuning.

## Before And After Counts

Before tuning:

- Total rows processed: 19
- `candidate_ok`: 4
- `needs_language_review`: 6
- `needs_quality_review`: 4
- `needs_duplicate_review`: 1
- `auto_reject`: 4

After tuning:

- Total rows processed: 19
- `candidate_ok`: 4
- `needs_language_review`: 7
- `needs_quality_review`: 3
- `needs_duplicate_review`: 1
- `auto_reject`: 4

Main movement:

- `святой-источник` moved from `needs_quality_review` to `needs_language_review`.
- `candidate_ok` count stayed at 4 after preserving valid Russian product signals such as `АктиБио с пробиотиками и злаками`.
- `needs_quality_review` decreased from 4 to 3 because the weak brand-like water row is now treated as a display-name/language problem, not only a per-100ml quality issue.

## Fixture Metadata

The fixture now labels four intentional edge-case rows with:

- `_fixture_kind: synthetic_edge_case`
- `_fixture_note`

Labeled rows:

- intentional duplicate tomato paste row for duplicate barcode detection;
- synthetic Ukrainian-marker row for non-Russian Cyrillic review behavior;
- synthetic `Вода с лимоном` row for per-100ml handling;
- synthetic `Драже M&M` row for missing-macro rejection.

This reduces future reviewer confusion between sampled provider-like rows and intentional test fixtures.

## Scoring Changes

Display-name scoring now separates two signals:

- display text product-type signal from the actual Russian name;
- category product-type signal from provider categories.

Category tags alone no longer fully compensate for weak display text. If the display name lacks a product-type signal and only categories provide product clarity, the display-name score is reduced.

Weak brand-like names now receive a stronger display-name penalty when:

- normalized display name equals normalized brand; or
- display text is a very short/simple name without a product-type signal.

The reviewed example `святой-источник` now has:

- classification: `needs_language_review`;
- reason codes: `per_100ml_needs_handling`, `brand_only_name`;
- `ru_display_name_score`: 0.2;
- `overall_quality_score`: 0.73.

Per-100ml handling remains classification-significant and now also subtracts 0.05 from `overall_quality_score`. This keeps beverage/liquid rows visibly less ready while preserving them for review instead of rejection when other fields are usable.

## Tests Added

New coverage includes:

- synthetic fixture metadata exists and covers four edge-case rows;
- missing barcode routes to `needs_quality_review`;
- missing brand routes to `needs_quality_review`;
- negative nutrition routes to `auto_reject` with `provider_payload_incomplete`;
- suspicious high nutrition routes to `needs_quality_review`;
- non-food category routes to `auto_reject`;
- weak brand-like display name is not `candidate_ok` and has a lower score;
- current fixture summary snapshot stays stable after tuning.

The full focused cleaner test file now passes 24 tests.

## Generated Outputs

The dry-run outputs were regenerated from the local fixture:

- `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md`
- `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.json`

No live Open Food Facts API was called, no new data was downloaded, and no provider data was imported into POTOK.

## Safety Assessment

Safety boundary remains intact:

- local fixture only;
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

## Verification

- `npx tsx --test scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
  - Result: passed, 24 tests.
- `npx tsx scripts/open-food-facts/runOffImportCleanerDryRun.ts`
  - Result: passed after sandbox escalation for local `tsx` IPC; no API/DB/SQL/network work.
- `npm run build`
  - Result: passed, with existing Vite/Browserslist/chunk-size warnings.
- `git diff --check`
  - Result: passed.

## Final Recommendation

This tuning package is ready to preserve as a local dry-run improvement. Do not use the cleaner output for verified catalog import yet. The next product step should be owner review of tuned thresholds and examples before any larger sample, schema apply, provider persistence, or user-facing Open Food Facts fallback.

## Final Verdict

**OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_TUNING_READY**
