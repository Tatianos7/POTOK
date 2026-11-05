# Full-input recipe sufficiency and dairy recheck — 2026-11-05

Continues Draft #321 at `54ec58f54575f844be893eae1931ccc75cb30ca0`.
One owner-approved four-task offline stage; process rules read from #314's
`ai/accelerated-development-workflow-20261104`, without changing stack ancestry.

## Acceptance agreed before implementation

| Task | Acceptance | Paths |
| --- | --- | --- |
| Dairy and mass review | Compare exact recorded FDC identifiers with primary responses; distinguish milk volume, copied grams, eggs, bread, optional salt and recorded gram inputs; preserve unknown classes | Public `retained-sources/dairy-primary-recheck-20261105/`, new offline evaluator |
| Complete recipe sufficiency | Every ingredient of the 24 selected recipes has a row-bound outcome; missing source/class/quantity cannot disappear behind a complete reference total | `scripts/contracts/recipe-recalculation-gate-v1.ts`, tests, private result |
| Separate recalculation | Sum five axes only when every input is sufficient; no partial/source-reference mixing, density guesses, zero fiber inference or original mutation | Same evaluator/calculator, negative and arithmetic tests |
| Week rerun | Rerun original reference scenario separately from sufficient-only input pool, show actual result and remaining barriers, one Draft PR | Same evaluator, existing CI contract step, this report and private owner report |

Physical preparation remains deferred until owner prelaunch application tests;
measured yield and confirmed serving mass stay unknown. These do not block
offline input arithmetic. No source admission, canonical resolution, runtime
publication, production/Supabase access, merge, deployment or activation.

## Primary dairy result

Four public USDA FoodData Central API responses were acquired on 2026-11-05.
Only public record IDs were sent; no owner recipe data left the workspace.
Responses, descriptions, NDB identifiers, SR Legacy publication dates, byte
hashes and exact nutrient codes 203/204/205/208/291 with units are retained in
`retained-sources/dairy-primary-recheck-20261105/`. This is a pinned API view,
not an invented FDC/SR28 crosswalk or a current-product measurement.

