# Open Food Facts Import Cleaner Dry Run Implementation Review

- Date: 2026-09-06
- Branch: `master`
- HEAD: `1352bed open food facts import cleaner dry run plan`
- Reviewed plan: `reports/open-food-facts-import-cleaner-dry-run-plan-2026-09-06.md`
- Reviewed dry-run report: `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md`
- Reviewed JSON output: `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.json`
- Target package: `OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION_REVIEW`
- Verdict: **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION_REVIEW_READY**

## Scope

Review the Open Food Facts Import Cleaner Dry Run implementation before commit. This review checks fixture safety, pure cleaner helpers, classification rules, scoring, reason codes, generated markdown report, generated JSON output, tests, and safety boundaries.

This is review-only. Implementation files were not changed during this review. Runtime app code was not changed, UI was not changed, config/dependency files were not changed, dependencies were not added, Open Food Facts app integration was not added, live API calls were not made, API keys/secrets were not used, new data was not downloaded, Supabase client was not used, Supabase SQL was not executed, DB/import/staging/production were not touched, RLS behavior tests were not run, Premium write paths were not touched, and no PR/commit was created.

## Executive Summary

The implementation matches the approved dry-run-only direction:

- it uses a local fixture only;
- it does not call Open Food Facts live APIs;
- it does not use Supabase, SQL, DB writes, secrets, or API keys;
- it does not modify runtime app/UI/config/dependencies;
- it implements the required classification statuses and stable reason codes;
- it generates markdown and JSON dry-run outputs;
- focused helper tests pass.

No blocker was found for committing this implementation package as a local dry-run artifact.

The main review finding is non-blocking: scoring/classification is intentionally conservative for beverages because `per_100ml_needs_handling` routes many records to `needs_quality_review`, and a few weak display names still keep high overall scores. That is acceptable for a first dry-run because those records are not promoted or shown to users, but thresholds should be tuned before larger samples.

## Reviewed Files

