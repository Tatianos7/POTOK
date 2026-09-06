# Open Food Facts RU Sample Audit

- Date: 2026-09-06
- Branch: `master`
- HEAD: `a37a2d6 user created food catalog candidates data model draft`
- Source Open Food Facts strategy: `reports/open-food-facts-license-and-import-strategy-2026-09-06.md`
- Source hybrid provider strategy: `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- Source candidate data model draft: `reports/user-created-food-catalog-candidates-data-model-draft-2026-09-06.md`
- Target package: `OPEN_FOOD_FACTS_RU_SAMPLE_AUDIT`
- Verdict: **OPEN_FOOD_FACTS_RU_SAMPLE_AUDIT_READY**

## Scope

Audit a small Open Food Facts Russia-market sample for POTOK: Russian display-name quality, language noise, Ukrainian/Polish/mixed-language risk, KBJU completeness, barcode/brand completeness, and suitability for a future import/review pipeline.

This is audit/report-only work. Runtime code was not changed, UI was not changed, config/dependency files were not changed, API clients were not added, Open Food Facts was not integrated into the app, API keys were not used, secrets were not read, import into POTOK DB was not performed, Supabase SQL was not executed, staging was not mutated, production was not touched, RLS behavior tests were not run, real table writes were not executed, service-role keys were not used, RLS policies were not changed, Premium write paths were not touched, diary runtime writes were not executed, and no PR/commit was created.

No product photos were downloaded or used.

## 1. Executive Summary

Open Food Facts RU/Russia data is useful for POTOK, but the sample confirms the owner concern: it is not clean enough to import directly into the verified catalog or show raw in product search.

Small sample result:

- Sample size: 25 Russia-market records from official Open Food Facts API v2.
- Strong automatic candidates after manual audit: 10 / 25.
- Needs review: 6 / 25.
- Reject from verified import: 9 / 25.

Main problems found:

- missing `product_name_ru`;
- Latin/English primary names;
- mixed Russian + Latin names;
- noisy/OCR-like names such as shelf/scan text;
- all-zero or missing KBJU;
- water products need special handling because all-zero can be acceptable only with explicit category review;
- brand/product-name mixing;
- product names that are Russian but too messy for POTOK display without cleanup.

Recommendation:

- Continue Open Food Facts evaluation, but only with strict filters and review pipeline.
- Use Open Food Facts as barcode fallback and import-candidate source, not as raw primary POTOK catalog.
- Do not import directly to verified catalog.
- Next best package: **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_PLAN_READY**.

## 2. Method

Official source used:

- Open Food Facts API v2 public search endpoint.
- Exact successful sample request:
  - `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=Russia&fields=code,product_name,product_name_ru,brands,countries,countries_tags,lang,languages,languages_tags,categories,categories_tags,nutriments,url&page_size=25&page=2`

Request properties:

- No API key.
- No app integration.
- Identifying audit User-Agent was sent.
- Narrow field list was used.
- No image fields requested.
- No DB writes.
- No import.

Sample size:

- 25 products.
- Russia/Russian Federation market/country preferred via `countries_tags_en=Russia`.
- Barcode preferred: all 25 returned records had `code`.
- Nutrition data preferred by post-audit classification, not by server-side filter.

Availability note:

- Attempts to fetch `page_size=100` and page 1 returned `503` during this audit window.
- One later retry returned DNS resolution failure.
- To avoid heavy usage, the audit used the one successful 25-record page and stopped.

Fields checked:

- `code`
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
- `nutriments.energy-kcal_100g`
- `nutriments.proteins_100g`
- `nutriments.fat_100g`
- `nutriments.carbohydrates_100g`
- `nutriments.fiber_100g`
- `url`

## 3. Fields Checked

Sample field availability:

- Barcode/code present: 25 / 25.
- Brand present: 23 / 25.
- `product_name_ru` present and non-empty: 19 / 25.
- `product_name_ru` missing/empty: 6 / 25.
- Complete calories/protein/fat/carbs per 100 g/ml: 22 / 25.
- Missing calories: 2 / 25.
- Missing macros: 1 / 25.
- Duplicate barcode inside sample: 0.

Important caveat:

- Some beverages use `100ml` rather than `100g`. For POTOK diary storage, the importer must normalize/display this carefully instead of pretending all source data is food-by-weight.

## 4. Language Quality Audit

Initial classification:

- `clean_ru_display_name`: 15 / 25.
- `no_product_name_ru`: 6 / 25.
- `mixed_language_noise`: 3 / 25.
- `Polish_or_Latin_primary`: 1 / 25.
- `Ukrainian_suspected`: 0 / 25 in this small sample.
- `Cyrillic_but_not_Russian`: 0 / 25 in this small sample.

Manual correction after human review:

- Several initially Russian-looking names should still be downgraded to `needs_manual_review` because they contain noisy words, brand-only structure, or product-name quality issues.
- Examples:
  - `актив цитрус смотка` contains scan/shelf-like noise.
  - `святой-источник` is too brand-only/category-poor.
  - `Agua aqua minerale без газа смотка на витрине` is mixed/noisy and not acceptable as POTOK display text.

Rule confirmed:

- Cyrillic alone must not mean Russian.
- Missing `product_name_ru` must block automatic verified import.
- Mixed Latin/Russian product names must go to review unless a clean Russian display name can be resolved.
- Ambiguous names should be reviewed, not accepted.

## 5. Nutrition Quality Audit

Nutrition classification:

- `nutrition_complete`: 21 / 25.
- `all_zero_kbju`: 1 / 25.
- `missing_calories`: 2 / 25.
- `missing_macros`: 1 / 25.
- `negative_or_non_finite`: 0 / 25.
- `suspicious_high_values`: 0 / 25 by broad threshold.
- `needs_nutrition_review`: at least 3 / 25 due missing calories/macros, plus special review for all-zero water.

Important nutrition findings:

- All-zero water can be legitimate but must not bypass generic all-zero blocking without category-specific review.
- One record had calories/protein/fat but missing carbohydrates per 100 g, which is not acceptable for automatic POTOK verified import.
- Two records had missing calories and missing macros.
- A beverage with `protein=20` and `calories=0` is suspicious in context and should be rejected/reviewed despite having numeric fields.

Recommendation:

- Candidate import should require complete per-100 g or clearly normalized per-100 ml nutrition.
- All-zero products should be rejected by default, with a reviewed exception path for water only.

## 6. Identity / Dedupe Audit

Identity findings:

- Barcode present for all sample records.
- Brand present for 23 / 25.
- Duplicate barcode inside this sample: none.
- Brand/name mixing appears in several records.
- Some names lack enough product type clarity.

Examples of identity issues:

- `MONARCH` has no brand and no nutrition; it is brand/title-only and unusable.
- `святой-источник` is brand-like, category-poor, and needs display-name cleanup.
- `молоко безлактозное parmalat comfort` mixes product and Latin brand/variant text.
- `Драже M&M...` has brand characters in the product name and missing carbs.

MVP dedupe assessment:

- Existing barcode checks and normalized name+brand checks are enough for a first dry-run.
- Fuzzy matching should be review suggestion only, not auto-merge.
- Existing POTOK canonical rows should win until review says otherwise.

## 7. Proposed Scoring

`language_score`:

- Raise when `product_name_ru` exists, is mostly Russian, has product type, and has no mixed-language noise.
- Lower when name is missing, Latin-primary, mixed script, Ukrainian/Polish/other-language suspected, brand-only, OCR-like, or generic.

`ru_display_name_score`:

- Raise when display name is clean, concise, user-facing, and separate from brand.
- Lower for packaging slogans, shelf text, OCR artifacts, category-only names, or raw provider fragments.

`nutrition_score`:

- Raise when calories/protein/fat/carbs are complete and reasonable per 100 g/ml.
- Lower for missing fields, all-zero, suspicious energy/macros mismatch, serving-only data, or implausible values.

`market_score`:

- Raise when `countries_tags` includes Russia and language/country signals align.
- Lower when Russia is only one of many countries and the primary name is non-Russian.

`duplicate_score`:

- Higher value should mean higher duplicate/conflict risk.
- Raise for duplicate barcode, normalized name+brand match, similar aliases, or conflicting nutrition for same identity.

`overall_quality_score`:

- Combine language, display-name, nutrition, market, and inverse duplicate risk.

Threshold proposal:

- `candidate_ok`: language >= 0.85, RU display >= 0.85, nutrition >= 0.85, market >= 0.75, duplicate risk <= 0.20.
- `needs_review`: any score in the ambiguous middle, mixed-language signals, missing brand for packaged food, water all-zero exception, or suspicious values.
- `reject`: no Russian display name, missing required nutrition, non-food/test/OCR placeholder, clear non-Russian primary name, severe nutrition conflict, or barcode/name impossible to trust.

## 8. Examples

### Good Candidate Examples

1. `4607035892370` — `Томатная паста`, brand `помидорка`.
   - Reason: clean Russian name, brand present, barcode present, complete nutrition.
   - POTOK action: candidate_ok for review/promotion.

2. `4600605033043` — `АктиБио с пробиотиками и злаками`, brand `АктиБио`.
   - Reason: clean Russian name, brand present, complete nutrition.
   - POTOK action: candidate_ok.

3. `4607004891373` — `Сыр творожный сливочный`, brand `Hochland`.
   - Reason: clean Russian product name, brand present, barcode present, complete nutrition.
   - POTOK action: candidate_ok.

4. `4601662000016` — `Молоко ультрапастеризованное 3,5 %`, brand `Parmalat`.
   - Reason: clear Russian product type, complete nutrition.
   - POTOK action: candidate_ok.

5. `4604248003517` — `Горчица «Русская»`, brand `Махеевъ`.
   - Reason: clean Russian name, brand present, complete nutrition.
   - POTOK action: candidate_ok.

### Needs Review Examples

1. `4600494696763` — `актив цитрус смотка`, brand `Aqua Minerale`.
   - Reason: Russian/Cyrillic text but contains noisy scan/shelf word `смотка`.
   - POTOK action: needs_language_review and display-name cleanup.

2. `4690329014077` — `Молочный шоколад Babyfox`, brand `Babyfox`.
   - Reason: mostly Russian but mixed Latin brand in display name.
   - POTOK action: needs_display_name_review; likely split brand from product name.

3. `4601662006162` — `молоко безлактозное parmalat comfort`, brand `parmalat`.
   - Reason: mixed Russian/Latin and lowercase raw display quality.
   - POTOK action: needs_language_review; proposed RU display name required.

4. `4603934000786` — `Вода питьевая "Святой Источник" негазированная`, brand `Святой Источник`.
   - Reason: all-zero KBJU, likely acceptable water but requires reviewed all-zero exception.
   - POTOK action: needs_quality_review, water exception only if category verified.

5. `4603934000977` — `святой-источник`, brand `Святой источник`.
   - Reason: brand-like display name without clear product type; calories 10 for water-like brand is suspicious.
   - POTOK action: needs_manual_review.

### Reject Examples

1. `4600680026671` — missing `product_name_ru`, brand `Хрутка`.
   - Reason: no Russian display name despite complete nutrition.
   - POTOK action: reject from verified import; may stay provider candidate only.

2. `4602481809156` — `Green milk almond`, brand `Green milk`.
   - Reason: no `product_name_ru`, Latin/English primary name.
   - POTOK action: reject automatic import.

3. `5449000054227` — `Coca-Cola Original Taste`, brand `Coca-Cola`.
   - Reason: no Russian display name; Latin primary.
   - POTOK action: reject automatic import or review only with owner-provided Russian display.

4. `4607001771753` — `MONARCH`, no brand.
   - Reason: Latin brand-only/title-only, missing calories/macros.
   - POTOK action: reject.

5. `4600494693335` — `Agua aqua minerale без газа смотка на витрине`, no brand.
   - Reason: missing `product_name_ru`, mixed/noisy text, suspicious nutrition pattern.
   - POTOK action: reject.

## 9. Proposed Import Decision Rules

`auto_reject`:

- no usable Russian display name;
- no `product_name_ru` and no reviewed Russian alias;
- missing calories or macros;
- all-zero KBJU, except reviewed water exception;
- non-food/test/OCR/placeholder;
- Latin/Polish/English primary name without reviewed Russian display;
- mixed-language garbage;
- impossible/suspicious nutrition conflict;
- duplicate barcode conflict that cannot be resolved.

`needs_language_review`:

- Cyrillic but not clearly Russian;
- Ukrainian/Belarusian/Bulgarian/Serbian/Kazakh suspected;
- mixed Russian/Latin name;
- brand in product display name;
- lowercase/noisy/OCR-like Russian text;
- missing `product_name_ru` but product may be relevant.

`needs_quality_review`:

- suspicious nutrition;
- water/all-zero exception;
- missing brand for packaged product;
- category absent;
- product type unclear;
- barcode conflict;
- duplicate normalized name + brand candidate.

`candidate_ok` requires:

- clean Russian display name;
- barcode for branded product;
- usable nutrition per 100 g/ml;
- no obvious duplicate conflict;
- acceptable Russia/RU market relevance;
- brand/product name can be separated cleanly.

`verified`:

- only after owner/admin review and promotion into POTOK verified catalog.

## 10. Impact On POTOK Architecture

Architecture alignment:

- Open Food Facts rows should enter only candidate/review pipeline.
- No direct verified catalog import.
- Provider provenance must be preserved.
- User-created private foods remain separate.
- Diary uses canonical/snapshot-safe path only after a candidate is converted into allowed private or verified food.
- Candidate rows are not diary sources.
- Historical diary entries are not recomputed.
- Premium uses only owner-approved verified foods.

Storage implication:

- The sample supports the planned `food_catalog_candidates` layer.
- A raw provider layer or file-backed sample layer should remain separate from verified `public.foods`.
- No raw provider names should become POTOK display names without resolver/review.

## 11. Risks Found In Sample

Dirty names:

- Several names contain messy or scan-like text.

Ukrainian/Polish/mixed-language:

- This sample did not show obvious Ukrainian, but did show mixed Russian/Latin and Latin-primary names.
- Owner's Ukrainian/Polish concern remains valid because Cyrillic/non-Russian cases are expected in broader data.

Missing nutrition:

- 3 / 25 records were missing calories or macros.

Duplicate identity:

- No duplicate barcode inside this sample, but brand/name normalization issues remain.

Bad brand parsing:

- Brand appears in product name for several products.
- Some records have no brand.

Low completeness:

- Missing categories and missing `product_name_ru` appear in the sample.

Attribution/ODbL:

- Any future stored provider-derived candidates need Open Food Facts provenance and attribution handling.

## 12. Recommendation

Continue Open Food Facts evaluation, but do not treat it as a clean catalog.

Recommended provider role:

- Use Open Food Facts as barcode fallback and candidate source, not as primary raw search.
- Build cleaner/dry-run before import schema apply.
- Keep strict RU display-name requirements.
- Keep all candidates out of verified catalog until owner/admin review.

Recommended filters:

- Require `product_name_ru` for automatic candidate_ok.
- Require barcode for branded packaged foods.
- Require complete calories/protein/fat/carbs.
- Reject or review mixed-language names.
- Reject raw Latin-primary names.
- Treat water/all-zero as a reviewed exception only.
- Hide dirty/non-Russian records from user-facing search by default.

## 13. Next Package Recommendation

Recommended next package:

- **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_PLAN_READY**

Why:

- The sample is useful enough to continue.
- The sample is not clean enough for direct import.
- A cleaner dry-run plan can define exact parser inputs, language heuristics, scoring, reject/review reasons, and sample report output before any DB writes.

Alternative:

- `OPEN_FOOD_FACTS_RU_SAMPLE_AUDIT_REVIEW_READY` if owner wants to visually review the 25 examples first.

Not recommended next:

- `USER_CREATED_FOOD_CATALOG_CANDIDATE_APPLY_READY_PATCH_PLAN`, because the candidate SQL draft is explicitly not apply-ready as-is and should wait for admin/RLS/lifecycle fixes.

## Safety Confirmation

Confirmed for this package:

- audit/report-only;
- no runtime code changes;
- no UI changes;
- no config/dependency changes;
- no API clients added;
- no Open Food Facts app integration;
- no API keys;
- no secrets;
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

**OPEN_FOOD_FACTS_RU_SAMPLE_AUDIT_READY**
