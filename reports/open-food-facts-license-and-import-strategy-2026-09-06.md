# Open Food Facts License And Import Strategy

- Date: 2026-09-06
- Branch: `master`
- HEAD: `f14a1ae food database hybrid provider strategy`
- Source hybrid strategy: `reports/food-database-hybrid-provider-strategy-2026-09-05.md`
- Source missing-food plan: `reports/missing-food-from-calorizer-flow-plan-2026-09-05.md`
- Target package: `OPEN_FOOD_FACTS_LICENSE_AND_IMPORT_STRATEGY`
- Verdict: **OPEN_FOOD_FACTS_LICENSE_AND_IMPORT_STRATEGY_READY**

## Scope

Prepare a report for using Open Food Facts in POTOK: license, reuse conditions, RU-only import strategy, language/noise filtering, attribution, and safe catalog replenishment.

This is report-only strategy work. Runtime code was not changed, UI was not changed, config/dependency files were not changed, API clients were not added, Open Food Facts API was not connected, no import was executed, no Supabase SQL was executed, staging was not mutated, production was not touched, RLS behavior tests were not run, secrets/API keys/JWTs were not collected, service-role keys were not used, RLS policies were not changed, Premium write paths were not touched, diary runtime writes were not executed, and no PR was created.

Official web research was performed only against Open Food Facts documentation/GitHub, Open Data Commons, and Creative Commons. No provider API calls were made.

## Official Sources Reviewed

- Open Food Facts API introduction: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Open Food Facts Terms and conditions of use and reuse: https://world.openfoodfacts.org/terms-of-use
- Open Food Facts data page: https://world.openfoodfacts.org/data
- Open Food Facts API source doc: https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/docs/api/index.md
- Open Food Facts CSV export field documentation: https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/html/data-fields.txt
- Open Food Facts research/licensing page source: https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-web/main/lang/en/texts/scientific-publications.html
- Open Data Commons ODbL summary: https://opendatacommons.org/licenses/odbl/summary/
- Open Data Commons ODbL legal text: https://opendatacommons.org/licenses/odbl/1-0/
- Open Data Commons DbCL legal text: https://opendatacommons.org/licenses/dbcl/1-0/
- Creative Commons BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/

## 1. Executive Summary

Open Food Facts is suitable for POTOK as an open provider and catalog replenishment source, but not as a raw runtime catalog that is shown directly to users.

Owner-friendly answer:

- Owner does not need to manually read the full license before the next product decision. This report extracts the product-relevant conclusions from official sources.
- Open Food Facts can be used commercially under the database/content license structure, but POTOK must handle attribution and ODbL share-alike obligations carefully.
- Open Food Facts can support gradual POTOK catalog growth, but only through a cleaned candidate/review pipeline.
- POTOK should not import or show everything. Open Food Facts is crowdsourced, and official docs explicitly warn that data can be inaccurate, incomplete, or unreliable.
- For POTOK, raw provider product names must not become trusted display names. RU-only import requires language, market, nutrition, duplicate, and moderation gates.
- Photos should be excluded from MVP unless image attribution, share-alike, product-label copyright, and UI requirements are designed.

Recommended direction:

- Use Open Food Facts first as an offline/sample audit source and later as a provider candidate source.
- Do not auto-promote external products into POTOK verified catalog.
- Import only normalized candidates with `needs_review=true`.
- Promote to verified catalog only after owner/admin review.
- Keep Premium Today / `Мой Поток` on owner-approved POTOK verified catalog only.

## 2. Where License Lives

Official places to know:

- Open Food Facts API docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Terms and conditions of use/reuse: https://world.openfoodfacts.org/terms-of-use
- Data exports page: https://world.openfoodfacts.org/data
- Database license: Open Database License, ODbL 1.0, https://opendatacommons.org/licenses/odbl/1.0/
- Database contents license: DbCL 1.0, https://opendatacommons.org/licenses/dbcl/1.0/
- Product image license: Creative Commons BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0/
- API usage form mentioned by Open Food Facts docs: linked from the API introduction.

Important official-source conclusions:

