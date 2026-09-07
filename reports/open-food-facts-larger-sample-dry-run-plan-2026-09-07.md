# Open Food Facts Larger Sample Dry Run Plan

- Date: 2026-09-07
- Branch: `master`
- HEAD: `65ceb4a open food facts cleaner dry run tuning`
- Source cleaner tuning: `reports/open-food-facts-import-cleaner-dry-run-tuning-2026-09-06.md`
- Source tuning review: `reports/open-food-facts-import-cleaner-dry-run-tuning-review-2026-09-07.md`
- Source dry-run output: `reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md`
- Cleaner: `scripts/open-food-facts/offImportCleaner.ts`
- Target package: `OPEN_FOOD_FACTS_LARGER_SAMPLE_DRY_RUN_PLAN`
- Verdict: **OPEN_FOOD_FACTS_LARGER_SAMPLE_DRY_RUN_PLAN_READY**

## Scope

Plan a safe larger Open Food Facts RU/Russia sample dry-run for POTOK. The goal is to expand validation beyond the current 19-row local fixture and run a larger approved sample through the existing local cleaner without DB import, Supabase writes, runtime integration, user-facing search, or catalog promotion.

This is plan/report-only. Runtime app code was not changed, UI was not changed, config/dependency files were not changed, dependencies were not added, Open Food Facts app integration was not added, API clients were not added, live API calls were not made, new data was not downloaded, API keys/secrets were not used, Supabase client was not used, Supabase SQL was not executed, DB/import/staging/production were not touched, RLS behavior tests were not run, Premium write paths were not touched, diary runtime writes were not executed, and no PR/commit was created.

## 1. Executive Summary

A larger dry-run is needed because the current 19-row local fixture is useful for cleaner correctness, but too small for an owner decision about Open Food Facts as a practical POTOK candidate source.

The 19-row fixture proves that the cleaner can classify clean Russian products, mixed/noisy names, missing nutrition, duplicates, all-zero water, per-100ml beverages, and synthetic edge cases. It does not prove real-world rates across a broader RU/Russia sample.

Why 19 rows is not enough:

- language noise may be underrepresented;
- Ukrainian/Polish/non-Russian Cyrillic cases may be rare in a tiny sample;
- barcode and brand coverage may vary by category;
- per-100ml beverage handling may be overrepresented or underrepresented;
- duplicate/conflict rates need a larger set;
- reject/review workload cannot be estimated confidently.

Why DB import is still not allowed:

- Open Food Facts data remains noisy and externally sourced;
- the candidate SQL draft is not apply-ready as-is;
- provider provenance and ODbL/attribution rules need final storage decisions;
- cleaner thresholds still need owner review;
- pending provider rows must not enter public search, Premium, or diary flows.

Next safe step:

- owner approves a larger local/offline dry-run package;
- collect or prepare a narrow-field sample outside runtime only;
- run the existing local cleaner against that sample;
- generate markdown/JSON metrics and examples;
- review thresholds before any schema apply or import.

## 2. Recommended Sample Size

### Stage A: 100 Records

Goal:

- Validate that the tuned cleaner behaves reasonably on a broader but still small RU/Russia sample.
- Confirm whether the first 19-row baseline was unusually strict or unusually favorable.
- Find the most common review/reject reason codes.

Risks:

- Still too small for category-level conclusions.
- A single noisy page/source slice can distort percentages.
- Duplicate rates may remain artificially low.

Stop if:

- `auto_reject` is very high and owner already decides Open Food Facts should be barcode fallback only;
- language/noise issues are severe enough to require cleaner redesign;
- API/export access is unstable or too costly for safe sampling.

### Stage B: 300 Records

Goal:

- Estimate candidate/review/reject rates with more confidence.
- Surface more mixed-language, missing-KBJU, per-100ml, and brand/name parsing cases.
- Start estimating owner/admin review workload.

Risks:

- More examples may tempt premature import work.
- Manual review workload grows.
- Overfitting the cleaner to one provider sample is still possible.

Stop if:

- candidate_ok plus reviewable rows clearly justify a provider candidate pipeline;
- reject/noise rate clearly shows bulk import is not worthwhile;
- owner has enough evidence to choose barcode fallback only.

### Stage C: 1000 Records

Goal:

- Validate rates before any storage/import architecture decision.
- Stress reason-code distribution and runner output size.
- Identify category-specific rules such as water, milk, beverages, snacks, and dairy.

Risks:

- Requires stronger reproducibility and provenance notes.
- Review examples can become large.
- More external data retention raises ODbL/provenance governance needs.

Only proceed if:

- owner approves after Stage A or B;
- narrow fields and no-image rules are locked;
- dry-run output remains local and non-runtime;
- no DB/import/schema apply is planned in the same package.

Stop if:

- reason-code rates stabilize enough for an owner decision;
- cleaner needs redesign before larger samples;
- provider access/load concerns appear.

