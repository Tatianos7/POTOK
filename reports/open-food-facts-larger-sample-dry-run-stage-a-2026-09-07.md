# Open Food Facts Larger Sample Dry Run Stage A

- Date: 2026-09-07
- Branch: `master`
- HEAD: `c70962d open food facts larger sample dry run plan`
- Source plan: `reports/open-food-facts-larger-sample-dry-run-plan-2026-09-07.md`
- Cleaner: `scripts/open-food-facts/offImportCleaner.ts`
- Intended fixture: `scripts/open-food-facts/fixtures/ru-sample-stage-a-100-2026-09-07.json`
- Target package: `OPEN_FOOD_FACTS_LARGER_SAMPLE_DRY_RUN_STAGE_A`
- Verdict: **REQUIRES_FIXES**

## Scope

Attempt Stage A larger Open Food Facts RU/Russia sample dry-run for POTOK with 100 records. The intended workflow was to collect a narrow-field official Open Food Facts sample outside runtime, save a local 100-record fixture, run the existing POTOK cleaner, and produce markdown/JSON dry-run outputs.

This package did not complete because Open Food Facts returned `503` for the bounded Stage A sample requests. No heavy retries were performed.

This remains report-only/partial. Runtime app code was not changed, UI was not changed, config/dependency files were not changed, dependencies were not added, Open Food Facts app integration was not added, API clients were not added, API keys/secrets were not used, images/photos were not requested, Supabase client was not used, Supabase SQL was not executed, DB/import/staging/production were not touched, RLS behavior tests were not run, Premium write paths were not touched, diary runtime writes were not executed, and no PR/commit was created.

## Executive Summary

Stage A is blocked by provider availability.

What happened:

- Request count: 2.
- Both requests used official Open Food Facts API v2 outside runtime.
- Both requests used narrow fields only.
- Both requests used an identifying User-Agent.
- Both requests returned `503`.
- No heavy retries were performed.
- No 100-record fixture was created.
- No Stage A cleaner dry-run output was generated from new data.

Result:

- Stage A 100-record sample is not ready.
- The existing 19-row baseline remains the only completed dry-run baseline.
- Final verdict is `REQUIRES_FIXES` due external API unavailability.

## Intended Method

Intended sample:

- 100 Russia-market records.
- Official Open Food Facts API limited sample.
- Narrow fields only.
- No images/photos.
- No API keys.
- No runtime app integration.
- No DB writes.
- No Supabase usage.

Intended local fixture:

- `scripts/open-food-facts/fixtures/ru-sample-stage-a-100-2026-09-07.json`

Intended outputs:

- `reports/open-food-facts-larger-sample-dry-run-stage-a-2026-09-07.md`
- `reports/open-food-facts-larger-sample-dry-run-stage-a-2026-09-07.json`

Because no valid 100-record sample was received, the intended fixture and Stage A cleaned JSON output were not created.

## API Attempts

Attempt 1:

- URL: `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=Russia&fields=code,url,product_name,product_name_ru,brands,countries,countries_tags,lang,languages,languages_tags,categories,categories_tags,nutriments&page_size=100&page=1`
- User-Agent: `POTOK Open Food Facts Stage A dry-run audit; local report only; no runtime integration`
- Result: `503`

Attempt 2:

- URL: `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=Russia&fields=code,url,product_name,product_name_ru,brands,countries,countries_tags,lang,languages,languages_tags,categories,categories_tags,nutriments&page_size=100&page=2`
- User-Agent: `POTOK Open Food Facts Stage A dry-run audit; local report only; no runtime integration`
- Result: `503`

Stop reason:

- API instability/unavailability.
- The Stage A plan explicitly says to stop on errors and avoid heavy retries.

## Fields Requested

Only the approved narrow fields were requested:

- `code`
- `url`
- `product_name`
- `product_name_ru`
- `brands`
- `countries`
- `countries_tags`
- `lang`
- `languages`
- `languages_tags`
- `categories`
- `categories_tags`
- `nutriments`

The API request used `nutriments` because Open Food Facts returns nutrition as an object. The intended fixture filter would have retained only:

- `nutriments.energy-kcal_100g`
- `nutriments.proteins_100g`
- `nutriments.fat_100g`
- `nutriments.carbohydrates_100g`
- `nutriments.fiber_100g`

No image/photo fields were requested.

## Baseline Comparison

Completed 19-row baseline:

- `candidate_ok`: 4
- `needs_language_review`: 7
- `needs_quality_review`: 3
- `needs_duplicate_review`: 1
- `auto_reject`: 4

Stage A 100-row result:

- Not available.
- No fixture was created.
- No cleaner classification counts were produced.

The larger sample still needs to confirm or challenge the 19-row baseline before any provider import or schema/storage decision.

## Decision Thresholds Not Evaluated

The planned thresholds could not be evaluated:

- Open Food Facts useful as candidate source if `candidate_ok + reviewable >= 60%`.
- Promising for controlled candidate batches if `candidate_ok >= 20%` and `auto_reject <= 35%`.
- Poor for bulk import if `auto_reject > 50%`.
- Barcode fallback only if clean `candidate_ok < 10%` or review workload is too high.

No Stage A percentages are available because the sample was not collected.

## Required Fixes / Next Attempt

Before retrying Stage A:

- wait for Open Food Facts API availability to recover;
- or switch to an owner-approved official export/dump filtered locally;
- or use a manually approved local fixture expansion with clear provenance labels.

For a retry:

- keep request count minimal;
- keep narrow fields only;
- keep no-image/no-photo boundary;
- record exact request URLs and User-Agent;
- stop again on repeated errors;
- do not combine sample collection with DB/schema/import work.

## Safety Confirmation

Confirmed for this partial package:

- Stage A local dry-run attempt only;
- no runtime app integration;
- no UI changes;
- no config/dependency changes;
- no new dependencies;
- no API keys;
- no secrets;
- no images/photos;
- no valid new provider sample stored;
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

- `curl` official Open Food Facts API attempt 1
  - Result: failed with `503`.
- `curl` official Open Food Facts API attempt 2
  - Result: failed with `503`.
- `git diff --check`
  - Result: passed.
- `npx tsx --test scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
  - Result: passed, 24 tests.
- `npx tsx scripts/open-food-facts/runOffImportCleanerDryRun.ts`
  - Result: passed for existing 19-row regression fixture; this was not a Stage A 100-row run.
- Stage A dry-run command
  - Result: not run because no valid 100-record fixture was created after API `503` responses.
- `npm run build`
  - Result: passed, with existing Vite/Browserslist/chunk-size warnings.

## Final Recommendation

Do not proceed with Stage A import conclusions from this package. The correct next step is to retry later with the same bounded API approach or switch to an owner-approved official export/dump-local-filter path.

Do not create a fake 100-row fixture from old data. Do not use the existing 19-row output as a substitute for Stage A. Do not apply SQL, write to Supabase, import provider rows, or expose Open Food Facts in runtime search.

## Final Verdict

**REQUIRES_FIXES**