- Open Food Facts describes itself as open data reusable for any purpose.
- Official API docs state that the database is under ODbL, individual database contents are under DbCL, and product images are under Creative Commons Attribution ShareAlike.
- Official API docs require/recommend identifying API clients with a custom User-Agent and warn about rate limits.
- For more than a few hundred products, official API docs direct integrators to CSV/JSONL exports instead of heavy API fetching.
- Official docs recommend local Product Opener/custom backend plus daily exports for high-volume API traffic.

POTOK owner summary:

- The important license page is the Open Food Facts Terms page, but the actionable obligations are ODbL attribution/share-alike and CC BY-SA for images.
- Owner can rely on this report for product planning, but final legal launch should still get professional legal review if POTOK publishes a derivative Open Food Facts-based database.

## 3. License And Reuse

Database/data:

- Open Food Facts database is ODbL.
- Database contents are DbCL and must be used in compliance with ODbL.
- ODbL allows sharing, use, adaptation, and commercial use.
- ODbL requires attribution for public use.
- ODbL share-alike can require a publicly used derivative database to be offered under ODbL or a compatible license.
- If POTOK extracts/reuses a substantial part of Open Food Facts into a new cleaned database and publicly uses it, this may create derivative database obligations.
- A collective database may keep independent databases separate, but the ODbL-covered part remains under ODbL.
- Internal-only experiments do not trigger the same public share-alike publication obligation, but public app use can.

Commercial use:

- Commercial use is allowed by ODbL/DbCL, subject to compliance.
- Commercial use does not remove attribution/share-alike obligations.
- POTOK can use Open Food Facts in a paid app only if attribution and derivative database obligations are handled.

Local storage:

- Local storage is compatible with Open Food Facts' own recommendation for high-volume use via data exports/local backend.
- POTOK should store only fields it is prepared to attribute and, if required, release as the Open Food Facts-derived layer.
- If POTOK wants a proprietary internal verified catalog, Open Food Facts-derived rows must be separated from purely POTOK-owned rows unless legal review confirms the combined model.

Modified/cleaned database:

- POTOK may clean/transform Open Food Facts data, but a public derivative database can inherit ODbL share-alike obligations.
- Cleaning Russian names, normalizing brands, deduping, and adding scores can be an adapted/derivative database when based on a substantial Open Food Facts extraction.
- Safer model: keep Open Food Facts candidate/cache layer separate from POTOK-owned verified foods; promote only reviewed data with clear provenance and legal posture.

Mixing with proprietary POTOK data:

- Do not blend Open Food Facts-derived rows invisibly into proprietary POTOK catalog.
- Keep `provider=open_food_facts`, provider barcode/id/url, source payload hash, and import batch metadata.
- Keep POTOK-owned foods and Open Food Facts-derived candidate rows separable.
- Before public release of a merged derived catalog, decide whether the derived layer or alterations file must be published under ODbL.

Attribution:

- App/legal page should include: "Contains information from Open Food Facts, made available under the Open Database License (ODbL)."
- Link to Open Food Facts and ODbL.
- If Open Food Facts rows appear in search/detail, show a compact source badge or detail/source line.
- If using modified data, document that POTOK cleaned/normalized it and provide required derivative database or alteration-file access if legally triggered.

Images:

- Product images are CC BY-SA 3.0 and may include packaging/trademark/copyright elements.
- Images require attribution/share-alike handling and may involve other rights.
- Recommendation: exclude Open Food Facts photos from MVP import and use only text/nutrition/barcode fields first.

## 4. API Vs Data Dump

### A. Live API Lookup

Pros:

- Good for barcode fallback and one-off lookup.
- Fresh data.
- Lower initial storage work.
- No local bulk import before strategy is ready.

Cons:

- Rate limits apply.
- Search-as-you-type against Open Food Facts is discouraged by official docs.
- Performance depends on external service.
- Raw results can be noisy and multilingual.
- Requires custom User-Agent and API usage identification.

Cost/rate/performance:

- Read product requests and search requests have documented per-IP limits.
- Heavy use risks bans or throttling.
- Not suitable as the primary high-volume POTOK search backend.

Licensing implications:

- Still requires attribution.
- Caching/storing selected fields is allowed in principle under ODbL, but public derivative-database obligations must be handled if POTOK builds a substantial derived database.

Recommendation:

- Use later for barcode fallback only, behind a feature flag, not as the default search-as-you-type provider.

### B. CSV/JSONL Dump Import

Pros:

- Official docs recommend exports for more than a few hundred products.
- Enables offline cleaning, scoring, language filtering, and owner review.
- Avoids runtime dependency on live API.
- Better for controlled RU-only batches.

Cons:

- Requires import schema, storage strategy, and legal attribution/share-alike plan.
- Large data can include a lot of incomplete/multilingual/noisy rows.
- Needs dedupe and review tooling.

Cost/rate/performance:

- Better runtime performance after local processing.
- Avoids frequent API calls.
- Requires storage and batch pipeline costs.

Licensing implications:

- Stronger chance of creating an ODbL derivative database if substantial data is imported/cleaned and used publicly.
- Must keep provenance and be ready for attribution/share-alike compliance.

Recommendation:

- Best strategic path for catalog building, but start with a tiny offline sample audit and no DB writes.

### C. Hybrid: Dump/Import For Catalog + API For Barcode Fallback

Pros:

- POTOK-owned search remains fast and controlled.
- Open Food Facts API handles rare barcode misses.
- Dump/import supports review and catalog growth.
- Runtime can show clean POTOK results first.

Cons:

- More architecture and governance.
- Needs provider labels, cache TTL decisions, and legal documentation.
- Requires separate handling for API result, cache result, import candidate, private user food, and verified catalog food.

Cost/rate/performance:

- Good balance if API fallback is limited.
- Lower Open Food Facts load than live search.
- Better user experience than raw provider search.

Licensing implications:

- Same attribution/share-alike concerns, but easier to control if provider-derived layers are separated.

Recommendation:

- Recommended POTOK direction after manual missing-food flow and small RU sample audit.

## 5. RU-Only Import Strategy

Strict automatic candidate filters:

- `countries_tags` / market should include Russia / Russian Federation where available.
- Russian language fields are preferred.
- `product_name_ru` is required for automatic verified-catalog candidate eligibility.
- If `product_name_ru` is absent, the record goes to review or is rejected from verified import.
- Cyrillic text alone is not enough.
- Ukrainian, Belarusian, Bulgarian, Serbian, Kazakh, and other Cyrillic names must not be treated as Russian automatically.
- Polish/English/Latin names must not become the main POTOK display name.
- Non-Russian names can be stored only as aliases/review metadata if licensing and product policy allow.
- Branded products should require a real barcode.
- Nutrition facts must be present and usable.
- Exclude records without a usable Russian display name.
- Exclude non-food, incomplete, placeholder, OCR-like, and test-like records.
- Exclude names with obvious non-Russian language markers from automatic promotion.

Recommended import decision:

- `auto_reject`: no name, no barcode for branded item, no nutrition, all-zero nutrition, non-food category, placeholder/test row.
- `needs_language_review`: Cyrillic but not clearly Russian, mixed scripts, Ukrainian/Polish/English dominant name, missing `product_name_ru`.
- `needs_quality_review`: suspicious nutrition, duplicate barcode, conflicting brand/name, low completeness.
- `candidate_ok`: Russia-market product with valid `product_name_ru`, barcode, brand/name, nutrition, no duplicate conflict, and good quality score.
- `verified`: only after owner/admin review, never directly from raw import.

## 6. Non-Russian Cyrillic And Language-Noise Filter

Problem:

- Ukrainian names can be Cyrillic and visually close to Russian.
- Products sold in Russia can have Ukrainian, Polish, English, or mixed packaging names.
- Open Food Facts records can be multilingual, incomplete, OCR-derived, or user-entered.
- `product_name` can be the main language of the product, not necessarily Russian.
- POTOK must not trust raw `product_name` as a Russian display name.

Primary display name resolver:

1. Verified POTOK Russian name.
2. Valid `product_name_ru` from Open Food Facts.
3. Russian name from reviewed aliases.
4. Manual owner-reviewed Russian display name.
5. Otherwise reject from verified catalog or send to review.

Reject automatic promotion if:

- no `product_name_ru`;
- name contains Ukrainian-specific letters/words/patterns;
- name contains Belarusian/Bulgarian/Serbian/Kazakh-specific signals;
- name contains Polish or mostly Latin primary text;
- name is mixed-language garbage;
- name is mostly brand-only without product type;
- name is OCR/test/unknown placeholder;
- name conflicts with existing POTOK canonical item;
- name is generic category-only text such as "product", "unknown", "food", or untranslated label text.

