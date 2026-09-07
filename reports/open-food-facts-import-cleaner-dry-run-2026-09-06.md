# Open Food Facts Import Cleaner Dry Run

- Date: 2026-09-06
- Branch: `master`
- Source fixture: `scripts/open-food-facts/fixtures/ru-sample-2026-09-06.json`
- Cleaner: `scripts/open-food-facts/offImportCleaner.ts`
- Target package: `OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION`
- Verdict: **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION_READY**

## Scope

Run the local Open Food Facts RU/Russia fixture through the POTOK cleaner/scoring/classification rules. This was a local dry-run only: no API calls, no new data download, no Supabase client usage, no DB writes, no SQL execution, no runtime app integration, and no UI changes.

## Summary Metrics

- Total rows processed: 19
- `candidate_ok`: 4
- `needs_language_review`: 7
- `needs_quality_review`: 3
- `needs_duplicate_review`: 1
- `auto_reject`: 4

## Count By Reason Code

- `per_100ml_needs_handling`: 10
- `missing_product_name_ru`: 5
- `mixed_language_name`: 4
- `latin_primary_name`: 3
- `ocr_or_scan_noise`: 3
- `brand_only_name`: 2
- `missing_brand`: 2
- `missing_macros`: 2
- `category_only_name`: 1
- `duplicate_barcode`: 1
- `energy_macro_mismatch`: 1
- `missing_calories`: 1
- `suspected_non_russian_cyrillic`: 1
- `water_exception_needs_review`: 1

## Examples: candidate_ok

- `4607035892370` - Томатная паста, brand `помидорка`, reasons: `none`, overall: 0.95
- `4600605033043` - АктиБио с пробиотиками и злаками, brand `АктиБио`, reasons: `none`, overall: 0.95
- `4607004891373` - Сыр творожный сливочный, brand `Hochland`, reasons: `none`, overall: 0.95
- `4604248003517` - Горчица Русская, brand `Махеевъ`, reasons: `none`, overall: 0.95

## Examples: needs_language_review

- `4600494696763` - актив цитрус смотка, brand `Aqua Minerale`, reasons: `per_100ml_needs_handling, ocr_or_scan_noise`, overall: 0.68
- `4690329014077` - Молочный шоколад Babyfox, brand `Babyfox`, reasons: `mixed_language_name`, overall: 0.82
- `4601662006162` - молоко безлактозное parmalat comfort, brand `parmalat`, reasons: `mixed_language_name, per_100ml_needs_handling`, overall: 0.77
- `4603934000977` - святой-источник, brand `Святой источник`, reasons: `per_100ml_needs_handling, brand_only_name`, overall: 0.73
- `4600680026671` - Хрутка хлопья, brand `Хрутка`, reasons: `missing_product_name_ru`, overall: 0.55

## Examples: needs_quality_review

- `4601662000016` - Молоко ультрапастеризованное 3,5 %, brand `Parmalat`, reasons: `per_100ml_needs_handling`, overall: 0.9
- `4603934000786` - Вода питьевая Святой Источник негазированная, brand `Святой Источник`, reasons: `water_exception_needs_review, per_100ml_needs_handling`, overall: 0.8
- `4600000000002` - Вода с лимоном, brand `Тест`, reasons: `per_100ml_needs_handling`, overall: 0.9

## Examples: needs_duplicate_review

- `4607035892370` - Томатная паста, brand `помидорка`, reasons: `duplicate_barcode`, overall: 0.85

## Examples: auto_reject

- `4602481809156` - Green milk almond, brand `Green milk`, reasons: `missing_product_name_ru, per_100ml_needs_handling, latin_primary_name`, overall: 0.38
- `5449000054227` - Coca-Cola Original Taste, brand `Coca-Cola`, reasons: `missing_product_name_ru, per_100ml_needs_handling, latin_primary_name`, overall: 0.38
- `4607001771753` - MONARCH, brand `missing brand`, reasons: `missing_product_name_ru, missing_brand, category_only_name, brand_only_name, latin_primary_name, missing_calories, missing_macros`, overall: 0.2
- `4600000000003` - Драже M&M, brand `M&M`, reasons: `mixed_language_name, ocr_or_scan_noise, missing_macros`, overall: 0.47