- `scripts/open-food-facts/offImportCleaner.ts`
- `scripts/open-food-facts/runOffImportCleanerDryRun.ts`
- `scripts/open-food-facts/fixtures/ru-sample-2026-09-06.json`
- `scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
- `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md`
- `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.json`
- `reports/open-food-facts-import-cleaner-dry-run-plan-2026-09-06.md`

## Blocker Findings

No blockers for committing the implementation as a local dry-run package.

## Non-Blocker Findings

### 1. Synthetic/edge-case fixture rows should be labeled before long-term fixture growth

Reference: `scripts/open-food-facts/fixtures/ru-sample-2026-09-06.json`, lines 315-397.

The fixture includes edge-case rows that look synthetic or test-oriented:

- duplicate tomato paste at lines 315-335;
- Ukrainian-marker row with brand `Тест` at lines 336-356;
- `Вода с лимоном`, brand `Тест`, at lines 357-377;
- missing-macro `Драже M&M` row at lines 378-397.

This is acceptable for the first focused dry-run because those rows exercise required rules, especially duplicate, non-Russian Cyrillic, per-100ml, and missing macro behavior. Before committing larger fixtures, add a clear fixture note or metadata convention so future reviewers do not confuse synthetic edge cases with sampled provider records.

Severity: non-blocker.

### 2. `per_100ml_needs_handling` is broad and changes classification for many otherwise clean beverages

Reference: `scripts/open-food-facts/offImportCleaner.ts`, lines 253-258 and 153-160; generated report lines 25, 55-60, and 92-98.

`per_100ml_needs_handling` fired 10 times out of 19 rows and is treated as a quality reason. This means otherwise clean beverage/liquid records such as milk and lemon water become `needs_quality_review` instead of `candidate_ok`.

This is conservative and consistent with the plan: POTOK should not silently treat volume-based products as ordinary weight-based foods. The tradeoff is that `candidate_ok` counts for beverages will stay artificially low until a reviewed per-100ml policy exists.

Severity: non-blocker; owner/product threshold decision.

### 3. Weak display-name examples can keep high overall scores

Reference: `scripts/open-food-facts/offImportCleaner.ts`, lines 238-245, 298-312, and 493-499; generated report line 59.

The row `святой-источник` is classified as `needs_quality_review`, but still has `overall_quality_score=0.95`. This happens because category tags satisfy the product-type heuristic and `per_100ml_needs_handling` affects classification but does not reduce the score.

The classification is safe because the row is not `candidate_ok`; however, high score may be confusing in owner review reports. Later tuning should lower display or overall score for lowercase brand-like names, category-poor display names, and rows whose only product clarity comes from provider categories.

Severity: non-blocker; scoring clarity improvement.

### 4. Severe noisy mixed-language row is routed to language review, not reject

Reference: `scripts/open-food-facts/offImportCleaner.ts`, lines 465-472; generated report line 53.

`Agua aqua minerale без газа смотка на витрине` is classified as `needs_language_review`, not `auto_reject`, because the implementation treats mixed/noisy language signals as reviewable unless a hard reject reason applies.

This is acceptable for MVP because the row is hidden from user-facing search and not promoted. If owner wants stricter import hygiene, combine multiple language/noise reasons into `auto_reject` for future larger dry-runs.

Severity: non-blocker.

### 5. Tests cover core rules but intentionally allow broad outcomes in a few places

Reference: `scripts/open-food-facts/__tests__/offImportCleaner.test.ts`, lines 41-49, 77-89, and 92-108.

Some tests assert `needs_language_review|auto_reject` rather than exact classifications. That keeps the first helper flexible, but it can also allow drift in strictness. Add exact expected classifications once owner-approved thresholds stabilize.

Severity: non-blocker.

### 6. Runner-generated markdown template omits some manual verification lines

Reference: `scripts/open-food-facts/runOffImportCleanerDryRun.ts`, lines 155-159.

The runner itself writes only the runner verification line into the generated report. Earlier manual verification lines for focused tests, build, and `git diff --check` can be lost when the report is regenerated.

This does not affect cleaner correctness or safety. If the generated report is expected to be fully reproducible, add those verification lines to the runner template later.

Severity: non-blocker.

## Classification / Scoring Assessment

Implemented statuses:

- `candidate_ok`: present.
- `needs_language_review`: present.
- `needs_quality_review`: present.
- `needs_duplicate_review`: present.
- `auto_reject`: present.

Classification order is safe:

- duplicate reasons override candidate acceptance;
- water/all-zero routes to quality review before generic hard reject;
- hard reject reasons block invalid/missing/Latin-primary/non-food/provider-incomplete rows;
- language reasons route ambiguous names away from `candidate_ok`;
- quality reasons route per-100ml and suspicious nutrition away from `candidate_ok`.

Assessment:

- `candidate_ok` requires no important reason codes in practice.
- Duplicate risk correctly overrides `candidate_ok`.
- Missing calories/macros and all-zero non-water reject.
- All-zero water gets review, not acceptance.
- Per-100ml handling is intentionally conservative.
- Overall scoring is useful for triage, but should not be treated as promotion readiness.

## Fixture Assessment

The fixture is local and limited:

- 19 records;
- OFF-like fields only;
- no images/photos;
- no API keys;
- no secrets;
- no user/private production data;
- no raw provider payload blob.

The duplicate tomato paste row is useful and appears intentional for duplicate detection.

The synthetic-looking `Тест` rows are useful edge cases but should be labeled later with a fixture metadata convention or a companion README.

## Generated Report Assessment

Generated markdown report includes:

- total rows processed;
- count by classification;
- count by reason code;
- examples for all five classification buckets;
- top noisy names;
- nutrition problems;
- water/all-zero exceptions;
- per-100ml beverage candidates;
- owner decision checklist;
- cautious final recommendation;
- safety confirmation.

Counts match generated JSON summary:

- total rows: 19;
- `candidate_ok`: 4;
- `needs_language_review`: 6;
- `needs_quality_review`: 4;
- `needs_duplicate_review`: 1;
- `auto_reject`: 4.

No photos/images, secrets, Supabase output, or app-runtime integration details are present.

## JSON Output Assessment

Generated JSON structure is stable enough for the first review:

- `generated_at`;
- `source_fixture`;
- `summary`;
- `records`.

Each cleaned record includes:

- provider identity fields;
- proposed and normalized names/brand;
- nutrition fields;
- classification;
- review status suggestion;
- reason codes;
- scores;
- notes.

The JSON does not include secrets, API keys, Supabase data, or full raw provider payloads. It does include provider URLs from the fixture, which is acceptable for traceability.

## Tests Assessment

Focused tests cover the requested core rules:

- clean Russian name and complete nutrition;
- missing `product_name_ru`;
- Latin primary names;
- mixed Russian/Latin names;
- Ukrainian Cyrillic marker handling;
- OCR/scan noise;
- missing calories;
- missing macros;
- all-zero water exception;
- all-zero non-water reject;
- duplicate barcode;
- duplicate normalized name + brand;
- fixture-order duplicate behavior;
- per-100ml beverage reason;
- `candidate_ok` is not verified promotion;
- resolver does not invent Russian names from raw provider text.

Recommended future tests:

- non-food category;
- missing barcode;
- missing brand;
- negative nutrition;
- suspicious high nutrition;
- energy/macros mismatch exact classification;
- score range expectations;
- runner summary snapshot;
- generated JSON schema smoke test.

## Safety Assessment

Safety boundary is preserved:

- no Open Food Facts live API calls;
- no new data download;
- no API keys or secrets;
- no Supabase client usage;
- no SQL execution;
- no DB/import/staging/production mutation;
- no RLS policies/tests;
- no Premium writes;
- no diary runtime writes;
- no runtime app integration;
- no UI changes;
- no config/dependency changes;
- no new dependencies.

Search for network/DB indicators in `scripts/open-food-facts` found no fetch/axios/Supabase/client/runtime integration. URLs are fixture/provider provenance strings only.

## Required Fixes Before Commit

No required fixes before committing this local dry-run implementation package.

## Optional Improvements

Optional improvements before or after commit:

- label synthetic fixture rows and intentional duplicates;
- add exact tests once owner thresholds are accepted;
- tune brand-only/category-poor scoring so `святой-источник` does not keep a high overall score;
- decide whether multiple language/noise reasons should auto-reject severe rows;
- decide whether `per_100ml_needs_handling` should lower score or only classification;
- add non-food, negative nutrition, missing barcode, missing brand, and runner snapshot tests;
- make runner-generated verification lines fully reproducible if the generated report must include all check results.

## Verification

- `git diff --check`
  - Result: passed.
- `npx tsx --test scripts/open-food-facts/__tests__/offImportCleaner.test.ts`
  - Result: passed, 16 tests.
- `npx tsx scripts/open-food-facts/runOffImportCleanerDryRun.ts`
  - Result: passed after sandbox escalation for local `tsx` IPC; no API/DB/SQL/network work.
- `npm run build`
  - Result: passed, with existing Vite/Browserslist/chunk-size warnings.

## Final Recommendation

Commit the implementation and this review report as a local dry-run package.

Do not use the cleaner output for verified catalog import yet. Next step should be owner review of thresholds and example classifications, followed by either tuning or a larger local fixture/sample dry-run with the same no-DB/no-API safety boundary.

## Safety Confirmation

Confirmed for this review:

- review-only;
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

## Final Verdict

**OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION_REVIEW_READY**
