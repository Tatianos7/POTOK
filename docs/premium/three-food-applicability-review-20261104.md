# Three-food declared applicability review — 2026-11-04

Continues Draft #318 at `8a263abb531aa2a02615c81bd5764fccef29a59f`.
Four bounded tasks: inspect declared product/state/preparation against the three
sources, reproduce the transcribed reference numbers from original text, form
conditional input contributions where the declarations align, and validate the
boundary. Process #314 remains separate. No source admission or apply was authorized.

## Acceptance and affected paths

| Task | Acceptance | Paths |
| --- | --- | --- |
| Declared applicability | Review all three full recipe contexts; preserve unspecified walnut processing/form | Retained digest-only annotations, offline builder, this document |
| Text transcription | Reproduce all 15 reference fields from the exact bound RU/EN note text; no claim of nutrient truth | Builder and tests |
| Conditional input arithmetic | Complete five-field contribution for aligned G inputs only; no walnut estimate, volume conversion, cooked retention or recipe total | Builder and private owner report |
| Validation | Catalog/recipe/row/source/transcription corruption and approval attempts rejected; privacy preserved | Tests and PR CI wiring |

## Findings for the existing authoring declarations

| Source / case | Declared alignment finding | Result |
| --- | --- | --- |
| 09318 frozen unsweetened strawberry | Frozen unsweetened origin; recipe retains all thaw juice and uses the berries without cooking | Declared origin/input alignment; conditional 50 g arithmetic only |
| 09050 raw blueberry | Explicit fresh/raw edible input added at serving | Declared origin/input alignment; conditional 75 g arithmetic only |
| 12155 English walnut | Nut identity named; processing, salt/additives and shelled edible form not explicitly fixed | Unknown processing/form retained; no input contribution |

This is a manual, versioned review of fixed authoring declarations, not an NLP
food classifier. Chopping/topping alone does not prove raw, unsalted or shelled
walnut input. It is also not a confirmed actual product or measured composition.
Frozen-origin alignment does not approve thawing/retention or finished nutrition.

The public annotation file contains only row/recipe IDs, digests and concise review
findings. It binds the unchanged original private catalog bytes, original ingredient
rows, and each full `sourceRecipe` plus `steps` context. Private recipe text and
full notes are not committed. All three originally transcribed five-field vectors
are reproducible from their exact source notes. That closes a text-copy check,
not original source provenance, nutrient truth or carbohydrate semantics.

## Conditional ingredient-input arithmetic

| One recorded authoring input | kcal | Protein g | Fat g | Candidate available carb g | Fiber g |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frozen strawberry, 50 g | 17.50000000 | 0.21500000 | 0.05500000 | 3.51500000 | 1.05000000 |
| Raw blueberry, 75 g | 42.75000000 | 0.55500000 | 0.24750000 | 9.06750000 | 1.80000000 |
| Walnut, 30 g recorded reference | null | null | null | null | null |

The berry numbers multiply #318's coherent complete source candidates by recorded
grams/100 with exact integer arithmetic to eight decimal places. Source calories
remain intact. Neither grams nor values are called measured or approved. No
cooking-retention factor, edible-yield assumption, portion, recipe/day/week total,
target or available-carbohydrate before/after delta is computed. Walnut unknowns
are not zero. Existing old reference totals and all recipe-level blockers remain.

## Offline implementation

`scripts/contracts/three-food-applicability-review-v1.ts` regenerates #318's source
candidates and requires both the prior private input and the complete unchanged
original private catalog. It checks catalog bytes, unique recipe/ingredient
coverage, row digests, recipe-context digests, primary-source binding and manual
annotation scope/status. Edited steps fail even if the catalog digest alone is
updated. Every transcribed numeric field is checked against the bound note text.

The narrow numeric parser supports only this version's RU/EN reference syntax.
Missing/duplicate references or unsupported number spelling fail instead of
guessing. It reproduces the note, not its semantics or truth. Manual annotations
and byte hashes are not authority. Exported test/composition seams require trusted
offline source/review bundles; they do not admit arbitrary new evidence.

```sh
node --import tsx scripts/contracts/three-food-applicability-review-v1.ts PRIVATE_INPUT.json ORIGINAL_PRIVATE_CATALOG.json > private-applicability-review.json
```

CLI reads local files and emits JSON; no database, network, apply or app/runtime
integration is added. The output contract is
`potok-three-food-declared-applicability-result-v1`. Source/mapping/selection/
publication flags remain false/null. Unknown original available carbohydrate,
unreviewed source identity, existing blocks and PLAN != FACT remain unchanged.

## Validation and next owner decision

Actual private replay: three reviewed rows, 15 text fields reproduced, two declared
alignments, one processing/form question, two conditional input contributions,
zero source approvals or applied changes. Catalog SHA256 remains
`517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0`.

Local PASS: 38 tests (eight new plus prior source/draft/pilot tests),
strict standalone TypeScript, ESLint, private replay and diff checks. See the
Draft PR for exact PASS counts and CI at the remote head. Tests include altered
recipe steps/rows/transcription, stale catalog/context hashes, missing/duplicate
annotations, fabricated walnut alignment, ML/pieces/missing or zero grams,
determinism/privacy, and normal/forged-approval export rejection by the actual
reviewed runtime publication decoder.

The concrete owner question is whether this recipe should use **raw shelled
walnut kernels without salt/additives**, a specified roasted variant, or an
intentionally unspecified input. No choice is inferred from source-value proximity.
The two berry findings are ready for a separate owner source/mapping decision;
they are not canonical resolution or runtime admission. Other ingredient and
recipe-level evidence remains open.

Physical cooking/yield/portion checks stay deferred to owner prelaunch application
tests; development and clearly marked offline previews continue. Generic-tvorog
NO-GO, milk/piece mass, buckwheat/potato decisions, original data and historical
snapshots are preserved. No Production/Supabase access, grants/RLS/migrations,
release-branch modification, publication, deployment, activation or merge.
