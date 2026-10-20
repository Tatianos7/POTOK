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
| `docs/premium/retained-sources/p5-03/source-review-package-v1.json` | Status `SOURCE_DECISIONS_RECORDED_DATA_INCOMPLETE`; exactly two products; retrieval date `2026-10-13` | Pinned primary-source locators, versions, field mappings, retained excerpt byte lengths and SHA-256 | Owner approval, server authority, runtime identities/revisions/events or a complete cottage-cheese nutrition source |
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

## Primary-source package prepared for review

The owner-review card is
[`p5-03-cottage-cheese-apple-owner-review.md`](p5-03-cottage-cheese-apple-owner-review.md).
Its source decisions are recorded; issuance remains incomplete; it contains no runtime UUID, artificial event,
authority claim or server timestamp.

| Product | Primary source and retained bytes | Proposed exact state/basis | Source facts kcal / protein / fat / total carbs / fiber | Difference from Food Core v02 | Result |
| --- | --- | --- | --- | --- | --- |
| `apple` | USDA National Nutrient Database SR Release 27, NDB 09003; [official report](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR27/reports/sr27fg09.pdf); retained excerpt 318 bytes, SHA-256 `89d79388d19e3013fb7975d67c6a6cf5b4e42cad58fe6fb8fb08c2d81befaaca` | `raw`, with skin; core and stem excluded; explicitly 100 g edible portion | 52 kcal / 0.26 g / 0.17 g / 13.81 g / 2.4 g | +5 kcal / −0.14 g protein / −0.23 g fat / +4.01 g carbs / source supplies 2.4 g where workbook is `null` | Accepted source; mapped available carbs 11.41 g; not issued |
| Separate branded example, excluded from generic `cottage_cheese_5_percent` | Угличский сыродельно-молочный завод, [product page](https://www.usmz.ru/products/iz-uglicha/tvorog-5-iz-uglicha/); retained excerpt 416 bytes, SHA-256 `6c7d87dc89ab8e1eae9be9ff5e105e467069724c66887ce4d60ac8afb2f1dae7` | proposed `as-sold`; exact 5% fat; 100 g product applies to the entire edible as-sold curd contents, excluding packaging; proposed applicability pending review | 121 kcal / 16.0 g / 5.0 g / 3.0 g / `null` | same kcal and fat / −1.2 g protein / +1.2 g carbs / fiber remains `null` | Incomplete and identity-disputed: branded product cannot silently replace generic core identity; branded example only, not generic evidence |

Generic proposed nutrition remains entirely null. Manufacturer numbers above are branded source facts only.

The SHA-256 values bind the exact retained UTF-8 excerpts in this branch. They are
not represented as hashes of the upstream HTML/PDF. Full upstream-document download
and hash were unavailable in this workspace and are therefore **SKIP**, not evidence.
USDA states that FoodData Central data are public domain/CC0; the manufacturer excerpt
is limited to the short product identity and label facts needed for review.

## Pilot evidence matrix

| Required evidence | Exact observed value/source | Status | Missing or blocking gate |
| --- | --- | --- | --- |
| Recipe source and version | Candidate file/blob/hash above; provenance says POTOK-authored candidate `2026-09-18`, semantic check `2026-09-19`, live mapping and culinary review pending | Candidate only | No reviewed recipe export, recipe evidence reference, immutable recipe revision or independent culinary approval |
| Ingredients and masses | `cottage_cheese_5_percent` 150 g; `apple` 100 g | Present in authored candidate | Masses are not independently reviewed recipe evidence |
| Servings | `servings=1` | Present in authored candidate | Not independently reviewed |
| Total yield and serving mass | No fields in the authoritative candidate | Missing | 250 g is only the arithmetic sum of input masses. It is not claimed as finished yield or portion mass |
| Cottage cheese canonical identity | Workbook `id=canonical_food_id=cottage_cheese_5_percent` (semantic string), source row recorded as 679 | Blocked | Existing contracts require a current shared catalog UUID plus canonical reviewed revision/digest |
| Apple canonical identity | Workbook `id=canonical_food_id=apple` (semantic string), source row recorded as 1543 | Blocked | Existing contracts require a current shared catalog UUID plus canonical reviewed revision/digest |
| Cottage cheese nutrition per 100 g | Food Core: 121/17.2/5.0/1.8/`null`; manufacturer: 121/16.0/5.0/3.0/`null` | Branded example excluded from generic mapping | Generic nutrition is null; fiber/basis provenance for a complete generic row is missing. `v1` is not a reviewed revision |
| Apple nutrition per 100 g edible | Food Core: 47/0.4/0.4/9.8/`null`; USDA SR27 NDB 09003: 52/0.26/0.17/13.81/2.4 | Mapped source candidate prepared | Owner accepted exact raw-with-skin/core-excluded source row; no reviewed revision/event exists yet |
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

## Existing issuance and export route

The route is implemented only in stacked Draft PRs and has not been applied or
mounted. Checkpoints were re-read on `2026-10-13`:

| Draft | Exact HEAD | Role in the route | Current limit |
| --- | --- | --- | --- |
| #154 | `b36f55500fc4b142bfa7b3029dc4c511a9d58c75` | Strict raw request decoder and unmounted `createFoodEvidenceReviewHandlerV1`; SQL `public.food_evidence_review_v1(text)`, `public.food_evidence_receipt_v1(uuid)` and `public.food_evidence_current_v1(uuid,text)`; immutable revisions, retained sources, append-only events and receipts | Disposable migration draft; real JWT/PostgREST boundary and persistent apply blocked |
| #155 | `366be8f5ad8bdf1617cf98923dd39d70a77e7563` | Eligibility/all-writer architecture | Documents only |
| #156 | `d45b3fefbb9358438391d28a14e73c03e5621aa4` | Tested disposable eligibility registry; `shared_food_eligibility_decide_v1/current_v1`; issuance binds approval events to an eligible identity epoch/fingerprint | Persistent all-writer compatibility blocked |
| #157 | `03784301326887f973bf814fd57a9d17f5b86f83` | Stage C writer/lock/receipt plan | Documents only |
| #158 | `682d2c83dacec50f621297ffbac7914ec472637d` | Disposable participating catalog writers/importer batch | Legacy/external all-writer coverage blocked |
| #159 | `7ba58bf5ddc846e3d0a76add59f55c850d731c5d` | Real disposable PostgREST/JWT and COMMIT-fault verification | Found hidden business-40001 retries; causal reconciliation blocked |
| #160 | `42a2e11f45f58554e10d38d0c5f06469df502105` | Disposable PT409/PT500 repair and transport re-acceptance over the stacked definitions | Still Draft, not applied; retention, deployed auth/version and rollout blocked |

The authority boundary in #154/#156 is not a caller-provided role. SQL resolves
`auth.uid()`, authenticated JWT/session freshness, effective `admin` entitlement and
the matching `potok_control.access_attestations` row; it repeats the check after lock
waits. The gateway verifies the returned actor, idempotency key, canonical request
digest, retained-source binding, revision/event bindings and receipt shape. SQL owns
revision/event UUIDs and timestamps. Exact recovery is by the original
`idempotencyReference` through `food_evidence_receipt_v1`; current state is read by
food UUID and exact state through `food_evidence_current_v1`.

There is no mounted production entrypoint and no batch exporter that converts two
current food states into a real recipe reviewed export. The exact single-food current
reader exists in #154 and is strengthened by eligibility bindings in #156. The missing
export part is a server-owned, strict batch capture of those current responses and
their receipts/revisions/events; it must fail unless both current states are usable
and must not mint review artifacts on the client.

### Minimal executable sequence after source approval

1. Make a separate owner decision on the exact stacked SQL/transport definitions and
   retention/all-writer/auth gates. Do not auto-merge the Draft chain. Apply/rollout is
   a separate decision from evidence issuance.
2. Through the approved Stage C catalog writer, create or resolve the two shared
   canonical roots, then run eligibility `PENDING` → `ELIGIBLE` with current identity
   epoch/fingerprint and verified receipts. Semantic stable keys are not UUIDs.
3. An authenticated, currently authorized admin sends one canonical
   `REVIEW_APPROVED` request per product to `food_evidence_review_v1`, with exact
   retained source bytes. Keep the original idempotency key/raw request and verify the
   returned receipt; recover uncertainty only with `food_evidence_receipt_v1`.
4. After canonical current is usable, send the nutrition approval pinned to its
   canonical revision/digest. Each proposal must contain all five fields from one
   compatible product/state and an exact retained mapping. Cottage cheese cannot enter
   this step while generic nutrition provenance/fiber remain unresolved.
5. Read `food_evidence_current_v1(foodId,state)` for both products and capture the
   exact usable canonical/nutrition revisions plus linked server events/receipts using
   the missing strict batch exporter. This produces the food-evidence input for recipe
   review; it does not approve the recipe.
6. Independently close recipe composition, edible masses, culinary serving/yield,
   allergen/dietary, portion and eligibility revisions. Only then may the existing
   publication compiler form sorted unique canonical UUID `ingredientIds` and a
   reviewed runtime publication candidate.

Confirmation of two food sources does not make 250 g a measured finished yield and
does not close any recipe-level gate.

## Recorded source decisions and versioned mapping

Owner instruction 2026-10-13 fixes POTOK carbs as available carbohydrates excluding
fiber. Apple identity USDA SR27 NDB 09003 raw/with skin/core-stem excluded is accepted.
Generic plain unsweetened 5% curd means any brand; branded product evidence cannot
be transferred to it. These are source decisions, not server events.

Policy `potok-source-total-including-fiber-to-available-v1` maps apple 13.81 − 2.4
= 11.41 g available carbs per 100 g edible. Source total and fiber remain separate;
calories remain 52. Preconditions: explicit source inclusion of fiber, matching
identity/state/units/basis, retained source SHA bindings and nonnegative exact decimal
result. Unknown inclusion semantics rejects mapping. Historical diary/Graph v1 wire
and consumers are unchanged.

Official sources: [EEC TR TS 022/2011, article 4 / 4.9 / 15](https://eec.eaeunion.org/upload/medialibrary/9db/TrTsPishevkaMarkirovka.pdf)
explicitly excludes dietary fiber from carbohydrate determination; [USDA FAQ](https://fdc.nal.usda.gov/faq/)
defines carbohydrate by difference without subtracting fiber. Retained short excerpts/
factual summary, versions, dates and exact SHA-256 are in the source JSON. This policy
is a local source-candidate policy, not a runtime evidence layer or activated converter.

## Bounded generic-curd search result

Three generic leads were checked, then search stopped. University-hosted article
[table 1](https://opusmgau.ru/index.php/see/article/download/2030/2028/) has 145 kcal,
21% protein, 5% fat, 3% carbohydrate and numeric fiber 0% for plain input curd before
phyto-additive preparation. Retained as a lead only: table provenance/method is not
explicitly bound, issue/version unresolved, carbohydrate semantics unspecified.
Do not dismiss the number as absent, but do not certify it as authoritative evidence.

Skurikhin/Tutelyan 2002 ISBN 5-94343-028-8 was located on a third-party OCR mirror;
exact 5% row/column alignment and fiber value were not verified against authorized
edition. The Health-diet generic row is secondary without an exact primary-row
binding. Manufacturer examples remain separate branded identities; no zero is inferred
from their missing fields. Full checked sources/rejection reasons are in JSON.

Exact blocker: a verified, versioned authoritative generic plain 5% row, including
available-carbohydrate semantics and applicable numeric fiber. All proposed generic
nutrition fields are null; branded facts stay under `brandedExample`.

| Stage | Apple | Generic curd | Package |
| --- | --- | --- | --- |
| Source decision | ACCEPTED_BY_OWNER | GENERIC_IDENTITY_FIXED | RECORDED |
| Mapped candidate | PREPARED 52/0.26/0.17/11.41/2.4 | BLOCKED | INCOMPLETE |
| Source data ready for issuance input | source-data-only ready | false | false |
| Server-issued reviewed evidence | NOT_ISSUED | NOT_ISSUED | false |
| Recipe review | NOT_REVIEWED | NOT_REVIEWED | false |
| Assembly eligibility | BLOCKED | BLOCKED | false |

Previous acquisition recommendation superseded by the final official resolution pass below. No owner
export fabrication or repeated semantics/identity decision is requested; no pilot
replacement is automatic. CAN_ISSUE_REAL_REVIEWED_EVIDENCE=false, CAN_ASSEMBLE=false.

## Batch exporter: separate implementation requirement

Minimum inputs: exactly two current catalog UUID/stable-key/state bindings; caller's
verified authority/session; expected canonical/nutrition head IDs and digests;
eligibility decision/version/epoch/fingerprint; exact issuance receipt keys/digests;
retained-source locators/hashes and approved carbs mapping policy version.

Minimum output: one immutable, independently pinnable batch capture containing the
exact two identities/states, canonical and nutrition revisions, linked approval events
and receipts, retained bytes/hash mappings, invalidation/current usability results,
eligibility bindings and capture digest/version. It is food evidence, not recipe review.

Required acceptance: perform both captures under one server-owned coherent transaction
using the approved authority/catalog gate and deterministic lock order; recheck authority
and all heads/eligibility/epoch/fingerprint/invalidation bindings after waits; fail the
whole capture on drift or unusability. Verify request/receipt key+digest, revision/event
links, source byte hashes/coverage and exact two-item sorted unique UUID coverage. A
later publication must revalidate currentness or pin an approved freshness contract;
a capture is not perpetually current. Two sequential client reads cannot prove this
coherent export. Implementation, transport/auth/concurrency acceptance and apply/issuance
approvals remain separate gates; no new exporter contract is activated here.

## Final official source-resolution pass — 2026-10-13

**NO-GO; generic-curd search stopped.** Official web.ion.ru direct HTTPS request
returned timeout; HTTP/directory fallbacks were inaccessible; bounded curl failed to
connect to the configured proxy. No database payload was obtained. Publisher
attribution to ФГБУН «ФИЦ питания и биотехнологии» is supported by its official
ion.ru site; database version, row/code, headings, basis, nutrient values, fiber type,
legend and carbs semantics remain unverified/null. The requested «Крестьянский» row
is a user-provided lead, not a directly read row. Its generic applicability is NOT_ESTABLISHED:
fat percentage alone cannot establish technology/composition equivalence to any-brand curd.

[RSL catalogue](https://search.rsl.ru/ru/record/01001844793) directly confirms title,
Institute of Nutrition RAMN, editors, publisher/year, ISBN and book-level 100 g edible
basis. The catalogue provides reading-room/fragment-order links, not an open page
viewer. Conventional viewer endpoint was inaccessible. Exact curd row, columns,
legend and carbohydrate definitions remain unavailable. Only minimal bibliographic
facts were retained; no protected full book was saved. No purchase/order/contact sent.

The official [EEC adopted PDF](https://eec.eaeunion.org/upload/medialibrary/9db/TrTsPishevkaMarkirovka.pdf)
article 4, part 4.9, paragraph 15, PDF p17, directly excludes dietary fiber.
Matching paragraph checked in identified consolidated edition dated 22.04.2024
(ConsultantPlus); the official PDF is labelled adopted base 09.12.2011, not a current
consolidated PDF or a draft amendment. The retained excerpt now pins that exact
paragraph. Full upstream PDF SHA: SKIP (proxy unavailable). Source arithmetic
13.81 − 2.4 = 11.41 is a separate approved mapping policy, not a regulatory formula
or change to source calories. Exact retained hashes are in the JSON manifest.

## Existing fallback candidates — recommendations, not replacements

All rows below come from unchanged `data/recipes/recipe-candidates-v1.json`.
Sources listed are evidence leads, not completed reviewed food packages.

| Candidate | Authored ingredients / masses | Sources and fiber coverage | Portions / yield | Remaining blockers |
| --- | --- | --- | --- | --- |
| **oatmeal_with_apple (recommended)** | oat_flakes 50 g; water 200 g; apple 120 g | Accepted apple SR27 source covers fiber 2.4. USDA SR28 NDB08120 plain rolled oats is a primary exact-state lead; complete retained oat fields/fiber not yet reviewed. Water needs approved non-food or food binding, not invented zero | 1 authored serving; measured cooked yield/portion mass absent; 370 g inputs is not yield | Dry oat identity/mapping/full field capture; water evidence; cooking losses/retention; gluten/safety/portion/eligibility/culinary review |
| buckwheat_with_carrot | whole_buckwheat_groats 120 g; water 300 g; carrot 160 g; bulb_onion 80 g; sunflower_oil 10 g | USDA SR28 NDB20009 roasted dry buckwheat lead reports fiber 10.3; roasted state versus workbook groats unresolved. USDA vegetable reports can cover carrot/onion; exact retained rows absent. Oil fiber zero and water require direct evidence/binding | 2 authored servings; measured output absent; 670 g inputs is not yield | Five ingredient bindings, roasting/state, oil zero provenance, cooking/yield, recipe/portion/safety/eligibility |
| tomato_omelet | egg_chicken 120 g; tomato 150 g; sunflower_oil 5 g | USDA primary tomato dietary-fiber analysis available; not a complete five-field food source. Egg/oil zero require direct applicable authoritative rows, not inference | 1 authored serving; measured cooked yield absent; 275 g inputs is not yield | Egg shell/edible mass, cooked losses/state, oil/egg full source coverage, allergen/recipe/portion/eligibility |

Primary fallback leads: [USDA SR28 cereals NDB08120](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg08.pdf),
[USDA SR28 grains NDB20009](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg20.pdf),
[USDA-hosted tomato fiber analysis](https://www.ars.usda.gov/ARSUserFiles/80400525/Articles/jfca15_715-723.pdf).

One next action: owner decides whether to select existing `oatmeal_with_apple` as the
next pilot. It reuses accepted apple and adds one main food identity; evidence and
recipe gates still need work. Original pilot remains unchanged; no new package begins.
SOURCE_DATA_READY_FOR_ISSUANCE_INPUT=false; CAN_ISSUE_REAL_REVIEWED_EVIDENCE=false;
CAN_ASSEMBLE=false. Batch exporter remains separate. PLAN != FACT.
