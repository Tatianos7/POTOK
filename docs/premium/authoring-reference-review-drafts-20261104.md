# Authoring reference review drafts — 2026-11-04

Continues Draft #316 at `2b1bceb4ea1ba117bfca7773a5d55da4c7ffb69c`.
The approved four-task stage recommends a specific disposition for every disputed
reference, makes missing source/quantity evidence explicit, prepares a separate
numeric-reference draft and validates the boundary. Process #314 stays separate.

## Scope and acceptance

| Task | Acceptance | Paths |
| --- | --- | --- |
| Case recommendations | All 25 pinned cases / 42 rows covered; no guessed class selection | New offline builder, stage document |
| Missing sources and units | Case-specific primary/class evidence; ML and discrete mass stay unresolved | Builder evidence/quantity fields |
| Separate draft and impact | Only changed eligible reference fields; original input and totals unchanged | Builder and private owner report |
| Regression/security checks | Stale/mutated input and attempted approval fail; publication decoder rejects output | New tests, existing PR CI workflow |

No new primary record was obtained or admitted in this stage. The evidence matrix
clarifies exactly what is still missing; it does not label missing evidence as
resolved. Existing public #315 source bytes and original private authoring bytes
are unchanged. No fresh external data service or hosted database is involved.

## Concrete recommendations

| Case | Recommended review candidate / disposition |
| --- | --- |
| Walnut | SR28 12155 precision, conditional on original source and edible class review |
| Blueberry | SR28 09050 precision, conditional on original source and fresh state review |
| Cinnamon | SR28 02010 comparison; no editable calorie/protein/fat/fiber difference in this packet |
| Frozen strawberry | SR28 09318 frozen unsweetened candidate; retain juice and review original provenance; raw 09316 excluded in #316 |
| All other 21 cases | Retain reference pending the exact evidence specified per case; no numeric draft |

The four candidate cases are versioned recommendations for this pinned inventory,
not a global food-matching algorithm or source approval. Even a named candidate
leaves `selectedOption:null`, `ownerDecision:null` and `sourceApproved:false`.
The original full required-evidence text and blocker remain alongside the more
specific Russian recommendation. Generic tvorog's NO-GO and any-brand decision
remain; no universal mandatory brand is introduced. Ordinary/green buckwheat and
young/non-young potato owner decisions are unaffected.

Milk retains its unresolved class/version and per-volume or class-specific mass
basis. Copied gram values are not measurements. Egg/piece/slice presentation
remains separate from admitted edible mass and discrete increments. No global
density, slice weight, cooked yield or servings are invented. Physical cooking
tests stay deferred to owner prelaunch application testing.

## Offline implementation

`scripts/contracts/authoring-reference-review-drafts-v1.ts` regenerates #316's
proposal from the original-row-bound private input and the pinned source bundle.
It does not accept an edited proposal/decision packet. The public function's
source seam remains for trusted offline composition/tests, not authority.
Unknown case IDs or missing/excluded named candidates fail closed. The 25-case
rule table and its evidence arrays are immutable, source-bound by an output digest
and independently checked against the retained audit by tests.

CLI (JSON to stdout, no writes/network/runtime integration):

```sh
node --import tsx scripts/contracts/authoring-reference-review-drafts-v1.ts PRIVATE_INPUT.json > private-review-drafts.json
```

The output contract is `potok-authoring-reference-review-drafts-v1`. It carries
original row/source/input digests, upstream proposal digest, recommendation rules
digest, per-case evidence, per-row recommendations and separate proposed fields.
Hashes identify bytes, not authority. Before vectors remain manual unverified
transcriptions. Raw authoring rows and private notes are not returned or committed.

Only calorie/protein/fat/fiber fields whose decimal values actually differ are
listed. Decimal spelling alone (`0.7` / `0.700`) creates no false edit. ML, discrete
units or missing nutrients produce no numeric draft even if a candidate exists.
Whole before/candidate vectors remain visibly separate reference comparisons.
Carbohydrate differences are flagged but withheld pending semantics; no mixed
vector is approved or ready to publish. Existing exact conditional impacts are
carried forward without new rounding, aggregation, recipe/day/week totals or
target claims. These are unverified raw reference-column differences, not measured
changes in cooked nutrition.

## Actual private replay and checks

| Observation | Result |
| --- | ---: |
| Coverage | 42 rows, 25 cases, 20 recipes |
| Candidate-review rows | 5 |
| Numeric-reference draft rows | 3 |
| Changed reference fields | 8 |
| Cinnamon rows with no editable numeric change | 2 |
| Retain pending evidence | 37 rows |
| Selected / applied / source approved | 0 / 0 / 0 |

Private replay uses the unchanged prior input packet binding
`e7ad3b7161156a444f7e2c24226226aff58fee9659dba55d1ec09546e4eae723`.
The three drafts are frozen-strawberry state comparison and walnut/blueberry
precision comparisons. A private Russian owner report includes all recommendations,
exact proposed fields, required evidence and complete machine JSON in an appendix.

Local PASS: 22 tests (seven new plus prior source/proposal/pilot regressions),
strict standalone TypeScript, targeted ESLint, private replay and diff checks. See the Draft PR for exact
PASS results, remote head and CI status. Tests include exact differences,
no-op precision, ML/piece/missing-fiber blocks, unknown cases, missing candidates,
mutated grams, stale hashes, approval-shaped input, privacy and both normal and
forged-approval export rejection by the actual reviewed publication decoder.

## Owner boundary

This stage prepares a reviewable draft only. Source applicability, original
transcription, full nutrient semantics and owner choice remain open. No unresolved
identity becomes canonical, no review receipt is issued, no app/runtime catalog
or diary is changed, and PLAN remains distinct from FACT. Production, Supabase,
rights, migrations, release branches, merge, deployment and generator activation
are untouched. Development/offline previews can continue with explicit unknowns.

Next gate is review of these concrete candidates and provision of the missing
primary/class evidence. Merely accepting a recommendation does not establish
missing nutrition facts or authorize application/publication.