## Top Noisy Names

- `4600494696763` - актив цитрус смотка, brand `Aqua Minerale`, reasons: `per_100ml_needs_handling, ocr_or_scan_noise`, overall: 0.68
- `4690329014077` - Молочный шоколад Babyfox, brand `Babyfox`, reasons: `mixed_language_name`, overall: 0.82
- `4601662006162` - молоко безлактозное parmalat comfort, brand `parmalat`, reasons: `mixed_language_name, per_100ml_needs_handling`, overall: 0.77
- `4603934000977` - святой-источник, brand `Святой источник`, reasons: `per_100ml_needs_handling, brand_only_name`, overall: 0.73
- `4602481809156` - Green milk almond, brand `Green milk`, reasons: `missing_product_name_ru, per_100ml_needs_handling, latin_primary_name`, overall: 0.38

## Nutrition Problems

- `4603934000786` - Вода питьевая Святой Источник негазированная, brand `Святой Источник`, reasons: `water_exception_needs_review, per_100ml_needs_handling`, overall: 0.8
- `4607001771753` - MONARCH, brand `missing brand`, reasons: `missing_product_name_ru, missing_brand, category_only_name, brand_only_name, latin_primary_name, missing_calories, missing_macros`, overall: 0.2
- `4600494693335` - Agua aqua minerale без газа смотка на витрине, brand `missing brand`, reasons: `mixed_language_name, missing_product_name_ru, energy_macro_mismatch, per_100ml_needs_handling, ocr_or_scan_noise, missing_brand`, overall: 0.28
- `4600000000003` - Драже M&M, brand `M&M`, reasons: `mixed_language_name, ocr_or_scan_noise, missing_macros`, overall: 0.47

## Water / All-Zero Exceptions

- `4603934000786` - Вода питьевая Святой Источник негазированная, brand `Святой Источник`, reasons: `water_exception_needs_review, per_100ml_needs_handling`, overall: 0.8

## Per-100ml Beverage Candidates

- `4601662000016` - Молоко ультрапастеризованное 3,5 %, brand `Parmalat`, reasons: `per_100ml_needs_handling`, overall: 0.9
- `4600494696763` - актив цитрус смотка, brand `Aqua Minerale`, reasons: `per_100ml_needs_handling, ocr_or_scan_noise`, overall: 0.68
- `4601662006162` - молоко безлактозное parmalat comfort, brand `parmalat`, reasons: `mixed_language_name, per_100ml_needs_handling`, overall: 0.77
- `4603934000786` - Вода питьевая Святой Источник негазированная, brand `Святой Источник`, reasons: `water_exception_needs_review, per_100ml_needs_handling`, overall: 0.8
- `4603934000977` - святой-источник, brand `Святой источник`, reasons: `per_100ml_needs_handling, brand_only_name`, overall: 0.73

## Owner Decision Checklist

- Confirm whether `product_name_ru` remains mandatory for `candidate_ok`.
- Confirm whether water/all-zero stays review-only.
- Confirm whether mixed RU/Latin names are always reviewed.
- Confirm barcode requirement for branded packaged products.
- Confirm provider provenance fields before candidate persistence.
- Confirm whether rejected rows remain report-only or need a reject-audit layer.

## Final Recommendation

The cleaner dry-run is useful enough to continue. The sample still shows why POTOK should keep Open Food Facts rows out of verified catalog until review/promotion. Next step: owner review of thresholds and examples, then a larger local dry-run if approved.

## Safety Confirmation

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

## Verification

- `npx tsx scripts/open-food-facts/runOffImportCleanerDryRun.ts`
  - Result: passed.

## Final Verdict

**OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION_READY**
