# Consolidated candidate catalog → local week — 2026-11-04

Continues #320 at `8f2a0086f4feb9eb86222064298f9f20a85a8c16`.
This single four-task stage consolidates existing work, preserves unknowns,
connects the catalog to the existing local search, and delivers a complete week
with evidence coverage and remaining blockers. No source research or earlier
audit is restarted. Process #314 remains separate.

## Acceptance and paths

| Task | Acceptance | Affected paths |
| --- | --- | --- |
| Unified candidate | Original 132 recipes / 730 rows plus retained materials and exact prior row reviews; no loss of original data | New offline builder, private catalog JSON |
| Consistent data/unknowns | Partial ingredient vectors remain separate from old recipe totals; excluded references and ambiguous identity stay explicit | Builder, tests |
| Search connection | Serialize candidate, load it through an adapter, call existing `previewRecipeAuthoringWeekV1`; join selected recipes to their review context | Same builder/adapter, existing search unchanged |
| End-to-end run/report | Seven-day 1600 reference experiment, scenario/negative checks, full owner menu and specific blockers; one Draft PR | Tests, document, existing CI step, private owner report |

## Candidate contents

`scripts/contracts/consolidated-authoring-candidate-week-v1.ts` produces
`potok-consolidated-authoring-candidate-catalog-v1` with the complete unchanged
original authoring catalog, per-recipe/ingredient review context and a hash/byte
index of all 56 existing retained JSON/text materials. Retaining a study does not
automatically map its facts to a new ingredient. Only the 120 explicitly indexed
rows receive their pinned preparation/review links. Every linked original row,
recipe ID and provenance digest is checked; all retained source results stay
separate from admission authority.

The original private catalog SHA256 remains
`517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0`.
The 42 later source-variant reviews, three coherent conditional source-input
reviews, walnut owner-state overlay and recipe-specific buckwheat/potato rule
binding are consolidated. Unspecified states remain unknown. No source, mapping,
canonical ID, receipt or recipe admission is created.

| Candidate observation | Count |
| --- | ---: |
| Original recipes / ingredient rows | 132 / 730 |
| Complete numeric authoring references usable in local reference search | 122 |
| Recipes excluded for incomplete numeric/declared-serving inputs | 10 |
| Rows in the pinned pilot review / outside that index | 120 / 610 |
| Later source-variant review rows | 42 |
| Complete conditional source-input review rows | 3 |
| Original canonical statuses | 729 UNRESOLVED, 1 AMBIGUOUS |
| Complete admitted recipe vectors / applied changes | 0 / 0 |

Rows outside the pilot index are labelled `NOT_IN_PINNED_PILOT_ROW_INDEX`, not
declared to have no study anywhere. Group-level retained material is not silently
promoted to row-specific identity. The original data and unknown fiber/servings/
mass stay intact; absent fields are not zero.

Every complete admitted recipe vector stays null. Three partial ingredient
candidates cannot produce a coherent full-recipe total. Search therefore uses
**unchanged source-declared per-serving references only**, never a mix of new
available carbs and old recipe carbohydrate. Candidate input quantities refer to
whole authoring recipe inputs, not automatically to one selected serving.

## Actual catalog-to-search connection

The `preview` command loads the serialized candidate, verifies its integrity and
original-catalog object digest, rejects nested admission flags, and decodes the
original data through the existing authoring decoder. It then calls the existing
local `previewRecipeAuthoringWeekV1` via `authoringSearchInput`. Search and trusted
generator code are unchanged. Selected recipe IDs join exactly to their review
context and blockers; name matching or fallback to another catalog is absent.
Content digests detect stale bytes; they are not authentication or source authority.

```sh
node --import tsx scripts/contracts/consolidated-authoring-candidate-week-v1.ts build ORIGINAL_CATALOG.json PRIVATE_INPUT.json > candidate-catalog.json
node --import tsx scripts/contracts/consolidated-authoring-candidate-week-v1.ts preview candidate-catalog.json SCENARIO.json > candidate-week.json
```

