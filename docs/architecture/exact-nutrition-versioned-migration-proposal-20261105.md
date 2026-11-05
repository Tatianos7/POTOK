# Exact nutrition: versioned migration proposal

Status: REVIEW PROPOSAL, NOT AN ACCEPTED RUNTIME CONTRACT. No V1/V2 decoder,
issuer, Graph, SQL, RLS/grant, source, route or feature flag changes in this stage.
The existing pipeline stays inactive. PLAN != FACT. Source uncertainty, identity,
allergen/entitlement/currentness and cooking/retention questions remain distinct
from arithmetic precision. More stored digits do not prove better real-world
nutrient measurements.

## Measured requirement

The actual frozen pilot has 19 recipes, 88 ingredient inputs and 34 reference
source-class drafts (35 original binding labels, including two oat spellings).
Four FOOD rows exceed the existing Food evidence scale: three rolled oats and
one almond. The existing transfer already preserves exact reduced rationals for
components and declared servings; the week handoff preserves them for assigned
meals, days and the full week. Reuse this arithmetic rather than inventing another
nutrition engine.

An actual 7-day/28-meal conditional witness produces:

| Scope | Nutrient-axis values | Finite values needing >3 places | Nonterminating decimals | Largest finite scale |
| --- | ---: | ---: | ---: | ---: |
| All component inputs | 440 | 21 | 0 | 7 |
| Whole recipes | 95 | 15 | 0 | 7 |
| Declared servings | 95 | 15 | 7 | 7 |
| Assigned meals in this week | 140 | 26 | 6 | 7 |
| Days in this week | 35 | 20 | 6 | 7 |
| Full week | 5 | 2 | 3 | 7 |

These are representation observations, not accepted menu or dietary compliance.
The witness uses current search diagnostics and conditional ingredient INPUT
models, not measured cooked nutrients. No real server validation is attempted.

A finite decimal scale of 8, 12 or any other size cannot preserve a nonterminating
division. For example one third remains numerator `1`, denominator `3`.
In the real witness the weekly fat, available carbohydrate and fiber totals have
reduced denominators containing a factor of 3. Rounding per serving and summing
is not generally equal to summing exact fractions and projecting once.

## Recommended representation for a separately implemented version

- Retain original finite source-decimal text and exact source identity/version,
  basis, units, energy/fiber definitions, retained bytes and mappings. Keep
  trailing-zero/source spelling evidence separate from canonical numeric value.
- Represent derived authoritative calculation values as reduced nonnegative
  rational pairs of decimal integer strings. Denominator is positive, gcd is 1,
  and zero is exactly `0/1`; no JSON numbers, exponents or float arithmetic.
  A complete exact nutrition value carries all five axes, including fiber.
- Bind masses, assigned servings and formula/policy revisions explicitly. Unknown
  mass/conversion/portion data remains unknown. Typed water zeros never establish
  density; no source-basis rename establishes edible-part equivalence.
- Compare exact values with exactly lifted target values and policies. Version
  optimizer metrics, ranking/tie-break rules, warning assessment and decision
  receipts; changing numeric inputs can change winners and thresholds.
- A display projection can show familiar short numbers under an explicit policy.
  It never replaces source/exact values, is not fed back into totals/ranking, and
  cannot authorize a record. UI precision/tokens are unchanged by this proposal.
- Specify input byte/digit/quantity/denominator/aggregate budgets and reject
  overflow/resource excess before expensive arithmetic. The offline inspector's
  80-digit bound is only a diagnostic limit, not an approved runtime budget.

## Boundary inventory and required versioning

| Boundary | Present behavior | Required future change |
| --- | --- | --- |
| Food reviewed nutrition V1 | Exactly 3-place finite strings; source helper allows only lossless normalization | New nutrition representation/digest domain, retaining canonical identity and independently reviewed evidence/currentness |
| Graph V1 | Three-place values; scaling already rounds half-up | Preserve old format, hashes, calculation and historical read behavior |
| Graph V2 | Reuses GraphNutritionV1 and V1 component/meal conventions | A new explicitly versioned graph/calculation contract for exact values; no in-place widening of V2 |
| Recipe publication / manifest | V1 nutrition, evidence and exact-three-place checks | Versioned source-to-component/recipe/serving mapping and publication validation |
| Meal, goal, day/week optimization | Current fixed-scale calculations, bounds and score policies | Versioned exact comparisons, sums, policy digests and deterministic receipts |
| Independent validator / worker | Existing proposal/source/manifest bindings | New supported-version path with the same account/request/currentness checks and pre-record validation |
| SQL canonical storage / gateways | Canonical raw JSON and pinned contract/version/body checks | Versioned validation and migration package; preserve canonical bytes, SQL/TS parity, idempotency and revocation/commit fences |
| Readback / client | Explicit Graph V2 decoder and owned current-head request read | Explicit new-version decoder/readback; no silent old/new fallback or truncated cache |
| Presentation | Existing 0–3 digit formatter, default 1 | Separately specified display projection only; no layout redesign in this stage |

This is a compatibility inventory, not a claim that every row is installed in
Staging. Runtime deployment and live schema inventory require separate checks.
The offline experiment records 18 existing file hashes, including SQL review
drafts, so a later implementer can recheck the exact observed source state.

## Implementation order and acceptance

1. Review exact source-class drafts and any product-variant decisions. Use the
   existing resolver/import precheck; existing `foods` UUID/stable IDs remain the
   only food identities. No duplicate catalog or parallel authority model.
2. Implement the separately versioned exact numeric primitive/strict canonical
   decoder, retained-source mapping and Food evidence representation. Keep old
   V1 tests unchanged; no issuance or mounting by adding a decoder.
3. Implement new Graph/publication/composition/goal/optimizer/validator versions
   and exact trace binding as one compatible vertical slice. Reuse existing
   arithmetic/evidence/history/currentness primitives; preserve legacy bytes.
4. Prepare unapplied SQL canonical storage/gateway/readback changes. Prove TS/SQL
   canonical/digest parity, completeness, account isolation, stale/revoked source
   rejection, idempotency conflicts, unknown-reply recovery and both commit-fence
   lock orders in a disposable database.
5. Test real private source vectors and frozen weekly witnesses end to end through
   the new **synthetic/disposable** acceptance path. Independent exact Fraction
   checks must agree for every source/component/serving/meal/day/week axis;
   presentation must not affect authoritative outcomes. Test repeating fractions,
   finite precision edges, zero vectors, ML unknowns and budget rejection.
6. Only after compatibility review prepare the exact Staging package and obtain
   its required approval before apply. Ordinary-account Auth/owned readback,
   source approval and runtime activation remain separate decisions. Historical
   Graph V1/V2 snapshots and diary FACT are never rewritten.

## Source-class clarification

The checked-in JSON contains 32 FOOD reference-class drafts plus typed water and
salt. Proposed UUID/stable IDs stay null and all approval/apply flags false.
Short source descriptions do not establish every intended retail attribute.
The walnut preparation state stays null. Edamame's `prepared` does not prove a
particular cooking method: the earlier discovery expectation `boiled` was too
narrow and is not carried into the definition. `Whole-wheat` does not establish
a specific wheat species: the earlier wording `common wheat` was too narrow and
is not a source fact. Neither clarification changes owner intent or source data.

No additional owner choice is needed to prepare this representation proposal.
If later work needs a different fish, lentil colour, product class or retail
mapping, present that specific choice before replacing the frozen input.
