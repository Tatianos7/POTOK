# Exact recipe input nutrition V2

Status: unmounted **FOOD-only preparation slice**, not Graph V3, recipe approval,
publication, cooked nutrition or a runtime generation input.

## Request and arithmetic

A versioned raw request binds authoring recipe/revision, ordered complete row
list and nullable declared servings. Every FOOD row names the existing food,
state, explicit per-100g basis, exact positive rational grams and pinned nutrition
revision, source proposal and mapped numeric input digests. Authoring row IDs
remain literal tokens, not invented canonical food or recipe IDs.

The request has a separate SHA256 domain and must match the independent caller
pin. Missing, changed, duplicated or extra rows/quantities/servings are not silently
normalized. Up to 128 rows are allowed within the shared bounded duplicate-aware
raw protocol. Every amount uses the existing canonical reduced scalar V2.

Each contribution is exactly `per100 * weightG / 100`; whole nutrition and input
mass are exact sums. With declared servings, conditional serving nutrition is
`whole / declaredServings`; with no declared servings it stays null. No density,
whole-to-edible correction, gram-to-volume conversion, cooked retention or measured
portion is inferred. PER_100_G_FOOD and PER_100_G_EDIBLE remain distinct and must
match the numeric source. The supplied grams must describe that same source basis.

The immutable snapshot retains every input, contribution, whole total and optional
serving fraction. Its status is represented by `authority: NONE` and
`calculationBasis: INPUT_COMPONENTS_NO_COOKING_RETENTION_CLAIM`. `cookedYieldGrams`
is always null; input mass is not a measured cooked yield. The raw snapshot decoder
recomputes all arithmetic and compares the complete snapshot, not merely its own
hash. Display-only rounded values cannot replace exact snapshot fields.

## Existing review boundary

`prepareExactRecipeNutritionRawV2` captures every trusted snapshot before its first
await. It delegates each ingredient to the existing exact Food reviewed-read
adapter, with full canonical/nutrition approvals, current heads/state, independent
source pins, complete event history and event-time authorization. It then checks
all row food/state/basis/revision/source/numeric bindings. Any unavailable, stale,
invalidated or unauthorized row blocks the entire preparation, with no partial
nutrient result. Distinct rows using the same food remain distinct.

A successful result is only PREPARED_EXACT_FOOD_INPUTS_V2; the embedded calculation
still has authority NONE. It does not establish recipe source, allergens, dietary
eligibility, portions, publication or authority at subsequent storage time.
The caller must load atomic complete trusted context, not client-supplied JSON.
Independent request hashes are integrity pins, not owner approval or credentials.
There is no real store, authenticated issuer or transactional write implementation.

## Typed nonfood remains blocked

POTABLE_WATER and SALT rows have explicit positive amount and unit; water may use
g or ml, salt uses g. They retain their kind instead of receiving fake food IDs.
Both currently yield NONFOOD_EVIDENCE_NOT_INTEGRATED. No implicit zero vector,
inferred water mass or omitted row can turn a mixed recipe into a successful
FOOD-only calculation. This does **not** make the 19 mixed pilot recipes admissible.
Next reuse the existing typed Nonfood review/definition/nutrition mechanisms,
then extend exact meal/week/Graph, validator/storage/readback compatibility.
No old Graph/recipe/diary wire or decoder is widened.

## CI checkpoint and execution constraint

Parent #343 head `d4cd31a2e9ee88884f712a2ed1a5413f9e5adbe5` passed PR checks and
PostgreSQL admission. Edge worker run 42071039336/job127398706183 reproduced the
known strict pg acquisition blocker documented in
[generation-preparation-cpu-20261103.md](../security/generation-preparation-cpu-20261103.md).
Actual Edge peer raw DER was unavailable and valid/wrong-password acquisitions
failed; the same Node baseline passed all eight cases. Wrong CA/name rejected
properly. Robust worker completed, strict worker was resource-cancelled in this
sample. These are fixture observations, not hosted readiness or a new regression
attributed to exact nutrition code.

No TLS/channel-binding setting, runtime image, CPU limit, test gate or driver is
changed to force green CI. Edge remains blocked; no live connection or Supabase
operation was attempted here. The exact preparation code remains isolated from
runtime activation, PLAN/FACT, diary, DB and network writes. Source bytes, owner
choices and cooking deferral are unchanged. No new external service is connected.
