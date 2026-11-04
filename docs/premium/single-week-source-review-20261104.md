# One-week source review preparation, 2026-11-04

This step turns the existing offline reference week into a bounded review workload.
It neither publishes recipes nor supplies reviewed runtime evidence. Staging was
not queried or modified by this change. The generator remains inactive.

## Actual input and selection

Input: the existing `POTOK_authoring_test_catalog_20261103.json`, SHA-256
`517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0`.
It records workbook `POTOK_recipe_master_v1_007(3).xlsx`, SHA-256
`9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`.
The workbook was not re-exported or modified. Hashes identify supplied bytes, not
independent nutrition review, canonical identity or provenance admission.

Selection: the 24 distinct IDs already present in the owner's offline result
of 2026-11-03, section “Техническая цель 1600 ккал/день”. This is a technical
reference scenario, not the owner's nutritional target or a chosen runtime policy.
The preview's experimental LUNCH-as-DINNER assignment is not copied into allowed
meal types. Original primary categories remain BREAKFAST, LUNCH and SNACK.

| Observation in selected set | Count |
| --- | ---: |
| Recipes / ingredient rows | 24 / 120 |
| Complete numeric reference inputs | 24 |
| Source primary BREAKFAST / LUNCH / SNACK | 7 / 10 / 7 |
| Ingredient rows unresolved / without stable food IDs | 120 / 120 |
| Missing recorded ingredient grams | 6 |
| Missing declared servings | 0 |
| Missing recorded finished yield | 24 |
| Literal ingredient-name review groups | 58 |

Declared servings and complete reference numbers do not prove portions, nutrition
semantics, safety, composition eligibility or publication readiness. Cooking,
finished-yield measurement and practical portions remain deferred to owner testing
before launch, not prerequisites to continuing development.

## Reuse prepared candidates before collecting duplicates

These exact source labels cover 44 rows across 16 distinct selected recipes.
Their existing packets can be reviewed for applicability; name equality does not
bind any row, and the packets themselves are still unapproved source candidates.

| Literal source label | Rows / selected recipes | Existing preparation |
| --- | ---: | --- |
| Вода | 13 / 13 | [Salt/water candidates](retained-sources/salt-water-review-20261031/source-candidates-v1.json) |
| Масло оливковое | 13 / 13 | [Olive oil candidate](retained-sources/olive-oil-review-20261031/source-candidate-v1.json) |
| Лук репчатый | 8 / 8 | [Onion/carrot candidates](retained-sources/onion-carrot-review-20261103/source-candidates-v1.json) |
| Соль | 7 / 7 | [Salt/water candidates](retained-sources/salt-water-review-20261031/source-candidates-v1.json) |
| Морковь | 3 / 3 | [Onion/carrot candidates](retained-sources/onion-carrot-review-20261103/source-candidates-v1.json) |

The other 76 rows still need source preparation/applicability review. Existing
dairy NO-GO decisions remain in force; the four milk rows and yogurt/curd rows
cannot become eligible because their reference numbers are complete.

The six absent weights occur in two recipes:

| Recipe | Ingredient rows to review | Existing source quantities |
| --- | --- | --- |
| `rice_porridge_berries` | `_ing_02`, `_ing_03`, `_ing_06` | Water 300 ML, milk 400 ML, optional salt unknown |
| `oatmeal_pear_walnut` | `_ing_02`, `_ing_03`, `_ing_07` | Milk 300 ML, water 200 ML, optional salt unknown |

The source's approximate milk conversion is retained as a note, not executed.
ML is not silently replaced by grams. Optional salt is not dropped or changed to
zero. Water retention and ingredient state still require the existing typed
representation and quantity contracts; zero macros do not establish a nonfood
binding. No raw-input sum is promoted to measured cooked yield.

## Repeatable packet builder

`scripts/contracts/recipe-pilot-review-packet-v1.ts` reads catalog JSON and a
selection JSON (`potok-recipe-pilot-selection-v1`, matching `workbookSha256`,
nonempty `origin`, and 1–64 unique existing `recipeIds`). It rejects duplicate
JSON keys, duplicate/missing IDs, workbook mismatch and stale/copied observation
flags by rebuilding recipe observations from the original rows using the existing
authoring exporter. It preserves the full selected recipe, ingredient, step and
tag records. The existing name-only ingredient queue is reused without resolving
identity, combining quantities or losing optional rows and preparation notes.

The private packet retains every selected recipe and its review locations;
recipe bodies are not copied into this repository. All output stays explicitly
`runtimePublishable:false`, `mayActivate:false`. The CLI has only local file reads
and JSON stdout, no database or network capability. This is not a new publication
validator and is not imported by the app, Edge handler or worker.

Next work is independent ingredient/nutrition, allergen/dietary, portion,
composition/meal applicability and repeat-family evidence review, then a pinned
runtime publication export. Only after those sources exist can actual policies,
account-bound inputs and a concrete scoped Staging write package be prepared.
No placeholder request UUID, approval receipt or runtime manifest was fabricated.

Validation: 14 packet/exporter/queue tests passed, actual private catalog replay
succeeded, TypeScript and targeted ESLint passed. Tests cover quantity/optional
preservation, missing weights, different food states under equal names, input
immutability, selection coverage and forged observation rejection.