Future heuristic categories, not final dictionaries:

- Script mix: Cyrillic/Latin ratios, punctuation density, OCR artifacts.
- Language markers: country-specific letters, common function words, endings, stop words.
- Name completeness: product type present, not just brand.
- Packaging noise: "new", "promo", "net weight", slogans, scan labels.
- Brand-vs-product split: brand extracted separately from product display name.
- Review reason: every rejection/review route should store the reason for owner/admin visibility.

## 7. Quality Filters

Nutrition gate:

- Calories/energy required.
- Protein/fat/carbs required for verified catalog candidate.
- All-zero KBJU blocked.
- Negative and non-finite values blocked.
- Suspicious high/low values go to review.
- Per-100 g fields preferred over serving-only fields.
- Serving size may be stored as metadata but should not replace per-100 g nutrition for core diary calculations.

Identity gate:

- Barcode required for branded packaged foods.
- Missing brand allowed only for generic/core foods after review.
- Duplicate barcode must go to conflict review.
- Duplicate normalized name + normalized brand should not auto-create a new verified row.
- Existing POTOK canonical item wins until review decides otherwise.

Content gate:

- Ingredients/additives optional for MVP.
- Product photos excluded from MVP unless image attribution/share-alike and rights handling are implemented.
- Low completeness and data quality warnings lower candidate score.

Score proposal:

- `quality_score`: overall import confidence.
- `language_score`: confidence that source/display language is Russian.
- `ru_display_name_score`: confidence that display name is clean and user-facing.
- `market_score`: confidence that product is relevant to Russia/RU users.
- `nutrition_score`: nutrition completeness/sanity.
- `duplicate_score`: risk of duplicate/conflict.
- `review_priority`: owner/admin triage ordering.

## 8. POTOK Storage Model

Future model, no SQL in this report:

- Raw Open Food Facts import table or file-backed sample layer.
- Normalized provider candidates.
- `provider='open_food_facts'`.
- `provider_product_code` / barcode.
- `provider_url`.
- `provider_payload_hash`.
- `provider_languages`.
- `provider_countries`.
- `original_provider_name`.
- `product_name_ru_raw`.
- `ru_display_name`.
- `ru_display_name_source`.
- `language_score`.
- `quality_score`.
- `market_score`.
- `nutrition_score`.
- `duplicate_score`.
- `needs_review`.
- `review_status`.
- `language_review_status`.
- `rejection_reason`.
- `promoted_to_canonical_food_id`.

Promotion model:

- Open Food Facts raw/candidate rows are not verified foods.
- Review can promote a candidate into POTOK verified catalog only after dedupe and language quality pass.
- The promoted food keeps source/provenance metadata.
- Diary entries continue to use the canonical/snapshot-safe path.
- Historical entries are not recomputed after provider corrections or promotion edits.
- Premium uses only verified, owner-approved catalog content.

ODbL separation:

- Keep Open Food Facts-derived candidate/cache layer separable from POTOK-owned data.
- If POTOK publishes a derivative database or produced work from a derivative database, prepare attribution and derivative database/alteration-file access as required.
- Do not mix Open Food Facts rows into proprietary catalog without a legal decision.

## 9. User-Facing Search Behavior

Recommended future search order:

1. POTOK verified catalog.
2. Current user's private foods.
3. Optional Open Food Facts fallback, disabled until licensing/import strategy is operational.

Search UX:

- External results clearly labeled as Open Food Facts/external.
- Dirty/incomplete/non-Russian records hidden by default.
- Ukrainian/Polish/noisy names are not shown as normal POTOK products.
- If external result is selected, save through allowed candidate/private flow.
- Raw provider name can be shown only as secondary source metadata, not as the primary POTOK display name.
- User should see clean Russian display names or no result.

Selection behavior:

- If result is promoted/verified: add through normal POTOK canonical diary path.
- If result is external but acceptable: create a provider candidate/private user food according to approved rules, then add through canonical/snapshot-safe path.
- If result lacks clean Russian name or nutrition: send to review or ask user to add manually.

## 10. How To Make It Clean For POTOK

Concrete cleanup system:

