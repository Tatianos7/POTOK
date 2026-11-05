# Concrete source/identity review proposals for the frozen pilot

Base PR338 exact head `6cde8fafc7f3081602cc18d14c123e8fbf12a9b5`
passed both CI workflows. This stage joins the existing catalog observations to
the exact primary-source inputs, preserving source identity and all unknowns.
It prepares review drafts, never canonical bindings, issued evidence or writes.

The original private catalog was recovered at SHA256
`485da00522a3014c7722a7443b63b45fd3ddfcf05ec8f0186fe7d1ca704d50af`.
The existing pipeline was rerun with its original pinned scenario; all 19 model
objects match the checked-in input freeze. Before preparing each proposal, the
assembler verifies this freeze and the prior exact-review freeze hash, row
coverage, recipe/row/component/source bindings, and exact five-axis source values.
Changing a model and rehashing a new freeze cannot replace the primary vector.

Source acquisition is reused, not repeated or silently upgraded. Existing batch,
Foundation, grain/tuna, source-expansion, breakfast/main, grain/main and lentil
source mappers validate retained primary facts and definitions. Their material
hashes are checked against existing manifests. The 88 rows use 35 exact binding
labels from 16 retained capture files; two oat binding labels refer to the same
retained FDC record and preserve their original spelling/basis. No source bytes,
recipe quantities, source semantics or recipe totals are changed.

## Actual review routes

| Route, counted by ingredient row | Staging | Production |
| --- | ---: | ---: |
| Candidate identity review before a source-backed nutrition revision | 55 | 37 |
| Catalog identity precheck before a source-class definition proposal | 10 | 28 |
| Precision decision before food evidence | 4 | 4 |
| Existing typed water/salt evidence review | 19 | 19 |
| Total | 88 | 88 |

The first route is not ready-to-apply: exact state, edible portion, identity,
source applicability, account accessibility and independently authorized review
are still required. A discovery absence does not authorize creating a duplicate
food. The second route retains null proposed UUID/stable ID; use the existing
resolver/import precheck before any future canonical creation proposal.

Each private proposal retains the exact source description, retained file hash,
five source values, lossless decimal representation or precision blockers,
observed catalog UUID/stable key and legacy vector, excluded alternatives and
remaining identity attributes. Legacy missing values remain missing. No source
vector is presented as a patch to the existing generic catalog record.

## Specific decisions preserved by the primary records

| Primary record | Required distinction in a review proposal |
| --- | --- |
| SR28 05062 | Raw breast meat, skinless and boneless; generic chicken/fillet labels do not prove this |
| SR28 20009 | Roasted dry buckwheat, preserving the owner's recipe-specific choice; not green groats |
| SR28 20124 | Dry whole-wheat pasta; no spelt/generic-pasta substitution |
| FDC 175154 | Wild rainbow trout, raw; no farmed-trout equivalence established |
| FDC 175167 | Farmed Atlantic salmon, raw; generic salmon/steamed/grilled rows do not prove this |
| FDC 173709 | Light tuna, canned in water, drained solids; salt/source sampling retained, own-juice equivalence unproven |
| FDC 172420 | Raw dry lentils; source does not report colour/cultivar, so brown equivalence remains unresolved |
| SR28 01174 / 01287 | Exact milk/Greek-yogurt reference profiles; no universal equivalence to every nominal 2% retail product |
| FDC 168411 | Frozen prepared edamame; mature soy or sprouts cannot replace it |

Source-derived values are available even where a catalog definition is not yet
established. For example milk's source profile is 50 kcal, P3.30/F1.98/C4.800/
fiber0.0 per 100 g edible; Greek yogurt is 73, P9.95/F1.92/C3.940/fiber0.0. These
are exact source profiles, not an assertion that all owner-intended 2% products
have those values. The owner's plain-unsweetened generic Greek-yogurt intention
remains accepted; it is not asked again or converted into nutrient approval.

## Existing precision boundary

Use `normalizeFoodEvidenceSourceDecimalV1` from the real Food evidence contract;
do not implement a new rounding policy. It rejects nonzero digits beyond three.
Three oat rows and one almond row fail for calories, protein and available carbs:

| Source | Energy kcal | Protein g | Available carbohydrate g |
| --- | ---: | ---: | ---: |
| FDC 2346396 rolled oats | 378.866123 | 13.49645 | 58.23755000 |
| FDC 2346393 whole raw almonds | 583.597022 | 21.45038 | 9.25462000 |

Fat/fiber remain individually lossless, but a partial vector cannot issue a
complete reviewed nutrition revision. Preserve selected Atwater-specific energy
and same-record fiber methods. No rounding, truncation, 4/9/4 replacement,
residual allocation or older-record fallback is applied. A separately versioned
precision decision must cover Food evidence and downstream Graph/publication
compatibility; changing one decoder alone is insufficient.

All 19 water/salt inputs retain the existing typed evidence path. Explicit source
zeros are not quantity conversions, measured yield, evidence issuance or a reason
to omit inputs. Physical cooking/yield/portion measurements remain deferred to
owner prelaunch testing.

Private row proposals and snapshots remain outside public GitHub. Proposal
canonical IDs, stable IDs, review event and authority context stay null; all
promotion flags false; applied bindings, approvals and admissions zero. The
actual Food nutrition revision and recipe publication decoders reject these
drafts, including forged approval flags. PLAN != FACT. No Supabase operation is
performed in this stage; no aliases, backfill, grants, publication, activation,
merge or deployment occur.

Next: prepare the exact source-class/identity review items and the separately
versioned precision compatibility proposal. Keep catalog mutation, issuer review
and Staging application as distinct later decisions; do not overwrite broad
legacy identities to make these source values fit.