## 3. Data Source Options

### A. Official Open Food Facts API Limited Sample

Pros:

- Simple to collect a small bounded sample.
- Can request narrow fields only.
- Good for Stage A if rate/load is kept tiny.
- Easy to document exact query URL and retrieval date.

Cons:

- API availability can be unstable.
- Page ordering may change, reducing reproducibility.
- Live API sampling can accidentally grow into integration work if not fenced.

Safety:

- Use outside runtime only.
- Use no API keys.
- Use identifying User-Agent.
- Request narrow fields only.
- No images/photos.
- Save only local fixture/report artifacts.

Rate/load concerns:

- Keep request count minimal.
- Avoid search-as-you-type or repeated runtime requests.
- Stop on errors rather than retrying heavily.

Reproducibility:

- Record exact URLs, date, page/page_size, field list, and response count.
- Save local fixture used by the dry-run.

Legal/provenance notes:

- Preserve Open Food Facts URL/code/source in output.
- Treat stored fixture as provider-derived sample data.
- Do not mix with pure user-submission fixtures invisibly.

### B. Official Export/Dump Filtered Locally

Pros:

- Better for reproducibility and larger samples.
- Aligns with Open Food Facts guidance for larger data use.
- Avoids many small API calls.
- Enables deterministic local filtering.

Cons:

- Export files can be large.
- Requires a local filtering step.
- More retained provider data increases provenance/governance responsibility.

Safety:

- Use only outside runtime.
- Filter locally to narrow fields.
- No images/photos.
- No Supabase writes.
- No catalog import.

Rate/load concerns:

- Lower API load than many live requests.
- Download size and storage must be owner-approved before implementation.

Reproducibility:

- Record export URL, export date, checksum if practical, filter criteria, and sample seed/sort.

Legal/provenance notes:

- Keep source/provider metadata.
- Preserve ODbL/attribution planning.
- Avoid publishing derived catalog without legal decision.

### C. Manually Approved Local Fixture Expansion

Pros:

- Maximum safety and control.
- No live provider access in the implementation package if fixture is preapproved.
- Good for targeted edge cases and regression tests.

Cons:

- Not statistically representative by itself.
- Can overfit cleaner behavior to hand-picked examples.
- Requires clear labels for synthetic rows.

Safety:

- Local fixture only.
- Edge-case rows must be labeled with fixture metadata.
- No images/photos, secrets, user private data, or raw provider payload blobs.

Rate/load concerns:

- None during dry-run.

Reproducibility:

- Strong for regression behavior.
- Weak for real-world provider quality rates unless fixture source is documented.

Legal/provenance notes:

- Label synthetic rows separately from provider-sampled rows.
- Keep provider-derived rows traceable.

## 4. Recommended Approach

Recommended POTOK path now:

- Stage A with 100 records.
- Use an official API limited sample or a tiny owner-approved export-derived sample outside runtime.
- Use narrow fields only.
- Store the sample as a local fixture only after owner approval.
- Run the existing local cleaner.
- Generate markdown/JSON dry-run outputs.
- Review examples and thresholds before any next step.

Rules:

- no images;
- no photos;
- no API keys;
- no runtime app integration;
- no Supabase client;
- no DB writes;
- no SQL;
- no verified catalog import;
- output to local fixture/report only.

Preferred source choice:

- For 100 records: official API limited sample is acceptable if request count is tiny and documented.
- For 300+ records: prefer official export/dump filtered locally or an owner-approved local fixture derived from it.
- For 1000 records: use export/dump only after owner approval.

## 5. Fields To Collect

Collect only narrow fields:

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
- `nutriments.energy-kcal_100g`
- `nutriments.proteins_100g`
- `nutriments.fat_100g`
- `nutriments.carbohydrates_100g`
- `nutriments.fiber_100g`

Do not collect:

- image fields;
- product photos;
- user data;
- secrets;
- API keys;
- raw provider payload blobs beyond the approved narrow fixture shape.

## 6. Dry-Run Output Metrics

The larger dry-run should report:

- `candidate_ok` count and percent;
- `needs_language_review` count and percent;
- `needs_quality_review` count and percent;
- `needs_duplicate_review` count and percent;
- `auto_reject` count and percent;
- missing `product_name_ru` count and percent;
- Latin-primary names count and percent;
- mixed-language names count and percent;
- noisy/OCR-like names count and percent;
- suspected non-Russian Cyrillic count and percent;
- missing calories/macros count and percent;
- all-zero and water-exception count and percent;
- barcode present/missing count and percent;
- brand present/missing count and percent;
- duplicate barcode count and percent;
- duplicate normalized name + brand count and percent;
- per-100ml handling count and percent;
- top reject reasons;
- top review reasons;
- representative examples per bucket.

Output artifacts:

- markdown summary report;
- optional JSON summary and records;
- no DB rows;
- no public catalog rows.

## 7. Decision Thresholds

