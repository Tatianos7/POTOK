# Grain sources and remaining-row triage, 2026-11-04

Continues #312's 64-row candidate-source preparation reach. The entire remaining
56-row set from the unchanged private pilot packet is now assigned a review route.
Seven rows have newly checked grain sources; seven have existing source captures
linked for row-specific review; 42 still need source preparation. This covers
work assignment, not publication or complete recipe validation.

## Newly checked dry ingredient sources

Directly inspected the exact Mean columns in the official USDA ARS SR28
[Cereal grains and pasta report](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg20.pdf),
SHA-256 `3b71f757854a58af57256864f144e4215a2f56da52fdc90bbd57360bfc234b05`.
Eight exact source pages were rendered and visually checked. The source file
matches the already downloaded version. Each selected label covers one row.

| Authoring ingredient | NDB / PDF page | kcal | Protein g | Fat g | Total carbohydrate g | Fiber g | Candidate available carbohydrate g |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Крупа перловая | 20005 / 21 | 352 | 9.91 | 1.16 | 77.72 | 15.6 | 62.120 |
| Мука гречневая | 20011 / 27 | 335 | 12.62 | 3.10 | 70.59 | 10.0 | 60.590 |
| Булгур medium/coarse | 20012 / 39 | 342 | 12.29 | 1.33 | 75.87 | 12.5 | 63.370 |
| Паста пшеничная 100% цельнозерновая | 20124 / 253 | 352 | 13.87 | 2.93 | 73.37 | 9.2 | 64.170 |
| Рис белый длиннозёрный | 20044 / 328 | 365 | 7.13 | 0.66 | 79.95 | 1.3 | 78.650 |
| Рис круглозёрный | 20052 / 355 | 358 | 6.50 | 0.52 | 79.15 | 2.8 | 76.350 |
| Паста пшеничная сухая | 20120 / 198 | 371 | 13.04 | 1.51 | 74.67 | 3.2 | 71.470 |

All figures are per 100 g edible dry/raw source portion. Available carbohydrate
is an unapproved candidate under the existing retained total-minus-fiber mapping.
Keep source protein and energy; do not recompute either from a universal factor.
Workbook FDC IDs are unverified crosswalk claims. No recipe was recalculated.

The rice sources in this table are enriched. Recipe labels alone do not establish
that class. For comparison, NDB20452, raw unenriched short-grain rice, page 358,
has the same four listed K/B/F/total-C numbers but a blank fiber Mean value.
The comparison retains fiber and available carbohydrate as null. Neither zero
nor 2.8 g is borrowed from another record. This is an observed SR28 distinction,
not proof of which NDB record the workbook's FDC ID identifies.

Likewise, a 100% whole-wheat pasta reference does not permit multigrain, legume,
ordinary or partly whole-wheat pasta substitution. The existing exact-class
publication block remains. The flour source specifically describes whole-groat
flour; it does not establish the roasting state of a separate buckwheat-grain
recipe. No cooked values or hydration factor are applied to these dry input grams.

## Existing captures reused for review

Two pear rows, two apple-with-skin rows, one raw skinless boneless chicken-breast
row, one potable-water row and one fine-salt row now point to earlier retained
captures with pinned hashes. These are seven review candidates, not seven resolved
bindings. No name alias, canonical UUID or new review receipt is issued.

Pear authoring carbohydrate 15.2 is kept distinct from the retained source 15.23.
Apples retain the existing SR27 source version rather than silently claiming a
new SR28 verification. Water and salt need their existing typed food/nonfood
representation review; zero macros confer no exemption. Repeated source pages
were not re-downloaded merely to reclassify labels.

## All remaining rows have explicit next work

The [56-row ledger](retained-sources/grain-review-20261104/remaining-row-review-v1.json)
retains exact ingredient/recipe IDs, recorded quantities/units, original unresolved
status, publication-block observations and pending review codes. Routes reconcile
as 7 new grain candidates + 7 existing-capture candidates + 42 outstanding = 56.

Among those rows, 15 require dairy-class or product nutrition mapping; a brand is
not universally required, but an appropriate independently reviewed class/source
is. Existing tvorog/yogurt NO-GO decisions are not relaxed. Four milk rows have
ML quantities requiring a reviewed volume-to-mass basis, including the rows with
an already copied numerical gram reference; an approximation is not a measurement.
Egg-piece reference mass is not measured edible mass. Canned/drained products,
processed products and frozen berries retain exact composition/state/quantity
checks. Pollock's proxy and the oat source's different reference remain open.

Candidate preparation now reaches 78/120 rows when the reused capture locators
are counted. Forty-two rows remain outside that preparation. All 120 original
canonical bindings are still UNRESOLVED, including the 78 candidates. This number
does not imply that any complete recipe or runtime manifest is ready.

The [grain packet](retained-sources/grain-review-20261104/source-candidates-v1.json)
is separate from reviewed runtime publication input. Full recipe bodies remain
private. No source workbook, original export, live database, historical snapshot,
runtime policy, deployment or activation changed. Physical cooking/finished-yield
checks stay deferred to owner prelaunch application testing.

Tests pin source captures/mapping, short-grain missing fiber, exact/disjoint
56-row routing, reused capture bytes, outstanding dairy/liquid checks, unchanged
quantities and rejection by the real reviewed publication decoder.