| Claimed FDC | Exact primary description | kcal / protein / fat / total carbohydrate / fiber per 100 g |
| --- | --- | --- |
| [172205](https://fdc.nal.usda.gov/food-details/172205/nutrients) | Milk, reduced fat, fluid, 2% milkfat, without added vitamin A and vitamin D | 50 / 3.30 / 1.98 / 4.80 / 0 |
| [171265](https://fdc.nal.usda.gov/food-details/171265/nutrients) | Milk, whole, 3.25% milkfat, with added vitamin D | 61 / 3.15 / 3.25 / 4.80 / 0 |
| [170886](https://fdc.nal.usda.gov/food-details/170886/nutrients) | Yogurt, plain, low fat | 63 / 5.25 / 1.55 / 7.04 / 0 |
| [170903](https://fdc.nal.usda.gov/food-details/170903/nutrients) | Yogurt, Greek, plain, lowfat | 73 / 9.95 / 1.92 / 3.94 / 0 |

New concrete finding: `pollock_patties_mashed_potato_ing_07` and
`buckwheat_crepes_tvorog_ing_02` declare 2% milk with reference 50/3.36/1.9/4.8/0
but cite **171265, whole 3.25% milk**. Neither the ID nor the recipe is silently
corrected to another milk record. Two other milk rows cite 172205; those source
identities are now resolved but class applicability and all four volume bases
remain open. Matching selected macros would not resolve added-vitamin class.

Four yogurt rows cite the two low-fat primary records above and differ from
their literal nutrient profiles. One further natural-yogurt row supplies no
FDC identifier; it is explicitly `NO_PRIMARY_IDENTIFIER_IN_DECLARED_PROFILE`,
not counted as an exact primary match. Generic 2% mapping remains open for all
five. The six tvorog rows retain the generic-any-brand NO-GO; no stopped curd
search was reopened, brand mandated or US cottage cheese substituted.

## Actual 24-recipe sufficiency and rerun

The evaluator reads the saved #321 consolidated catalog directly; it does not
reconstruct earlier source work. `baseline-bindings-v1.json` pins its exact bytes,
integrity digest, original object digest, scenario and selected recipe IDs.
These hashes detect drift, not source authority. Every selected original row
is checked against the existing 120-row ledger. The three conditional vectors
are rederived from retained primary evidence and exact declaration/context
bindings, including the owner's raw-kernel decision. Embedded candidate numbers
cannot replace these checks. Dairy comparison reads bound original note text.

| Observation | Actual result |
| --- | ---: |
| Selected recipes / ingredient rows / dairy rows | 24 / 120 / 15 |
| Complete coherent conditional source-input vectors | 3 |
| Rows still lacking complete row-applicable source/class/version evidence | 117 |
| Recorded gram inputs / unreviewed ML / discrete or other units | 96 / 17 / 7 |
| Complete sufficient recipe-input vectors / recalculated recipes | **0 / 0** |
| Source approvals / admitted recipes / applied changes | 0 / 0 / 0 |

117 does not mean every such row lacks all numbers or previous studies. Existing
preparation often contains a source locator or class-level vector; the preserved
open findings still prevent full row applicability. A retained study is not
silently extended to a recipe by ingredient name. The 17 ML comprise four milk
and thirteen water rows. The seven other units comprise three eggs, two bread
inputs and two teaspoon salt inputs. Water is not assigned a density, but a future
reviewed zero-nutrient typed-water route could avoid mass conversion for nutrients
without establishing cooked yield or a universal ML rule. No such new evidence
is issued here. Optional salt remains included, not silently omitted.

`calculateCompleteConditionalRecipeInputV1` is a pure trusted offline composition
seam, not a source-evidence/admission decoder. It sums every ingredient only when
all five source-coherent axes, declared gram bases and row conditions suffice.
Missing fiber, class, quantity or optional rows produce null full totals, not a
partial sum. Integer decimal arithmetic preserves source energy and rounds only
after complete summation and division by declared servings (half up, 8 decimals).
The existing search then uses its explicit 3-decimal precision. These would be
ingredient INPUT vectors, never retained cooked nutrients, measured portions or
admitted recipe nutrition. Unknown servings leave per-serving results null.

The original 1600 reference experiment was rerun: seven days, 28 meals, 24
distinct recipes; daily declared-reference kcal remain 1599.700, 1581.300,
1600.000, 1607.100, 1567.700, 1603.800 and 1589.800. There is **no nutritional
improvement claim**. The separate sufficient-only search actually runs with zero
recipes and returns `INCOMPLETE_CATEGORY_POOL`, wrapped as
`NO_SUFFICIENT_COMPLETE_INPUT_RECIPES`; no days and no old-reference fallback.
Only the selected 24 recipes are assessed; this is not global infeasibility for
all 132. Dinner's LUNCH reuse remains an explicit reference-test assumption.

## Validation and delivery

Local PASS: 50 targeted source, applicability, consolidation and new sufficiency
tests; strict standalone TypeScript including tests; targeted ESLint; complete
application TypeScript/Vite build (no deployment). Build emitted existing
Browserslist/bundle advisories. Actual private-data checks separately confirmed
deterministic evaluation, exact 24/120/15/3/0 coverage, unchanged seven-day
baseline, zero sufficient-only days, byte/scenario tamper rejection, real runtime
publication decoder rejection (including forged flags), and unchanged original
catalog SHA256 `517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0`.
CI additionally runs the new strict checks and tests in its existing read-only
step; final remote status is recorded in the Draft PR.

Private deliverables: row-by-row JSON and Russian report covering all 24 recipes,
15 dairy comparisons, masses, blockers and repeated baseline menu. No private
recipe bodies, notes or steps are added to public Git. Public additions contain
code/tests, source responses, source/baseline digest bindings and this stage
report. Existing owner untracked files are preserved. No runtime, resolver,
database, snapshot/history, account isolation, permission or PLAN != FACT change.

## Next recommended bounded package

1. Prepare the exact Greek-yogurt class/source choice for the two simple snacks,
   explicitly showing generic 2% versus the inspected low-fat record.
2. Finish exact apple and banana row applicability for those same recipes.
3. Produce separate full conditional input calculations only if those evidence
   and class conditions are actually satisfied; retain unknown cooked yield.
4. Rerun the sufficient-only pool and report remaining category coverage.

This recommendation does not issue source approval. A consequential ingredient
class decision remains with the owner; no brand is required universally. Merges,
Supabase/STAGING writes, publication, deployment and activation still require
separate explicit authorization. One owner approval covered this four-task stage;
no subagents or extra per-item implementation approvals. Duration was not
instrumented. No background continuation is implied.
