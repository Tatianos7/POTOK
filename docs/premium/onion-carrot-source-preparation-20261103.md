# Onion and carrot source preparation, 2026-11-03

The latest found master workbook remains `POTOK_recipe_master_v1_007(3).xlsx`, SHA-256 `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`, 393790 bytes. A fresh scan still reports 132 real recipes, 730 ingredient rows, no APPROVED recipes, 729 UNRESOLVED and one AMBIGUOUS ingredient, no stable food bindings and 93 missing positive weights. The source workbook was not modified.

A fresh Staging read-only transaction found zero manifests, published manifests, entries and current heads. Exact ownerless core/brand name discovery found one onion and one carrot candidate, neither with all five nutrients. Name equality has not established a binding. Production was not queried.

## Prepared sources

Directly retrieved and visually checked the official [USDA SR28 vegetable report](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg11.pdf), SHA-256 `ecb7fc1f7c0613225fc381042454fe29e17a702ae96cfc3e51f5b756a7adb161`. The packet retains factual captures and exact record/page locators. These are generic raw edible references, not cooked meal nutrition or approval of retail products.

| Authoring group | Rows / recipes | NDB / PDF page | Energy kcal | Protein g | Fat g | Source total carbohydrate g | Fiber g | Candidate available carbohydrate g |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Лук репчатый | 40 / 40 | 11282 / 1139 | 40 | 1.10 | 0.10 | 9.34 | 1.7 | 7.640 |
| Морковь | 21 / 21 | 11124 / 448 | 41 | 0.93 | 0.24 | 9.58 | 2.8 | 6.780 |

All figures are per 100 g edible raw portion. Available carbohydrate candidates use the existing parent mapping and retained SR28 semantics: source total minus fiber. This does not issue food-specific mapping approval. Keep source energy. Workbook reference carbohydrate figures match total carbohydrate in 40 onion and 20 carrot rows; the tart carrot row has no comparable reference note. Do not silently update source notes, recipe totals, historical snapshots or canonical records.

The groups cover 61 rows across 45 distinct recipes, not 61 distinct recipes. All remain UNRESOLVED with no stable food ID. Onion weights are 50 g × 1, 80 g × 2, 100 g × 37; all use explicit raw edible grams. Carrot recorded weights are 100 g × 1, 150 g × 12, 200 g × 6, 250 g × 1, 500 g × 1. Twenty carrot rows explicitly identify raw edible weight. `carrot_ricotta_tart_ing_01` records two pieces and approximately 200 g, with no explicit raw edible basis. Its mass and applicability remain unconfirmed. Do not convert pieces to measured grams or apply refuse percentages again to already edible grams. No unit conversion was performed.

[Machine-readable preparation](retained-sources/onion-carrot-review-20261103/source-candidates-v1.json) is separate from independent reviewed evidence export and catalog publication. Cooking losses, yield, portions, allergens, dietary classification, composition and portion rules remain open. Source preparation does not make any complete recipe eligible for generation. Existing dairy NO-GO and the selected oatmeal pilot remain unchanged.

## Concrete owner measurements for the existing two pilots

Use the exact earlier [first review batch](retained-sources/first-batch-review-20261031/source-review-batch-v1.json). These measurements supply missing physical observations; they do not themselves approve sources or publication.

| Pilot | Declared inputs to check | Record after preparation |
| --- | --- | --- |
| Овсяная каша с яблоком (`oatmeal_with_apple`) | 50 g plain dry rolled oats, 200 g potable water, 120 g edible raw apple with skin after removing core/stem, added after cooking | Actual input masses and product details; cooking method/time; any discarded liquid or residue; finished edible mass without cookware; actual served masses and leftovers; whether the proposed single serving is practical |
| Груша с миндалём (`pear_almonds`) | 180 g edible fresh pear after removing core/stem, 20 g raw unsalted shelled almonds | Actual edible masses and pear skin state; final assembled mass; served masses/leftovers; whether the proposed single serving is practical |

Leave unknown results blank. Do not enter 370 g or 200 g as measured finished yield merely because those are sums of planned inputs. Neither pilot substitutes for a varied week. The egg candidates remain held for their raw/cooked reference conflict. No catalog publication, hosted writes or generator activation occurred.
