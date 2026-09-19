# Recipe content preflight v1

This is an offline review format, not a new runtime schema or a production
catalog. Existing `recipe_ingredients` remains the intended canonical graph.
The Premium graph bridge and server policy still require a separate owner
decision. No ingredient importer is invoked by this workflow.

## Inputs

`data/recipes/recipe-candidates-v1.json` contains four authored candidates, one
for each meal category. They have no invented calories/macros or UUIDs. Semantic
ingredient IDs are **requested mappings**, not claims that a food exists.
Preparation and portion sizes require human culinary review before acceptance.
Dry quantities and edible ingredient weights are specified in the descriptions.

Each candidate carries stable content identity, title, description, servings,
preparation time, category, tags, provenance, ordered steps and ingredient grams.
Candidate nutrition fields are ignored; totals are calculated from foods only.

Supply a local canonical export with this envelope:

```json
{
  "exported_at": "ISO timestamp of the actual export",
  "source_project_ref": "actual source project ref",
  "foods": []
}
```

Each food needs the existing `id`, `stable_food_id`, `canonical_food_id`, name,
source, verification/review/searchability flags and nutrition per 100 g.
Normalize actual `is_verified`/`verified` schema differences explicitly during
export; do not assume a missing flag means approved. Numeric fields must be
numbers; fiber may be null. Only reviewed public core/brand roots are accepted;
private user foods cannot enter a shared catalog.

## Run

```sh
node --import tsx scripts/recipes/runRecipeDryRun.ts \
  --recipes data/recipes/recipe-candidates-v1.json \
  --foods /path/to/canonical-export.json \
  --output /path/to/new-review-report.json
```

No network, env loading, Supabase client, apply flag or import mode exists.
Output creation is exclusive: an existing output/input file is never overwritten.
Exit 1 means rejected/review recipes; exit 0 only means automated checks passed.
`publishable` always stays false: owner review and staging validation are required.
Input hashes and export provenance make each run reviewable and reproducible.

## Validation and calculation

- Exact `stable_food_id` -> unique canonical UUID; no fuzzy or first-match lookup.
- Reject unknown/ambiguous/private/non-root/unreviewed/hidden/invalid-macro foods.
- Require finite positive grams and integral portions, nonempty preparation.
- Calculate unrounded ingredient contributions and round totals/per-serving once.
- Preserve unknown fiber as null; distinguish confirmed zero.
- Reject all-zero recipes; zero-calorie ingredients such as water remain possible.
- Flag food bounds, recipe portion calories outside 50–1500 and energy/macronutrient
  mismatch over max(100 kcal, 30%) for review. These are triage thresholds, not
  medical guidance, dietary targets or changes to goal formulas.
- Detect repeated recipe IDs and equal canonical grams per serving, including
  split ingredient rows and scaled portions. Reject both duplicates, not an
  arbitrary input-order winner.
- Flag equal normalized titles or >=80% ingredient-set overlap for near-duplicate
  review. Human review must distinguish intentional cooking-method variants.

Summary food counts are unique unresolved/ambiguous semantic IDs; duplicate and
outlier counts are affected recipes. Issues retain exact ingredient/candidate IDs.
No partial nutrition totals are returned for unresolved recipes.

## Current sample state and gates

No fresh canonical export was available/queried in this run. Testing against an
empty input deliberately rejects all four candidates; this is a fail-closed
test, **not** a statement that staging or production has an empty food catalog.
There is no valid/imported production recipe dataset from this package.

Next: actual canonical availability audit -> adjust ingredients -> recompute
and validate small sample -> culinary/owner review -> scale in reviewed batches
-> dry-run -> exact staging import checkpoint -> staging verification -> separate
production readiness and approval. Do not scale or publish this sample now.