Proposed owner thresholds:

- Open Food Facts is useful as a candidate source if `candidate_ok + reviewable >= 60%`.
- Open Food Facts is promising for controlled import-candidate batches if `candidate_ok >= 20%` and `auto_reject <= 35%`.
- Open Food Facts is poor for bulk import if `auto_reject > 50%`.
- Open Food Facts should be barcode fallback only if clean `candidate_ok < 10%` or if review workload is too high.
- Open Food Facts should not be used for raw user-facing search if mixed/noisy/non-Russian rows remain common.

Definitions:

- `reviewable` = `needs_language_review + needs_quality_review + needs_duplicate_review`.
- `candidate_ok` still means candidate readiness only, not verified catalog approval.
- Owner/admin review is always required before verified catalog promotion.

Thresholds are decision aids, not automatic product rules.

## 8. Comparison With First Dry-Run

Current baseline:

- Total rows: 19
- `candidate_ok`: 4
- `needs_language_review`: 7
- `needs_quality_review`: 3
- `needs_duplicate_review`: 1
- `auto_reject`: 4

Baseline percentages:

- `candidate_ok`: about 21%
- `needs_language_review`: about 37%
- `needs_quality_review`: about 16%
- `needs_duplicate_review`: about 5%
- `auto_reject`: about 21%

The larger sample should confirm or challenge:

- whether clean RU candidate rate is really near 20%;
- whether language review is the largest bucket;
- whether per-100ml handling remains common;
- whether missing `product_name_ru` stays near the current level;
- whether duplicate barcode conflicts remain low;
- whether auto-reject stays manageable.

If Stage A differs sharply from the baseline, do not tune immediately. First check whether the sample source, categories, page selection, or fixture composition changed the distribution.

## 9. Safety Boundaries

Hard boundaries for the larger dry-run:

- no runtime search;
- no user-facing Open Food Facts results;
- no verified catalog import;
- no candidate persistence without approved storage plan;
- no Supabase writes;
- no Supabase SQL;
- no staging changes;
- no production changes;
- no RLS behavior tests;
- no photos/images;
- no Premium use;
- no diary writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout.

The dry-run output is evidence for owner review only.

## 10. Future Implementation Package

Recommended next package only after owner approval:

- `OPEN_FOOD_FACTS_LARGER_SAMPLE_DRY_RUN_IMPLEMENTATION_READY`

That package should:

- collect or use an owner-approved local sample;
- run the existing cleaner;
- generate markdown/JSON outputs;
- compare larger-sample metrics with the 19-row baseline;
- include examples by classification and reason;
- preserve all no-DB/no-runtime/no-import boundaries.

It should not:

- apply SQL;
- write to Supabase;
- add runtime Open Food Facts search;
- import provider rows into verified catalog;
- add photos;
- create Premium or diary writes.

## 11. Risks

API instability:

- Live API requests can fail, timeout, or return inconsistent pages.

Dirty language data:

- More rows will likely include missing Russian names, Latin-primary names, mixed names, OCR noise, or packaging fragments.

Non-Russian Cyrillic false positives:

- Ukrainian, Belarusian, Bulgarian, Serbian, Kazakh, and other Cyrillic text can pass weak Russian checks unless review remains strict.

Missing KBJU:

- Larger samples may expose more missing calories/macros or serving-only nutrition.

Water/per-100ml complexity:

- Beverage records may need product-specific volume handling before they can be useful in diary calculations.

ODbL/provenance:

- Provider-derived samples and outputs must remain traceable and legally separated from POTOK-owned data.

Overfitting:

- Cleaner tuning against small samples can produce misleading confidence.

Review workload:

- A high reviewable percentage may still be productively useful but operationally expensive.

## 12. Final Recommendation

Yes, POTOK should do a larger Open Food Facts dry-run, but only as a local/offline evidence-gathering step.

Recommended first larger sample:

- Stage A: 100 records.
- Use official API limited sample or a tiny export-derived sample outside runtime.
- Collect narrow fields only.
- No images/photos.
- No DB/import/Supabase/SQL.
- Output local fixture plus markdown/JSON dry-run reports only.

Success criteria for Stage A:

- `candidate_ok + reviewable >= 60%`;
- `candidate_ok >= 20%` or clear evidence that reviewable rows can become good candidates after owner cleanup;
- `auto_reject <= 35%` for controlled candidate-source viability;
- reason-code distribution is understandable and actionable;
- no safety boundary is crossed.

Forbidden before review:

- no verified catalog import;
- no Open Food Facts runtime search;
- no Supabase writes;
- no schema apply;
- no Premium/diary use;
- no product photos.

## Safety Confirmation

Confirmed for this package:

- plan/report-only;
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

- `git diff --check`
  - Result: passed.

## Final Verdict

**OPEN_FOOD_FACTS_LARGER_SAMPLE_DRY_RUN_PLAN_READY**
