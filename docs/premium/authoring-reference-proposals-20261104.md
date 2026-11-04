# Authoring reference change proposals, 2026-11-04

Continues #315 at `8b10433d0bd7e38ba7c9da6bc3fcd919a267b643`. The four-task
stage prepares concrete source-variant proposals, dairy/quantity decisions,
bounded impact comparisons and negative/CI checks. It does not apply changes,
issue source approvals or change a runtime catalog. Process PR #314 stays separate.

## Implemented behavior

`scripts/contracts/authoring-reference-proposals-v1.ts` reads a private local
input and the fixed checked-in #315 inventory/audit/capture. It checks the raw
source digests, private packet binding, every original authoring-row digest,
recipe/row identity, unique and complete audited-row coverage, vector fields,
nullable unknowns and bounded decimal precision. Duplicate JSON keys, stale
sources, changed rows, unknown approval-shaped input fields, missing or duplicate
coverage and exponent/negative numeric strings fail closed.

The public builder's source-bundle seam is for trusted offline composition/tests;
it is not a provenance authority or a runtime input API. The CLI reads only the
fixed repository source files and one operator-supplied local file. There is no
database, network, secret, apply, approval or runtime activation operation.

Each row retains its before-reference transcription, unchanged recorded unit
and gram reference, existing blocker and required evidence. Every source option
is conditional or excluded, has `canApply:false`, and leaves `selectedOption:null`.
The retain-original-reference option preserves admission status. Cases without
an appropriate source, including generic tvorog, do not acquire invented variants.

Before vectors are explicitly **manual unverified transcriptions** of the pinned
authoring notes, not newly established nutrition facts. The original full row is
used only for digest verification and is not returned in the proposal packet.
Source and input hashes identify bytes, not source authority or review approval.

## Source-state and quantity boundaries

The exclusions are versioned decisions for #315's specific cases, not a global
food classifier. Raw strawberry and raw blackcurrant records are excluded from
their frozen cases. A not-previously-frozen pollock record is excluded from the
recorded thawed-input case. Missing source fiber stays null. Alternatives that
still need exact class/version evidence remain conditional, never silently chosen.

For milk, ML never becomes grams even when the source row has a copied numerical
gram reference. Numerical effects are withheld for all ML comparisons, for PCS/
PIECE or other non-G units, and when reference/source nutrients or grams are absent.
No household unit, density, edible yield, portion, whole-egg weight or cooking
retention is guessed. The prior generic-tvorog NO-GO and recipe-specific buckwheat/
potato rules are unaffected. Physical testing remains deferred to owner prelaunch
application tests; development and explicitly marked offline previews can continue.

## Impact scope

For eligible G rows only, differences in the calorie/protein/fat/fiber reference
columns are calculated with exact integer arithmetic to eight decimal places.
Per-100-g values and recorded grams have at most three decimal places; their
scaled product therefore has at most eight decimal places, without rounding.
Negative differences and zero are preserved. This is a conditional arithmetic
comparison of unverified input references, not measured or approved nutrient
change in a cooked dish.

Carbohydrate effects are always withheld because before-reference semantics are
not admitted. Before reference carbohydrate and source total carbohydrate remain
visible as separate fields; no available-carbohydrate mapping is silently applied.
Mutually exclusive alternatives are not summed. Recipe impacts list affected
rows only and explicitly retain original reference totals; there is no verified
recipe total, week calorie-target claim or menu optimization based on this output.

## Actual private replay

The original private packet was reproduced at its unchanged checksum
`e7ad3b7161156a444f7e2c24226226aff58fee9659dba55d1ec09546e4eae723`.
The builder accepted all 42 audited rows with their exact original row digests.
The private input contains unverified reference transcriptions; it is not a
publication source and is not committed to Git.

| Output observation | Count |
| --- | ---: |
| Row proposals / affected recipes | 42 / 20 |
| Source comparisons | 44 |
| Conditional G reference comparisons | 28 |
| Comparisons blocked on ML mass basis | 8, across 4 milk rows |
| Comparisons blocked on discrete mass basis | 5 |
| Source-state exclusions | 3 |
| Selected/applied changes | 0 / 0 |

A Russian review guide with the complete proposal JSON as an appendix is prepared
as one separate owner deliverable. Public code/tests use synthetic rows; no private recipe bodies,
full original rows, notes or actual private inputs are committed. The checked-in
#315 sources and existing runtime/server code remain unchanged.

## Validation and next gate

Local: 15 new/prior-stage/pilot tests, strict standalone TypeScript for the new
builder and targeted ESLint passed. The actual private replay passed. Negative
tests cover stale digests, mutated input grams, duplicates/missing coverage,
unknown nutrients, ML and piece mass, excluded states and attempted approval.
Both normal and forged-approval outputs are rejected by the real reviewed runtime
publication decoder. CI additionally typechecks and tests the offline builder.
See the Draft PR for the final CI result and exact head.

Next work is an explicit choice/review of intended source variants and preparation
of selected draft reference changes with their provenance. The displayed numbers
do not themselves settle missing source-class, allergen/dietary, composition,
portion, authority or publication evidence. No original workbook/catalog, recipe
total, PLAN/FACT, Production/Supabase state, rights, worker, merge or deployment
was changed by this stage. Source admission, any apply/publication and activation
remain separate gates; this proposal package grants none of them.