The new week contract is `potok-consolidated-authoring-week-run-v1`. The existing
authoring preview is nested unchanged beside selected evidence coverage. The
adapter accepts no approved recipe promotion and both catalog/week exports are
rejected by the real reviewed runtime publication decoder, even with forged flags.

## Completed real-data runs

Uses the existing checked-in scenario, whole source-declared serving per slot,
no scaling, four slots/day, ±10% reference-energy tolerance, max two uses per
recipe/week, no same-day duplicate, explicit LUNCH reuse for the dinner test,
ranked pool 12, shortlist 4, day pool 4, up to 256 day / 1024 week combinations.
These are technical experiments, not personalized nutrition recommendations.

| Scenario | Outcome | Unique recipes | Indexed ingredient rows / selected unique rows |
| --- | --- | ---: | ---: |
| 1400 | REFERENCE_WEEK_PREVIEW | 22 | 8 / 95 |
| 1600 | REFERENCE_WEEK_PREVIEW | 24 | 120 / 120 |
| 1800 | REFERENCE_WEEK_PREVIEW | 22 | 53 / 101 |
| 2000 | NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS | 0 | 0 / 0 |
| Strict DINNER category | INCOMPLETE_CATEGORY_POOL | 0 | 0 / 0 |

The 1600 experiment has seven days / 28 meals, 24 distinct recipes, 120 reviewed
unique ingredient rows and all three conditional source-input reviews attached.
Daily reference energy: 1599.700, 1581.300, 1600.000, 1607.100, 1567.700,
1603.800, 1589.800 kcal. Since partial ingredient data is deliberately not applied
to recipe totals, menu choices/reference sums match the existing experiment.
The new result is the consolidated, evidence-connected catalog/run, not a newly
validated nutrient week. Prefix searches do not establish global optimality or
infeasibility. The 2000 failure does not relax portions/tolerance automatically.

## Concrete remaining work

No menu here is admitted for runtime publication. Canonical identities, complete
recipe nutrition, available-carbohydrate semantics and allergen/dietary eligibility
remain open. For the 1600 week the retained 25-case/42-row matrix includes 15 dairy
rows (six tvorog NO-GO, four milk, three natural yogurt, two Greek yogurt), five
egg/bread piece rows, exact source versions/processing for oats, meat/fish, cocoa,
butter and processed products. Every case retains its specific required evidence.

Selected mass presentation: 96 G reference rows, 17 ML rows (including water and
milk), seven discrete/other unit rows. These are not measurements or implicit
conversions. ML needs a valid per-volume/mass or appropriate typed-input basis;
water/zero-component preparation does not automatically authorize global density
or typed runtime eligibility. No missing grams or optional ingredient is zeroed.

The source has no primary DINNER category; reusing LUNCH is only an explicit test
assumption. The local search does not assess allergen/dietary safety, available
carbohydrate semantics, practical portions, repeat families, protein/other nutrient
targets or trusted-plan validation. Physical cooking/yield/portion checks stay
deferred to owner prelaunch app testing and do not block development/offline previews.

## Validation and delivery

Local PASS: 54 tests (seven new consolidation/search regressions plus earlier source/review
and authoring-search regressions), strict standalone TypeScript, ESLint, both CLI
phases, four real numeric scenarios plus strict-DINNER diagnostic, original file
hash and diff checks. See Draft PR for final PASS count, remote head and CI.
Tests include stale/tampered catalog/material/input, preservation of nulls and
AMBIGUOUS, exact old search behavior, repeat caps/whole servings/unknown grams,
empty/failed pools, resealed nested approval attempts and runtime rejection.

Owner deliverables are a private consolidated catalog JSON and a Russian report
with all seven days, references, coverage and actionable blockers. No private
catalog/recipe bodies enter public Git. Production/Supabase, permissions/RLS/
migrations, runtime catalog, PLAN/FACT/history, workers, release, deployment,
activation and merge are untouched. Next stage can use this one reproducible
catalog/run rather than rebuilding separate source packets; admission/apply and
publication still require their own evidence and explicit owner boundary.
