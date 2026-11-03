# Recipe authoring test catalog and deferred cooking

## Owner decision, 2026-11-03

Physical cooking, actual yield and practical portions will be checked by the owner while testing the application before launch. They do not block ongoing coding and offline previews using existing authoring data. Earlier cooking instructions remain optional measurement protocols, not immediate tasks or prerequisites for all development. Unknown portions/yields stay unknown. Existing source NO-GO decisions, independent evidence requirements and launch acceptance are not waived.

## Implemented

`scripts/contracts/recipe-authoring-test-catalog-v1.ts` exports a separately versioned offline authoring input catalog. It reuses the master sheet reader and readiness observations. The seven-sheet source is never modified. It retains semantic recipe/child IDs, exact original rows, ingredients including optional unresolved rows, steps, tags, declared servings/yield and reference nutrients. It excludes explicit examples and rejects duplicate child IDs and orphan ingredients/steps/tags.

Reference nutrients already use the source's per-serving basis; the exporter does not divide them by recipe servings, derive recipe totals from them, reinterpret carbohydrate semantics, fill missing fiber with zero, derive cooked mass from ingredient sums, or issue UUIDs/evidence. Declared source yield is separate from `measuredYieldG:null`. Every recipe records deferred physical review and `runtimePublishable:false`. Source tags are not verified allergen/dietary restrictions. Full source content remains in the owner's exported artifact rather than the public repository.

Run:

```sh
node --import tsx scripts/contracts/recipe-authoring-test-catalog-v1.ts INPUT.xlsx > authoring-test-catalog.json
```

This command reads one file and prints JSON. It has no database, secret, publication or activation operation. It is not imported into the application or worker. `numericReferenceTestInputAvailable` only means positive declared servings, nonnegative finite numeric values in all five reference columns, some ingredients, and source status other than BLOCKED. It is not a safety, identity, meal completeness, calorie-target, source approval or publication decision.

## Actual source run

The unchanged `POTOK_recipe_master_v1_007(3).xlsx`, SHA-256 `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`, produces 132 real recipe records; two examples are excluded. Of these, 122 have complete numeric reference inputs for offline arithmetic, and ten retain explicit missing-data reasons. All 132 keep deferred physical review, without fabricated results. The two missing declared servings and 129 absent recorded yields remain absent.

The 122 reference inputs retain original primary meal categories: 35 BREAKFAST, 57 LUNCH, 29 SNACK and one DRINK. No DINNER primary category is present. A future test selection must use reviewed meal applicability or an explicit authoring test scenario rather than silently treating lunch as dinner. Missing candidate coverage is not fixed by changing production policies.

## Remaining work

This step prepares actual recipe content for offline test development. It does not run the trusted week selector on that content, create a runtime manifest, publish recipes, complete hosted account/Auth testing, or prove a real nutritional week. The existing strict worker requires independently admitted evidence; this exporter cannot supply it or bypass it. Future test-selection integration must preserve the distinct draft/reference provenance. Physical checks are deferred to prelaunch owner testing, while identity/nutrition/applicability preparation can continue now. No hosted data or historical diary snapshots were changed, and the generator remains inactive.
