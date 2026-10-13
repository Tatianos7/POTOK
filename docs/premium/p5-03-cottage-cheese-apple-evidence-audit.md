# P5-03 — cottage_cheese_with_apple evidence audit

Status at master `33462c398db761ba30ff59007b7a928338b34bf6`: **NO-GO**.

`CAN_ISSUE_REAL_REVIEWED_EVIDENCE = false`

`CAN_ASSEMBLE = false`

This is a read-only audit package, not evidence, issuance, a reviewed export, a
publication candidate or permission to publish. It neither changes nor supplements
the existing evidence contracts. No UUID, revision, digest, review, yield or authority
is inferred from a name, workbook flag or test fixture.

## Sources and contract status

| Source | Exact identity | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| `data/recipes/recipe-candidates-v1.json` | Git blob `b5c9216b73bf7b0ac2f9ccdcd83ade41238ff3a9`; SHA-256 `9045469af6af882d10c42ad8bb6dbb3fc8efb24e83f2aa833626ea8211d2d96c`; `stable_recipe_id=cottage_cheese_with_apple` | Authored candidate title, preparation, one serving, two semantic ingredient keys and gram amounts | Culinary review, reviewed recipe revision, output yield, portion mass, publication identity or eligibility |
| `data/food-core/Food_Core_v02_with_aliases.xlsx`, `foods_import` | Git blob `e157f83c2098adbcd2e06457d8fc1219b5818f87`; SHA-256 `d6f271958c41582f5e1c97d64befa4af28307379d364a20bdd99b228ba2f66a8`; metadata `Food Core Version=v02`, validator `PASS_WITH_WARNINGS` | Local source rows for `cottage_cheese_5_percent` and `apple`; four macros per 100 g | Runtime UUID identities, reviewed canonical/nutrition revisions, independently reviewed fiber, current catalog visibility or issuance |
| `reports/recipe-local-availability-2026-09-19.json` | Git blob `a6dd37a84d6b0f05bdb70cf11def5097fc5e9ff4`; SHA-256 `71bb7e6444717b7ccca30c5abd3b8b757755a5bfd96e705e5d6ccf1b587fc017` | Reproducible local arithmetic preview and prior strict rejection for invalid canonical identity | Reviewed evidence or publication; it explicitly records `publishable=false` and fiber `null` |
| `src/utils/foodReviewedEvidenceV1.ts` and its architecture document | Contracts `potok-canonical-food-reviewed-revision-v1`, `potok-nutrition-reviewed-revision-v1`, `potok-food-evidence-review-event-v1` | Strict canonical/nutrition revision and event shapes, retained-source coverage, digests and bindings | Issuance, reviewer authentication, persistence, current validity or real data. Phase 1 has no history reader |
| `src/utils/curatedRecipePublicationV1.ts` | `potok-curated-recipe-publication-v1` | Existing fail-closed authoring audit and candidate compiler | Persistent IDs, evidence, review or publication authority |
| `src/utils/reviewedRuntimeRecipePublicationEvidenceV1.ts` | `potok-reviewed-runtime-recipe-publication-evidence-v1` | Existing strict binding of a pinned reviewed source to manifest/composition/plan evidence | Reviewer authentication, evidence issuance, catalog lookup or publication |

Repository tests for these contracts use explicitly synthetic fixtures. They confirm
validator behavior only and are not real reviewed data.

The review-event contract provides immutable, digest-bound event representations and
models invalidation as a separate event. Master contains no Food Reviewed Evidence
persistence/history reader or issuer, so append-only storage and current event lineage
cannot be claimed from this implementation or from the candidate/workbook files.

## Pilot evidence matrix

