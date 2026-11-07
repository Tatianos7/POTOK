# POTOK · Pilot frozen19: unresolved food-family review gate (2026-11-07)

**Status:** PROPOSED / NO FOOD IDENTITY SELECTED / NO SOURCE APPROVAL / NO DEPLOYMENT.

## Evidence boundary

- Input: `family-review-aggregate-v2.json`, private Staging observation 2026-11-06, 667 shared core/brand catalog rows, 19 pilot recipes, 69 food ingredient rows.
- 59/69 have name-family candidate observations **only**, not independently approved food identity/source-state matches. The other **10 rows** span the following five source groups. The aggregate does not state how many occurrences belong to each group; do not guess.
- Fresh *bounded name-prefix* observation in Staging, 2026-11-07 (read-only, not exhaustive, no identity claims): milk 20 / explicit 2% label 0; plain yogurt 0 / Greek label 0; soy/edamame 5 / named edamame 0; lentils 4 / named brown 0; pasta 9 / whole-grain label 1. A prefix search is **not proof of absence** or suitability. Availability, flags, cooking state, provenance, ingredients, exact basis, source-revision and numeric semantics were **not independently verified** by this query.
- Fresh source-identity audit and canonically resolved/prechecked match are required before any issuer request or recipe publication. `food_nutrition_review_v2` must not be called from this packet. Never run a pilot import/writer against Production.

## Decision queue (five groups; 10 unresolved ingredient rows total)

| Source record | Recipe intent / exact blocker | Required decision/evidence | Safe route until proven |
|---|---|---|---|
| `SR28:01174` | Nonfortified cow milk with **2%** fat; generic milk, 2.5%, 3.2%, and non-dairy milks are not equivalent | Verify label, actual 2.0% fat, additives/fortification, as-sold state and source-specific nutrients per 100 g. Separate source applicability from recipe preference | Independent import precheck or exact existing identity; unresolved meanwhile |
| `SR28:01287` | **Plain, unsweetened Greek yogurt**; recipe preference for 2% does not make generic/other-fat yogurts nutrition-equivalent | Verify actual Greek type, plain/unsweetened, nominal fat 2%, product identity and per-100g nutrition, as-sold state | Independent import precheck or exact existing identity; unresolved meanwhile |
| `SR28:20124` | Dry **whole common-wheat** pasta (not spelt, not cooked) | Check entire grain species/composition, dry state, enrichment and specific nutritional basis; one label candidate in bounded query is **not** a selected ID | Explicit reviewer comparison of observed candidate; unresolved until verified |
| `FDC_SR_LEGACY:168411:PREPARED:100G` | Shelled, frozen/prepared **edamame**, not dry mature soybeans | Require documented shelled/whole-pod distinction, raw/frozen/prepared/cooked state, edible weight basis, actual retained source and nutrition | Independent import precheck or exact existing identity; unresolved meanwhile |
| `FDC_SR_LEGACY:172420:DRY_RAW:100G` | Whole **brown** dry lentils; referenced legacy source does **not** disclose colour/cultivar | Do not assert brown source equivalence on a generic lentil row; validate intended recipe attribute and find independent matching definition/source or retain no binding | Independent import precheck or exact existing identity; unresolved meanwhile |

## Admission requirements for each occurrence

1. Record a **fresh** scoped Staging snapshot with the actual candidate food ID, canonical root, source/brand ownership, visibility/searchability/review flags, preparation state and supporting retained-source artifact.
2. Record an explicit **manual** decision, not name-only or alias-only inference, for identity and applicability. For absent identity, use the approved precheck flow rather than auto-creating foods.
3. Check numeric provenance, carbohydrate semantics **excluding fiber** for RF, per-100-g edible basis, source timestamp/revision and digest pins. A matching label or nominal fat alone does not establish this.
4. Only after required checks can a separately reviewed package propose an exact-source review request. No activation, recipe mutation or live app menu publication here.
5. Any unknown, conflicting state, missing primary source, or stale observation => **UNRESOLVED**, not a fallback substitution.

## Owner input

Existing product preference for **plain unsweetened Greek yogurt 2%** is already known and **not being asked again**. Unreported colour/cultivar in the lentil source remains unknown regardless of intended brown recipe. If no exact evidence is found, leave the ingredient unresolved rather than invent its state or nutrients.

**Next technical gate:** produce a privacy-safe per-occurrence mapping with exact recipe/source row references from the frozen19 candidate, then independent import precheck and live snapshot re-evaluation for these five groups; do not assume the earlier aggregate covers every possible alias.