- Russian display name resolver with strict source priority.
- Brand normalization independent from product display name.
- Alias handling for non-primary names.
- Language priority and language rejection reasons.
- Moderation queue with owner-approved import batches.
- Blacklist/ignore rules for recurring bad names, categories, and providers fields.
- Canonical dedupe by barcode, normalized brand/name, aliases, and existing stable IDs.
- Barcode conflict review before promotion.
- Quality dashboard for candidate batches.
- Sample audit before import.
- No "import everything" mode.

Import batch rules:

- Start with a small Russia/RU sample.
- Report counts by accept/review/reject reason.
- Show examples of accepted, rejected, and ambiguous rows.
- Owner reviews examples before schema/import work.
- Promotion rules are tightened before any staging import.

## 11. Risks

ODbL/share-alike:

- A cleaned Open Food Facts-based database publicly used by POTOK can trigger ODbL share-alike and access obligations.

Attribution:

- Missing or hidden attribution can violate reuse conditions and harm trust.

Dirty data:

- Crowdsourced records can be wrong, incomplete, duplicated, or stale.

Duplicate identity:

- Same barcode/name can appear with conflicting brands, languages, or nutrition.

Wrong language names:

- Cyrillic does not equal Russian.
- Ukrainian Cyrillic, Polish/Latin names, OCR garbage, and mixed labels can slip through weak filters.

Images licensing:

- Product photos add CC BY-SA attribution/share-alike complexity and packaging rights risk.

Premium contamination:

- Raw provider products must not enter Premium plans or recipe content.

User trust:

- Showing messy provider names as normal POTOK products would make the product feel unreliable.

## 12. Recommended Roadmap

Phase 1: license/import strategy report.

- Finalize this report.

Phase 2: small sample audit of RU products, no DB write.

- Download/use only an offline sample from official export or documented source.
- Produce a report with language/quality/reject examples.

Phase 3: import schema draft, no apply.

- Draft candidate/cache schema and ODbL separation fields.

Phase 4: offline cleaner script dry-run.

- Build local parser/normalizer against sample files only.
- No Supabase writes.

Phase 5: language/noise filter dry-run.

- Score `product_name_ru`, raw names, countries, brands, barcode, and nutrition.

Phase 6: owner review report of sample.

- Owner approves or rejects examples and thresholds.

Phase 7: staging import candidates.

- Only after approval, SQL draft/review, and staging plan.

Phase 8: promotion rules to POTOK verified catalog.

- Promote reviewed candidates only.

Phase 9: user-facing search fallback.

- Add Open Food Facts fallback only after attribution, provider labels, cache/rate limits, and product UX are ready.

## 13. Decision Points For Owner

Owner decisions needed:

- Use Open Food Facts as primary open provider or only barcode fallback?
- Require `product_name_ru` for verified catalog candidates?
- Allow non-Russian aliases as hidden/review metadata?
- Exclude photos from MVP?
- Where to show Open Food Facts attribution in app/legal page?
- How to handle ODbL derivative database obligations?
- Start with Russia-only sample size: 100, 500, or 1000 products?
- Should every promoted Open Food Facts-derived product require owner approval, or can high-score batches be reviewed by exception later?
- Should user-selected external results become private user foods by default, or only provider candidates?

## 14. Final Recommendation

Recommended answer to owner:

- Yes, Open Food Facts can be useful for POTOK.
- No, owner does not need to read the whole license herself before deciding direction; this report captures the official-source implications.
- Do not connect it directly as raw product search.
- Do not import everything.
- Do not use photos in MVP.
- Do not auto-save Open Food Facts products into POTOK verified catalog.
- Start with a small RU-only offline sample audit.
- Require clean Russian display names for verified candidates.
- Treat Cyrillic-but-not-Russian, Polish, English, mixed, incomplete, and suspicious rows as review/reject.
- Keep provider-derived data separated, attributed, and legally traceable.
- Promote only reviewed, deduped, nutrition-valid products into POTOK verified catalog.

## Safety Confirmation

Confirmed for this package:

- report-only;
- no runtime code changes;
- no UI changes;
- no config/dependency changes;
- no API clients added;
- no external provider connection;
- no Open Food Facts API calls;
- no import executed;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no real table reads;
- no secrets/API keys/JWT collection;
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
- no PR.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**OPEN_FOOD_FACTS_LICENSE_AND_IMPORT_STRATEGY_READY**
