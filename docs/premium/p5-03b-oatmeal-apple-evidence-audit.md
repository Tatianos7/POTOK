# P5-03B — oatmeal with apple source/content slice

Stacked from PR163 exact remote HEAD `dc3ed6e8bb4f0cfb0534b5d632dee0018856040c`.
Base branch: `codex/p5-03-cottage-cheese-apple-evidence`. Parent/master/recipe bytes
are unchanged. Owner selection is recorded separately from source review and issuance.

| Ingredient | Identity/state and evidence | Per100g source → POTOK | Mass/contribution | Readiness |
| --- | --- | --- | --- | --- |
| Apple | Parent accepted USDA SR27 NDB09003, raw with skin, core/stem excluded; exact parent package SHA and retained bindings | 52 kcal /0.26 protein /0.17 fat /13.81 total carbs /2.4 fiber → carbs11.41, calories unchanged | 120g after core/stem removal, added after cooking: 62.400 kcal /0.312 protein /0.204 fat /13.692 available carbs /2.880 fiber | APPLE_SOURCE_REUSED; source candidate only |
| Oat flakes | USDA SR28 (2015), NDB08120, generic plain regular/quick rolled oats, not fortified, dry; 100g edible, refuse0%; direct PDF/screenshot | 379 kcal /13.15 protein /6.52 fat /67.70 total carbs /10.1 fiber → carbs57.60, calories unchanged | 50g dry: 189.500 kcal /6.575 protein /3.260 fat /28.800 available carbs /5.050 fiber | OAT_SOURCE_READY_FOR_ISSUANCE_INPUT=true; no server evidence |
| Water | USDA SR28 NDB14411 plain tap drinking, 100g edible; exact as-used potable identity below | Explicit source calories/protein/fat/total carbs/fiber all zero; mapped available carbs0 | 200g source-candidate zero contribution; approved contribution remains null; retention unknown | WATER_SOURCE_CANDIDATE_READY=true; WATER_COMPONENT_READY=false |

Food subtotal: **251.900 kcal, protein6.887g, fat3.464g, available carbs42.492g,
fiber7.930g**. This sums declared edible food inputs only. Approved water contribution and
reviewed recipe nutrition remain null; source-candidate water contribution is now explicitly zero; cooking losses or water retention are not
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
| WATER_SOURCE_CANDIDATE_READY | true |
| WATER_DEFINITION_CONTRACT_AVAILABLE | false (issuer contract absent; consumer representation exists) |
| WATER_COMPONENT_READY | false |
| SOURCE_DATA_READY_FOR_ISSUANCE_INPUT | false |
| PHYSICAL_COOKING_REQUIRED | true |
| CAN_ISSUE_REAL_REVIEWED_EVIDENCE | false |
| CAN_ASSEMBLE | false |

Nearest blocker and one next action: separate server-contract task implementing
non-food definition/evidence issuance, review/receipt/currentness/retention. There is
no existing non-food issuer to dispatch to. Do not
invent approvals/IDs. No Supabase operations, cooking, runtime, generator or publish.
PLAN != FACT.

## Water evidence follow-up

Exact working identity: ordinary as-used potable tap drinking water, without sugar
or additives, non-mineral, non-carbonated and unflavored. User label stays «Вода».
The internal approved_non_food type is a typed recipe representation; it does not
claim that water literally is not food. Source scope does not cover arbitrary bottled,
mineral, sparkling or flavored water, nor certify local water microbiological safety.

Official [USDA SR28 beverage report](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg14.pdf),
Release28(2015), PDF p752/zero-based751, NDB14411: **Beverages, water, tap, drinking (1)**.
Direct text and screenshot confirm Mean per100g edible: energy0kcal, protein0.00g,
fat0.00g, carbohydrate by difference0.00g, total dietary fiber0.0g. These are explicit
reported numeric values, not blank fields or Number of Data Points zeros. Report
codes are NC for energy/carbohydrate and BFZN for protein/fat/fiber; no claim of
new laboratory measurements is made. USDA's reported zeros are retained as given.
Parent carbs policy applies0−0=0, calories unchanged. Water at200g adds zero only
in the source-candidate calculation; published/approved contribution remains null.

FDC173647 was located as a secondary discovery lead, but official API access failed.
It is NOT the accepted identifier/publication context. The primary binding is NDB14411
in verified SR28, an allowed alternate official primary source. No unverified FDC
publication date/data type is invented. Retained UTF8 excerpt length/hash/URL/date
are in JSON; hash covers only excerpt. Full upstream PDF hash SKIP (not retained).

