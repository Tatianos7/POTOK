# Chicken, buckwheat and potato source preparation, 2026-11-04

Continues the selected one-week review packet in #310. This pass covers nine
ingredient rows across eight recipes, not all 120 selected rows. The original
workbook, catalog, private pilot packet and recipe nutrition remain unchanged.
No live database was read or written. The generator remains inactive.

Directly downloaded official USDA ARS SR28 reports and visually checked the Mean
columns of the exact records. The factual captures and source hashes are in the
[machine-readable preparation](retained-sources/chicken-buckwheat-potato-review-20261104/source-candidates-v1.json).
These are generic source facts and applicability observations, not independent
canonical evidence, review receipts, retail matches or a runtime publication.
The workbook's FDC numbers are retained only as unverified crosswalk claims;
this pass verified NDB records in SR28, not FDC-to-NDB identity.

| Authoring group | Rows | Source record / PDF page | Source applicability finding |
| --- | ---: | --- | --- |
| Грудка куриная без кожи | 3 | NDB 05062 / 22 | Recipe notes explicitly describe raw edible breast without bone/skin; textual description and reference macros match. Independent source/identity evidence still needed. |
| Крупа гречневая | 3 | NDB 20008 / 24 | Source title is Buckwheat. Recipes specify dry grams, but do not establish product form/roasting state. Keep blocked for that ambiguity. |
| Картофель | 3 | NDB 11352 / 1473 | Source is raw flesh and skin. Recipes specify raw edible grams, but do not establish skin status. Keep blocked for that ambiguity. |

## Source facts and carbohydrate distinction

All figures are per 100 g edible source portion, not cooked recipe totals.

| Source record | kcal | Protein g | Fat g | Source total carbohydrate g | Fiber g | Candidate available carbohydrate g |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| NDB 05062, raw boneless skinless breast | 120 | 22.50 | 2.62 | 0.00 | 0.0 | 0.000 |
| NDB 20008, Buckwheat | 343 | 13.25 | 3.40 | 71.50 | 10.0 | 61.500 |
| NDB 11352, raw potato flesh and skin | 77 | 2.05 | 0.09 | 17.49 | 2.1 | 15.390 |
| NDB 20009, roasted dry buckwheat groats, comparison only | 346 | 11.73 | 2.71 | 74.95 | 10.3 | 64.650 |

Candidate available carbohydrate uses the existing retained SR28 semantics and
parent mapping: source total minus fiber, once. This issues no food-specific
policy approval. Source energy is preserved. Authoring reference carbohydrate
values match source total in these rows; they must not be silently called
available carbohydrate. No recipe totals or historical snapshots were recomputed.

The separate roasted-dry buckwheat record is retained to make the ambiguity
reviewable, not as a replacement. Do not choose the record because its calories
are close. Dry grams alone do not distinguish the two product forms. Likewise,
do not select cooked-food values for raw chicken input grams or assume absence
of added solution in an unspecified retail product. The potato record's 25%
refuse description must not reduce recipe quantities already stated as edible.

## Exact row scope and next decisions

- Breast: `chicken_bulgur_zucchini_ing_01`,
  `chicken_breast_wholegrain_pasta_ing_01`,
  `chicken_roasted_beet_potato_ing_01`; each records 300 g.
- Buckwheat: `buckwheat_porridge_mushrooms_ing_01` (80 g),
  `turkey_buckwheat_ing_02` (140 g),
  `chicken_meatballs_buckwheat_ing_06` (120 g).
- Potato: `pollock_patties_mashed_potato_ing_02` (500 g),
  `chicken_roasted_beet_potato_ing_03` (400 g),
  `rabbit_potatoes_carrots_ing_02` (400 g).

All nine rows remain UNRESOLVED with no stable food ID, canonical UUID or review
receipt. Final reviewed source binding must establish the precise food state,
source provenance and nutrient semantics. Cooking retention, allergens/dietary
classification, portions, composition and repeat eligibility remain separate.
Physical cooking and measured yield are still deferred to owner prelaunch
testing; no result or extra cooking requirement is invented by this pass.

Primary reports:

- [Poultry](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg05.pdf), SHA-256 `9e5c8346c6b3ba60869d800f01eb07d5fdfc1f54f69ccc14575c4eced88ceaba`.
- [Cereal grains](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg20.pdf), SHA-256 `3b71f757854a58af57256864f144e4215a2f56da52fdc90bbd57360bfc234b05`.
- [Vegetables](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg11.pdf), SHA-256 `ecb7fc1f7c0613225fc381042454fe29e17a702ae96cfc3e51f5b756a7adb161`.

Regression checks pin factual captures/mapping bytes, source records/pages, row
coverage, raw quantities, state blocks, fiber subtraction and absence of runtime
approval. This source-only change does not alter any application runtime code.
