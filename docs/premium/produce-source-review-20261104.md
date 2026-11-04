# Produce source preparation, 2026-11-04

Seven USDA ARS SR28 source records were directly downloaded and visually checked
for eleven selected ingredient rows across ten recipes in #310's private pilot
packet. This pass does not cover all 120 ingredient rows or publish any recipe.
The original workbook, exported catalog and pilot packet remain unchanged.

The owner's recipe-specific buckwheat/potato clarification is retained separately
in [ingredient-state decisions](ingredient-state-owner-decisions-20261104.md) and
referenced by AGENTS.md. It supplies no universal food replacement or source
approval. The historical ambiguity observations in #311 are not overwritten.

## Checked source facts

Mean-column values per 100 g edible source portion. Available carbohydrate is a
candidate under the existing parent mapping, not an independently admitted food
policy. Source total carbohydrate and fiber remain distinct; energy is preserved.

| Exact source | PDF page | Rows | kcal | Protein g | Fat g | Total carbohydrate g | Fiber g | Candidate available carbohydrate g |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| NDB09040, raw banana | 147 | 2 | 89 | 1.09 | 0.33 | 22.84 | 2.6 | 20.240 |
| NDB11260, raw white mushrooms | 1046 | 2 | 22 | 3.09 | 0.34 | 3.26 | 1.0 | 2.260 |
| NDB11477, raw zucchini including skin | 1876 | 1 | 17 | 1.21 | 0.32 | 3.11 | 1.0 | 2.110 |
| NDB11205, raw cucumber with peel | 713 | 2 | 15 | 0.65 | 0.11 | 3.63 | 0.5 | 3.130 |
| NDB11529, raw red ripe tomato, year-round average | 2142 | 2 | 18 | 0.88 | 0.20 | 3.89 | 1.2 | 2.690 |
| NDB11080, raw beet | 226 | 1 | 43 | 1.61 | 0.17 | 9.56 | 2.8 | 6.760 |
| NDB02045, fresh dill | 6 | 1 | 43 | 3.46 | 1.12 | 7.02 | 2.1 | 4.920 |

For mushrooms, the source also lists adjusted protein 2.18 g. The existing
reference matches Protein (N x 6.25), 3.09 g. Both observations are retained;
adjusted protein is not substituted and no new protein methodology is approved.

## Applicability and quantity review

The banana rows explicitly use edible weight after removing skin. Zucchini and
one cucumber row explicitly include skin; beet uses raw peeled edible weight.
The mushroom rows describe raw edible white mushrooms and the dill row describes
fresh edible grams. Tomato references correspond to the source's generic red,
ripe average, not every cultivar or processed tomato product. These textual
observations still require independent identity/provenance admission.

`wholegrain_toast_hummus_cucumber_ing_03` says only raw edible cucumber and does
not establish peel status. Its candidate source is with peel, so the row remains
explicitly blocked on that distinction. `tvorog_cucumber_dill_ing_02` explicitly
states whole skin; its source preparation remains subject to independent review.
Equal labels/macros are never used to infer peel or approve a binding.

All eleven rows record G quantities equal to their stated positive gram values.
No source refuse percentage is deducted again from already edible recipe grams.
Raw values are not treated as cooked recipe nutrition, retained cooking amounts,
measured yield or practical portions. Workbook FDC-ID claims are not independently
crosswalked by this NDB-record check. Existing dairy/source NO-GO decisions remain.

The [source packet](retained-sources/produce-review-20261104/source-candidates-v1.json)
contains exact row IDs/quantities and preparation notes, source locators and
capture hashes. Each binding remains UNRESOLVED with null stable/canonical IDs
and review receipt. No full recipe bodies are added here. Allergens/dietary,
composition, portions and repeat eligibility remain separate required evidence.
Cooking/finished-yield checks stay deferred to owner prelaunch application tests.

Combined with #310's five previously prepared literal-label groups (44 rows)
and #311's exact nine rows, these eleven disjoint rows bring candidate-source
preparation reach to 64 of 120 selected rows across 20 of 24 recipes. The other
56 rows are outside those packets. This is preparation coverage by label or
listed row ID, not identity resolution, food-specific source approval, complete
recipe eligibility or publication readiness; all 120 canonical bindings remain
unresolved in the unchanged pilot input.

## Primary reports and validation

- [Vegetables](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg11.pdf), SHA-256 `ecb7fc1f7c0613225fc381042454fe29e17a702ae96cfc3e51f5b756a7adb161`.
- [Fruit](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg09.pdf), SHA-256 `e0b48c1df61eadc85d169203483deeb922ca77897c3e9887b471a8976746d12a`.
- [Spices and herbs](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg02.pdf), SHA-256 `a3671c827247adbcc806c7a3db05eed074c7ade10540dc01db70c47cbae9d6a4`.

Regression checks pin source captures/mapping, record/page locators, exact row
coverage, edible quantities, peel ambiguity, separate mushroom protein fields,
fiber subtraction and rejection by the runtime publication decoder. No app or
worker runtime code, live database, deployment or activation is changed.