| Required evidence | Exact observed value/source | Status | Missing or blocking gate |
| --- | --- | --- | --- |
| Recipe source and version | Candidate file/blob/hash above; provenance says POTOK-authored candidate `2026-09-18`, semantic check `2026-09-19`, live mapping and culinary review pending | Candidate only | No reviewed recipe export, recipe evidence reference, immutable recipe revision or independent culinary approval |
| Ingredients and masses | `cottage_cheese_5_percent` 150 g; `apple` 100 g | Present in authored candidate | Masses are not independently reviewed recipe evidence |
| Servings | `servings=1` | Present in authored candidate | Not independently reviewed |
| Total yield and serving mass | No fields in the authoritative candidate | Missing | 250 g is only the arithmetic sum of input masses. It is not claimed as finished yield or portion mass |
| Cottage cheese canonical identity | Workbook `id=canonical_food_id=cottage_cheese_5_percent` (semantic string), source row recorded as 679 | Blocked | Existing contracts require a current shared catalog UUID plus canonical reviewed revision/digest |
| Apple canonical identity | Workbook `id=canonical_food_id=apple` (semantic string), source row recorded as 1543 | Blocked | Existing contracts require a current shared catalog UUID plus canonical reviewed revision/digest |
| Cottage cheese nutrition per 100 g | kcal 121; protein 17.2 g; fat 5.0 g; carbs 1.8 g; fiber blank/null; workbook `nutrition_version=v1` | Reference only | Fiber is unknown. `v1` is not a UUID nutrition reviewed revision and no retained source/review event exists |
| Apple nutrition per 100 g | kcal 47; protein 0.4 g; fat 0.4 g; carbs 9.8 g; fiber blank/null; workbook `nutrition_version=v1` | Reference only | Fiber is unknown. `v1` is not a UUID nutrition reviewed revision and no retained source/review event exists |
| Canonical revisions | None for either product | Missing | Blocks canonical pointers, food bindings and manifest coverage |
| Nutrition revisions | None for either product | Missing | All five fields, including non-null independently sourced fiber, are required by `PER_100_G_EDIBLE` evidence |
| Review events | No real `REVIEW_APPROVED` event for either canonical or nutrition revision | Missing | No server-issued timestamp, retained source, event/revision binding, request digest or invalidation history |
| Reviewer/issuer authority | No real actor UUID, OWNER/ADMIN authority reference or server issuance verification | Missing | A literal authority context or a self-check cannot prove authority. The implemented decoder is representation only |
| Recipe reviewed export | None | Missing | No workbook revision, recipe/nutrition/allergen/dietary evidence refs or `REVIEWED` source package |
| Manifest ingredient coverage | Cannot be formed | Blocked | `ingredientIds` must be the sorted unique canonical UUID set. Semantic keys cannot substitute for UUIDs; non-food set is empty |
| Allergen/dietary evidence | Workbook labels cottage cheese with `lactose`; no reviewed recipe-level evidence refs | Blocked | Workbook text does not satisfy allergen/dietary review authorities |
| Portion and plan eligibility | No reviewed portion policy, immutable portion/eligibility revisions, composition eligibility or plan eligibility evidence | Blocked | Prevents manifest entry and Premium-plan assembly |

The local reference arithmetic is 228.5 kcal, 26.2 g protein, 7.9 g fat and
12.5 g carbs for the declared inputs. Fiber remains unknown. These numbers are a
source arithmetic preview, not reviewed recipe nutrition and not a publication claim.

## Existing validator result

`scripts/contracts/p5-03-cottage-cheese-apple-evidence.test.ts` reads the exact
candidate and workbook bytes, pins both SHA-256 values, preserves blank fiber as
`null`, and submits an honest unresolved projection to the existing
`auditCuratedRecipePublicationV1`/`compileCuratedRecipePublicationV1` path.

The existing gates report `BLOCKED`, including:

- `RECIPE_STATUS_NOT_REVIEWED` and `SOURCE_CONFLICT`;
- `FIBER_MISSING`;
- `CANONICAL_UNRESOLVED`, `CANONICAL_FOOD_ID_MISSING` and `CANONICAL_EVIDENCE_MISSING`;
- `PORTION_POLICY_MISSING`;
- `ALLERGEN_CONTRACT_BLOCKED` and `DIETARY_CONTRACT_BLOCKED`;
- missing publication identities, so recipe, portion, eligibility and manifest candidates remain `null`.

The reviewed-runtime decoder is **SKIP**, because no real reviewed package and no
independently pinned reviewed export exist. Constructing a self-consistent package
would fabricate the missing evidence.

## Decision and next action

No reviewed evidence can be issued and no manifest/plan content can be assembled
from current master data. This says nothing about readiness of the full plan or
Premium, and the candidate remains PLAN content rather than a FACT.

**One next action:** obtain an owner-provided real reviewed export for exactly
`cottage_cheese_5_percent` and `apple` through the existing Food Reviewed Evidence
v1 boundary. It must contain current canonical UUID/revision/digest bindings and
independently sourced `PER_100_G_EDIBLE` nutrition revisions with all five fields,
including fiber, plus retained sources and server-issued `REVIEW_APPROVED` events
whose OWNER/ADMIN authority references have been verified by the issuer. Audit that
export before recipe culinary/yield review or manifest assembly.