## Complete repository approved_non_food mechanism inventory

Search: rg of approved_non_food, approvedNonFoodEvidenceRef,
approvedNonFoodDefinitionId, nonFoodBindings plus case-insensitive nonfood/non-nutritive/
component-definition across all tracked project directories. Node_modules/git excluded.

| Location/use | What exists | What it does not establish |
| --- | --- | --- |
| src/utils/adaptiveNutritionGraphV1.ts:24,211 | Typed definition UUID in Graph ingredient, strict shape/UUID decode | No identity lookup, issuer, review, authority or currentness |
| src/utils/curatedRecipePublicationV1.ts:87,91,161,301,496,540 | Authoring nonfood variant, approval-ref requirement, assigned definition ID boundary and compiler projection | Does not mint/approve IDs or verify who issued a reference |
| src/utils/reviewedRuntimeRecipePublicationEvidenceV1.ts:21,85,101–115 | Required sorted unique nonFoodBindings, exact component/definition matching and food-only ingredientIds; pinned publication digest/source validation | A text ref is not auth or append-only history; no live definition reader |
| src/utils/__tests__/curatedRecipePublicationV1.test.ts and reviewedRuntimeRecipePublicationEvidenceV1.test.ts | Synthetic acceptance/rejection/missing/wrong-definition/food-namespace/mixed coverage tests | Fixtures cannot issue real water approval |
| docs/premium/reviewed-runtime-recipe-publication-evidence-v1.md:41–57; graph-v2-missing-authorities-design-v1.md:150 | Consumer design/typed evidence documentation | No approved issuance/storage/lifecycle implementation |
| scripts/contracts/P5-03/P5-03B and source/audit docs | Honest unresolved candidates/reference projections | No server artifacts |
| scripts/open-food-facts and catalog reports | non_food_category import rejection | Unrelated to recipe approved_non_food; not an issuer |
| supabase SQL and docs/premium/drafts | No matching nonfood definition issuer/table/event/receipt/current reader found | Cannot claim approval mechanism or authorize a caller |

**Only consumer representation/validators exist.** No dedicated server issuer,
trusted nonfood authority decision, immutable definition/evidence store, append-only
review history, receipt recovery/current reader, invalidation head or retention policy
was found. Current right to issue cannot be established. General FOOD issuer work
in parent Draft dependencies is not a nonfood definition issuer: food canonical
revisions cannot silently become nonfood definitions. Parent publication digests bind
supplied references but do not establish their provenance or live usability.

## Minimal separate server contract — design proposal, not implementation

- Input: strict duplicate-aware raw request; original idempotency key/canonical digest;
  exact water identity/exclusions/state/basis/units; all5 explicit values; retained
  source bytes/hash/mappings; policy version; expected definition head/revision/digest
  and review action. No caller-supplied approved status/actor/time.
- Authority: independently approve who may review/issue. Proposed reuse of existing
  verified owner/admin attestation/session boundary, without is_admin/client literals
  or new authority ledger. This permission design is not approved/implemented here;
  recheck expiry/revocation after locks and immediately before issuance.
- Immutable output: server-owned definition identity and separate evidence revision,
  canonical bytes/digest, exact source/policy binding, append-only approval/rejection/
  invalidation event, server timestamp and authority provenance. IDs minted only by
  authorized transaction; immutable historical revisions survive head changes.
- Receipt: atomic actor-scoped key+digest receipt bound to exact event/revision; same
  key+different payload conflicts. Lost response stays UNKNOWN; recover original
  receipt, never invent a replacement key or blind retry.
- Currentness: authenticated exact reader verifies current head, identity/state,
  source/revision bindings and invalidation/usability; publication must pin and
  recheck this authority in the same transaction as typed ingredient coverage.
- Atomicity: one deterministic lock order; CAS head; definition/evidence/event/receipt
  and head update commit or roll back together. Reject source drift, stale head,
  revoked authority, missing proof and mismatched namespace; no partial approval.
- Retention: owner-reviewed retention/erasure/access policy for retained sources,
  authority subjects, receipts and immutable history; no unreviewed cascade or
  permanent personal audit subject. Apply/auth/concurrency/rollback/UNKNOWN acceptance
  and owner approval remain separate prerequisites.

No parallel approval system or server implementation added. Physical cooking,
recipe/portion/safety/eligibility and batch exporter are not advanced. PLAN != FACT.
