# Open Food Facts Import Cleaner Dry Run Plan

- Date: 2026-09-06
- Branch: `master`
- HEAD: `857a622 open food facts ru sample audit`
- Source RU sample audit: `reports/open-food-facts-ru-sample-audit-2026-09-06.md`
- Source Open Food Facts strategy: `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- Source hybrid provider strategy: `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- Source candidate data model draft: `reports/user-created-food-catalog-candidates-data-model-draft-2026-09-06.md`
- Target package: `OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_PLAN`
- Verdict: **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_PLAN_READY**

## Scope

Plan a future Open Food Facts import cleaner dry-run for POTOK: how RU/Russia records should be cleaned, scored, classified, and reported before any database import or catalog promotion.

This is plan/report-only work. Runtime code was not changed, UI was not changed, config/dependency files were not changed, API clients were not added, Open Food Facts app integration was not added, API keys were not used, secrets were not read, new data was not downloaded, import into POTOK DB was not performed, Supabase SQL was not executed, staging was not mutated, production was not touched, RLS behavior tests were not run, real table writes were not executed, service-role keys were not used, RLS policies were not changed, Premium write paths were not touched, diary runtime writes were not executed, and no PR/commit was created.

## Sources Reviewed

- `reports/open-food-facts-ru-sample-audit-2026-09-06.md`
- `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- `reports/user-created-food-catalog-candidates-data-model-draft-2026-09-06.md`
- `src/utils/foodNormalizer.ts`

## 1. Executive Summary

Cleaner dry-run is needed because Open Food Facts can help POTOK replenish the product catalog, but the RU/Russia sample confirms that raw provider rows are too noisy for direct import.

The dry-run should answer owner/admin questions before schema apply or import:

- how many records can become strong candidates;
- how many need language, quality, or duplicate review;
- how many should be rejected before they reach the candidate queue;
- which fields and heuristics cause each decision;
- whether thresholds are too strict or too loose for POTOK's Russian catalog quality bar.

Open Food Facts must not be imported directly into the verified catalog because records can have missing `product_name_ru`, Latin/English primary names, mixed Russian/Latin names, OCR or shelf-scan noise, incomplete KBJU, all-zero products, brand/name mixing, and non-Russian Cyrillic risk.

Required output classes:

- `candidate_ok`
- `needs_language_review`
- `needs_quality_review`
- `needs_duplicate_review`
- `auto_reject`

This dry-run is the next step before schema/apply/import because it produces measurable thresholds and review examples without creating SQL, touching Supabase, adding API clients, changing runtime search, or exposing provider data to users.

## 2. Cleaner Input Contract

The future cleaner should accept a narrow, explicit Open Food Facts record shape.

Provider identity:

- `code` / barcode;
- `url`;
- optional provider metadata such as `source_provider`, `source_provider_product_id`, `provider_payload_hash`, `import_batch_id`, and `retrieved_at`.

Names and brand:

- `product_name`;
- `product_name_ru`;
- `brands`.

Market and language:

- `countries`;
- `countries_tags`;
- `lang`;
- `languages`;
- `languages_tags`.

Categories:

- `categories`;
- `categories_tags`.

Nutrition per 100 g/ml:

- `nutriments.energy-kcal_100g`;
- `nutriments.proteins_100g`;
- `nutriments.fat_100g`;
- `nutriments.carbohydrates_100g`;
- `nutriments.fiber_100g`.

MVP input rules:

- ignore image fields;
- do not require raw provider payload storage;
- preserve provider URL/id/code in dry-run output for traceability;
- treat missing optional fields as scoring/review signals, not parser failures;
- reject malformed numeric nutrition before candidate promotion.

## 3. Output Classification

### `candidate_ok`

Meaning:

- Record has clean Russian display name, usable barcode/brand identity, complete nutrition, Russia/RU market relevance, and no obvious duplicate conflict.

Allowed next step:

- Can be written later as a provider catalog candidate with `review_status='pending'` or `needs_review=false` equivalent after schema approval.

Catalog candidate:

- Yes, after approved data model and provenance rules.

User-facing search:

- Not raw. It can be shown only after review/promotion or inside a clearly labeled external fallback approved later.

Automatic promotion:

- No. Owner/admin review is still required before verified catalog visibility.

### `needs_language_review`

Meaning:

- Record may be useful but Russian display quality is uncertain.

Allowed next step:

- Route to review with language reason codes and proposed cleanup hints.

Catalog candidate:

- Yes, as a review candidate if provider provenance and retention are allowed.

User-facing search:

- Hide by default from normal user search.

Automatic promotion:

- No.

### `needs_quality_review`

Meaning:

- Record has nutrition, category, barcode, brand, or completeness concerns.

Allowed next step:

- Route to quality review; require owner/admin correction or rejection.

Catalog candidate:

- Yes, if data is retainable and the review queue can capture the reason.

User-facing search:

- Hide by default.

Automatic promotion:

- No.

### `needs_duplicate_review`

Meaning:

- Record may duplicate or conflict with an existing POTOK canonical product, alias, barcode, or same normalized name/brand.

Allowed next step:

- Route to duplicate/conflict review.

Catalog candidate:

- Yes, with `duplicate_score`, candidate links, and possible `duplicate_of_food_id` later.

User-facing search:

- Hide by default until merge/promotion.

Automatic promotion:

- No. No auto-merge.

### `auto_reject`

Meaning:

- Record is too incomplete, noisy, non-Russian, non-food, invalid, or unsafe for POTOK candidate import.

Allowed next step:

- Keep only aggregate dry-run stats and examples in the report unless retention is approved.

Catalog candidate:

- No for MVP import. It may remain in dry-run output only.

User-facing search:

- No.

Automatic promotion:

- No.

## 4. Russian Display Name Resolver

Display name priority:

1. Existing POTOK verified Russian name, if the row matches an existing canonical food.
2. Valid `product_name_ru`.
3. Reviewed Russian alias.
4. Owner/admin provided `ru_display_name`.
5. Otherwise reject or route to review.

Rules:

- Cyrillic alone is not enough.
- Ukrainian, Belarusian, Bulgarian, Serbian, Kazakh, and other Cyrillic text must not auto-pass as Russian.
- Latin, Polish, or English primary names must not become primary POTOK names.
- Mixed language names need review unless a clean Russian display name can be resolved.
- Brand should be separated from product name.
- Raw provider names must not become POTOK display names without scoring and review.
- `product_name_ru` is preferred, but still needs quality checks for scan text, category-poor names, and brand-only names.

Rejected or reviewed display-name cases should retain reason codes so owner/admins can tune the cleaner later.

## 5. Language / Noise Heuristics

The dry-run should define heuristic buckets, not a final hardcoded dictionary.

Script and language signals:

- Cyrillic/Latin character ratio;
- Latin-primary text;
- mixed Russian + Latin names;
- Ukrainian-specific letters, words, and patterns;
- Belarusian, Bulgarian, Serbian, Kazakh, and other non-Russian Cyrillic signals;
- Polish text markers and Latin words common in imported labels.

Provider text quality:

- OCR/scan/shelf words;
- placeholder/test/unknown names;
- all-caps noise;
- punctuation-heavy strings;
- emoji or garbage symbols;
- repeated words;
- too-short names;
- too-long packaging-like names.

Product-name quality:

- brand-only names;
- category-only names;
- product type absent;
- packaging slogans;
- promotional words;
- net-weight or shelf-label fragments;
- raw variant text mixed into the display name.

Future review list:

- maintain examples of false positives and false negatives;
- keep language markers in a reviewable config or helper, not scattered through importer code;
- store reason codes and sample names in dry-run reports so thresholds can be tuned by owner review.

## 6. Nutrition Cleaner Rules

Required for normal food candidates:

- calories are required;
- protein is required;
- fat is required;
- carbs are required;
- fiber is optional;
- values must be finite;
- values must be non-negative;
- all-zero KBJU is rejected by default.

Water exception:

- all-zero water can be legitimate;
- water/all-zero must become `needs_quality_review`;
- automatic pass requires reviewed water category rules later;
- generic all-zero blocking must remain the default.

Per-100 g/ml:

- `energy-kcal_100g`, `proteins_100g`, `fat_100g`, `carbohydrates_100g`, and `fiber_100g` can represent per-100 g or per-100 ml depending on Open Food Facts product context;
- the dry-run should explicitly label beverage/liquid rows that need per-100 ml handling;
- serving-only data is not enough for POTOK core diary calculations;
- the importer must not silently pretend all source values are weight-based if volume-based display is needed.

Suspicious values:

- energy/macros mismatch routes to `needs_quality_review`;
- suspicious high or low values route to `needs_quality_review`;
- current POTOK macro validation helpers should be reused later where applicable;
- candidate output should include the nutrition reason and raw values used for scoring.

## 7. Identity / Dedupe Rules

Identity rules:

- barcode is required for branded packaged products;
- missing brand should route to review unless the product is intentionally generic/core;
- brand and product display name should be normalized separately;
- brand text embedded in product name should create a cleanup signal.

Dedupe rules:

- duplicate barcode routes to `needs_duplicate_review`;
- normalized name + normalized brand match routes to `needs_duplicate_review`;
- existing POTOK canonical item wins until owner/admin review decides otherwise;
- alias matches create review suggestions only;
- fuzzy matching is a review hint, not an automatic merge;
- no provider row is auto-merged into verified catalog.

The dry-run should report duplicate conflicts separately from language and nutrition failures, because duplicate risk may be high even when the source row is otherwise clean.

## 8. Scoring Model

Recommended score fields:

- `language_score`;
- `ru_display_name_score`;
- `nutrition_score`;
- `market_score`;
- `duplicate_score`;
- `overall_quality_score`;
- `review_priority`.

`language_score` increases when:

- `product_name_ru` exists;
- name is mostly Russian;
- language/country tags support Russian/Russia relevance;
- no non-Russian Cyrillic or Latin-primary signals are present.

`language_score` decreases when:

- `product_name_ru` is missing;
- name is Latin/English/Polish primary;
- name has mixed script without a clean Russian resolver;
- Ukrainian or other non-Russian Cyrillic markers are suspected.

`ru_display_name_score` increases when:

- display name is concise, clean, user-facing, and product-type complete;
- brand can be separated cleanly;
- name has normal casing and no scan noise.

`ru_display_name_score` decreases when:

- name is brand-only, category-only, too short, too long, OCR-like, promotional, or packaging-heavy.

`nutrition_score` increases when:

- calories, protein, fat, and carbs are complete;
- values are finite, non-negative, plausible, and per-100 g/ml;
- fiber is valid when present.

`nutrition_score` decreases when:

- calories or macros are missing;
- all-zero KBJU appears;
- energy/macros mismatch is suspicious;
- serving-only values are present without per-100 g/ml values.

`market_score` increases when:

- `countries_tags` includes Russia/Russian Federation;
- language and country signals agree;
- product is relevant to POTOK's RU user base.

`market_score` decreases when:

- Russia is weakly indicated;
- primary display text is non-Russian;
- country/language/category signals conflict.

`duplicate_score` increases when:

- barcode matches an existing food/candidate;
- normalized name + normalized brand match existing data;
- aliases or fuzzy matches suggest collision;
- nutrition conflicts exist for same barcode/name.

`overall_quality_score`:

- combines language, display-name, nutrition, market, and inverse duplicate risk;
- should be used for triage, not automatic verified promotion.

Suggested thresholds:

- `candidate_ok`: `language_score >= 0.85`, `ru_display_name_score >= 0.85`, `nutrition_score >= 0.85`, `market_score >= 0.75`, `duplicate_score <= 0.20`;
- `needs_language_review`: language or display-name score is ambiguous, or mixed/non-Russian signal exists;
- `needs_quality_review`: nutrition, barcode, brand, category, or completeness score is ambiguous;
- `needs_duplicate_review`: duplicate score is above threshold or barcode/name conflict exists;
- `auto_reject`: missing usable Russian name, missing required KBJU, severe noise, non-food/test row, or invalid provider payload.

## 9. Reject / Review Reasons

Machine-readable reason codes:

- `missing_product_name_ru`;
- `latin_primary_name`;
- `mixed_language_name`;
- `suspected_non_russian_cyrillic`;
- `ocr_or_scan_noise`;
- `brand_only_name`;
- `category_only_name`;
- `placeholder_or_test_name`;
- `name_too_short`;
- `name_too_long`;
- `garbage_symbols`;
- `missing_barcode`;
- `missing_brand`;
- `missing_calories`;
- `missing_macros`;
- `all_zero_kbju`;
- `water_exception_needs_review`;
- `suspicious_nutrition`;
- `energy_macro_mismatch`;
- `per_100ml_needs_handling`;
- `serving_only_nutrition`;
- `duplicate_barcode`;
- `duplicate_name_brand`;
- `non_food_category`;
- `provider_payload_incomplete`.

Rules:

- each rejected/reviewed row should have at least one primary reason;
- secondary reasons should be preserved for analysis;
- reason codes should be stable enough for trend reports;
- owner-facing dry-run examples should include human-readable explanations.

## 10. Dry-Run Report Output

The future dry-run should produce a markdown report and optionally machine-readable CSV/JSON artifacts.

Summary metrics:

- total rows processed;
- accepted `candidate_ok` count;
- needs review count by bucket and reason;
- rejected count by reason;
- missing `product_name_ru` count;
- Latin/mixed-language count;
- suspected non-Russian Cyrillic count;
- nutrition completeness count;
- all-zero count;
- barcode present/missing count;
- brand present/missing count;
- duplicate barcode count;
- normalized name+brand duplicate count.

Example sections:

- examples for `candidate_ok`;
- examples for `needs_language_review`;
- examples for `needs_quality_review`;
- examples for `needs_duplicate_review`;
- examples for `auto_reject`;
- top noisy names;
- top duplicate conflicts;
- nutrition problems;
- water/all-zero exception candidates;
- per-100 ml beverage candidates.

Owner decision checklist:

- accept or adjust thresholds;
- confirm whether `product_name_ru` is mandatory;
- confirm water exception policy;
- confirm barcode requirement for branded packaged foods;
- confirm whether mixed RU/Latin names can be cleaned automatically or always reviewed;
- confirm whether provider candidates can be stored after ODbL/provenance review;
- confirm whether the next step is cleaner implementation or threshold review.

## 11. Relation To Candidate Data Model

The cleaner dry-run should map cleanly to the planned `food_catalog_candidates` model without applying SQL now.

Candidate fields supported by cleaner output:

- `source_type='open_food_facts'`;
- `review_status`;
- `review_reason`;
- `language_score`;
- `quality_score`;
- `nutrition_score`;
- `duplicate_score`;
- `ru_display_name`;
- `source_provider`;
- `source_provider_product_id`;
- barcode/provider code;
- provider URL/provenance.

Mapping:

- `candidate_ok` can become a candidate with low review friction after schema approval;
- `needs_language_review` maps to `review_status='needs_review'` with language reasons;
- `needs_quality_review` maps to `review_status='needs_review'` with nutrition/identity/category reasons;
- `needs_duplicate_review` maps to `review_status='needs_review'` with duplicate reasons and possible duplicate target hints;
- `auto_reject` should not become a persisted candidate in MVP unless owner asks for reject-audit storage.

Important constraints:

- do not apply SQL;
- do not change the existing SQL draft in this package;
- do not introduce raw provider payload storage now;
- keep provider-derived data distinct from pure user submissions;
- keep Open Food Facts provenance traceable for future ODbL/attribution work.

## 12. Relation To User-Facing Search

Cleaner output is not user-facing product search output.

Search rules:

- raw Open Food Facts output should not be shown as normal POTOK catalog;
- `candidate_ok` can appear in normal search only after review and promotion into verified catalog;
- external fallback should hide dirty, incomplete, non-Russian, and ambiguous records by default;
- users should see clean Russian display names only;
- provider/external results, if introduced later, must be clearly labeled.

Diary and Premium:

- candidate rows are not diary sources;
- diary adds continue through private user food or verified canonical food paths;
- Premium uses verified owner-approved catalog only;
- pending, rejected, unapproved, and raw provider candidates must not feed Premium content.

## 13. Later Implementation Plan

Future files, not created now:

- `scripts/off/importOpenFoodFactsCleanerDryRun.ts` or `scripts/open-food-facts/import-cleaner-dry-run.ts`;
- pure helper module for name/language/nutrition scoring if the script grows;
- fixtures under a test or script fixture directory, using small redacted/sample JSON;
- dry-run report output under `reports/open-food-facts-import-cleaner-dry-run-YYYY-MM-DD.md`;
- optional machine-readable output under `reports/open-food-facts-import-cleaner-dry-run-YYYY-MM-DD.json` or `.csv`;
- focused tests for pure cleaner helpers.

Implementation sequence later:

1. Build pure parser/normalizer helpers.
2. Add small local fixture from already approved sample or official export sample.
3. Implement dry-run classification with no DB writes.
4. Emit markdown and optional JSON/CSV output.
5. Review examples with owner.
6. Tune thresholds.
7. Only after owner approval, decide whether to draft apply-ready candidate schema or import pipeline.

Non-goals for the dry-run implementation:

- no Supabase writes;
- no provider integration in app runtime;
- no verified catalog import;
- no Premium writes;
- no photo download;
- no user-facing search changes.

## 14. Future Tests

Future cleaner tests should cover:

- clean `product_name_ru` with complete nutrition becomes `candidate_ok`;
- missing `product_name_ru` becomes review or reject according to policy;
- Latin primary name becomes `auto_reject`;
- mixed Russian/Latin name becomes `needs_language_review`;
- Ukrainian Cyrillic markers become review or reject;
- OCR/scan noise becomes review or reject;
- missing calories becomes `auto_reject`;
- missing protein/fat/carbs becomes `auto_reject`;
- all-zero water becomes `needs_quality_review`;
- all-zero non-water becomes `auto_reject`;
- duplicate barcode becomes `needs_duplicate_review`;
- duplicate normalized name + brand becomes `needs_duplicate_review`;
- per-100 ml beverage is handled explicitly;
- serving-only nutrition is rejected or reviewed;
- provider payload missing required fields becomes `provider_payload_incomplete`;
- reason codes are stable and machine-readable;
- `candidate_ok` is never treated as verified catalog promotion.

## 15. Risks And Open Questions

Risks:

- too strict filters may reject good products;
- too loose filters may pollute POTOK;
- language detection can create false positives and false negatives;
- Cyrillic text from Ukrainian, Belarusian, Bulgarian, Serbian, Kazakh, or other languages can slip through weak checks;
- ODbL attribution/provenance handling must be preserved;
- water/all-zero exceptions can weaken macro validation if not narrowly controlled;
- brand normalization can damage identity if brand and product names are merged incorrectly;
- review workload can grow quickly;
- noisy records can make user-facing search feel untrustworthy if exposed too early.

Open questions:

- Should `product_name_ru` be mandatory for `candidate_ok`, or can owner-reviewed aliases substitute?
- Should all water exceptions require owner/admin review forever, or can a narrow category rule auto-pass later?
- What exact duplicate threshold should move a row from `candidate_ok` to `needs_duplicate_review`?
- Should rejected rows be stored as aggregate stats only, or as persisted reject audit records?
- Should cleaner thresholds live in code, config, or an owner-editable review list?
- Which Open Food Facts provenance fields are mandatory before any stored candidate import?

## 16. Recommendation

Recommended next step:

- Commit this plan report.

Recommended following package:

- Build the actual Open Food Facts import cleaner dry-run script against a small approved local sample, with no DB writes and no app integration.

Alternative:

- Review thresholds and example buckets with owner before writing the cleaner script.

Do not proceed to schema apply, staging import, production import, or user-facing Open Food Facts search until the cleaner dry-run output is reviewed and the provider/candidate storage rules are approved.

## Safety Confirmation

Confirmed for this package:

- plan/report-only;
- no runtime code changes;
- no UI changes;
- no config/dependency changes;
- no API clients added;
- no Open Food Facts app integration;
- no API keys;
- no secrets;
- no new data download;
- no import into POTOK DB;
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

- `git diff --check`
  - Result: passed.

## Final Verdict

**OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_PLAN_READY**
