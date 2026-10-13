# P5-03B — oatmeal with apple source/content slice

Stacked from PR163 exact remote HEAD `dc3ed6e8bb4f0cfb0534b5d632dee0018856040c`.
Base branch: `codex/p5-03-cottage-cheese-apple-evidence`. Parent/master/recipe bytes
are unchanged. Owner selection is recorded separately from source review and issuance.

| Ingredient | Identity/state and evidence | Per100g source → POTOK | Mass/contribution | Readiness |
| --- | --- | --- | --- | --- |
| Apple | Parent accepted USDA SR27 NDB09003, raw with skin, core/stem excluded; exact parent package SHA and retained bindings | 52 kcal /0.26 protein /0.17 fat /13.81 total carbs /2.4 fiber → carbs11.41, calories unchanged | 120g after core/stem removal, added after cooking: 62.400 kcal /0.312 protein /0.204 fat /13.692 available carbs /2.880 fiber | APPLE_SOURCE_REUSED; source candidate only |
| Oat flakes | USDA SR28 (2015), NDB08120, generic plain regular/quick rolled oats, not fortified, dry; 100g edible, refuse0%; direct PDF/screenshot | 379 kcal /13.15 protein /6.52 fat /67.70 total carbs /10.1 fiber → carbs57.60, calories unchanged | 50g dry: 189.500 kcal /6.575 protein /3.260 fat /28.800 available carbs /5.050 fiber | OAT_SOURCE_READY_FOR_ISSUANCE_INPUT=true; no server evidence |
| Water | 200g cooking input; proposed existing approved_non_food path; real definition/evidence missing | No asserted zero nutrient values | confirmed nutrition contribution=null; mass input200g; retention unknown | WATER_COMPONENT_READY=false |

Food subtotal: **251.900 kcal, protein6.887g, fat3.464g, available carbs42.492g,
fiber7.930g**. This sums declared edible food inputs only. Water contribution and
complete recipe nutrition remain null; cooking losses or water retention are not
assumed. Input mass sum370g is not finished yield.

## Sources and mappings

[Official USDA SR28 breakfast cereal report](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg08.pdf),
PDF page764 (zero-based763), row08120. Exact title and rolled-oats synonyms identify
a generic dry reference, no brand/manufacturer in the row. QUAKER rows172989 and
other branded/flavored/cooked variants were excluded. Protein/fat/fiber means are
nonblank numeric (derivation A); carbohydrate/energy are calculated means (NC).
Do not interpret missing means or analysis counts as zero nutrients.

Retained excerpt and all exact byte lengths/SHA256/URLs/version/retrieval date are
in the JSON manifest. Hash covers the excerpt, not entire upstream PDF. Full PDF
hash is SKIP (not retained). USDA data are public domain; protected books not copied.

Apple parent package is pinned by SHA256 and parent HEAD, not duplicated as new
independent evidence. The parent policy `potok-source-total-including-fiber-to-available-v1`
requires explicit total-including-fiber, matching identity/state/basis/units and source
bindings, nonnegative exact subtraction. Oats67.70−10.1=57.60. Unknown semantics or
fiber rejects source readiness; no source calories recalculated by4/9/4.

## Water contract and coverage

Existing `curatedRecipePublicationV1.ts` authoring supports componentKind
approved_non_food, canonicalStatus NOT_APPLICABLE and approvedNonFoodEvidenceRef.
Compiler separately requires an assigned approvedNonFoodDefinitionId/componentId.
It also requires reviewed per-component nutrition evidence. None exists for this
real water ingredient. The typed path does not grant zero-nutrition approval itself.

`reviewedRuntimeRecipePublicationEvidenceV1.ts` requires exact food/nonFood bindings.
Manifest ingredientIds is sorted unique canonical FOOD UUIDs only; water definition
UUID must never enter that set. No real UUID is assigned here. Water contributes
input mass and preparation semantics; physical retention must be measured separately.
No food zero-macro ban or validator is changed; no food alias is created to bypass it.

## Future physical cooking protocol — NOT EXECUTED

PHYSICAL_COOKING_REQUIRED=true. Do not block food-source preparation on this,
but do block reviewed yield/portion revision until independent cooking review.

1. Record exact plain oat type/package and instructions; weigh dry oats50g,
   potable water200g, raw with-skin apple120g after core/stem exclusion. Tare vessel.
2. Record actual cooking time and method. Authored5–10min is provisional, not a
   validated universal range; test the actual oat type's instructions.
3. Weigh cooked oats without vessel, then weigh again after adding apple.
   Record evaporation/unserved residues rather than estimating retained water.
4. Record one authored serving, its measured mass and any remainder. No output
   measurement is supplied by this package.
5. Proposed measurement tolerance ±1g per weighing with1g-or-finer calibrated scale;
   record uncertainty and reject unexplained mass-balance deviation above combined
   uncertainty. Tolerance/protocol requires future culinary approval.

## Remaining gates and statuses

Canonical UUID/revisions, approval events/issuer authority, oat gluten cross-contact
and allergen review, dietary eligibility, culinary review, measured yield/serving,
portion policy, plan eligibility, typed manifest coverage and batch exporter remain
unfulfilled. Ordinary oats are not declared gluten-free. Parent trusted issuance
route remains a separate apply/auth/eligibility/all-writer/retention gated server task.
Two client reads are not a batch export; exporter is not implemented here.

| Status | Value |
| --- | --- |
| PILOT_SELECTED | true |
| APPLE_SOURCE_REUSED | true |
| OAT_SOURCE_READY_FOR_ISSUANCE_INPUT | true (source candidate scope) |
| WATER_COMPONENT_READY | false |
| SOURCE_DATA_READY_FOR_ISSUANCE_INPUT | false |
| PHYSICAL_COOKING_REQUIRED | true |
| CAN_ISSUE_REAL_REVIEWED_EVIDENCE | false |
| CAN_ASSEMBLE | false |

Nearest blocker and one next action: prepare approved water non-food definition and
zero-nutrition evidence/binding through existing review/publication boundary. Do not
invent approvals/IDs. No Supabase operations, cooking, runtime, generator or publish.
PLAN != FACT.
