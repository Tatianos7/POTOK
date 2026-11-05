# Offline pilot catalog match review

This stage observes candidate identities for the frozen 19-recipe input set. It
does not assign canonical IDs, create reviewed evidence, reconcile nutrition,
publish recipes, call a server validator or change a database. PLAN != FACT.

`scripts/contracts/pilot-catalog-match-review-v1.ts` reuses the existing exact food
resolver with no account ID and validates complete shared-only name/alias lookup
snapshots. The original input freeze is verified before any row review. Both
original Russian and English labels are normalized; conflicting identities across
labels stay ambiguous. Repeated aliases of one consistent root are deduplicated;
changed snapshots, truncated counts and private rows reject. Missing query keys
or unavailable alias targets produce an incomplete observation, never a binding.

Read inputs must be captured using only core/brand rows with no creator and
shared aliases with no creator. They must include complete counts, capture time,
environment and project identity. Reads made with privileged SQL are catalog
observations, not proof of ordinary-account RLS accessibility or currentness.
The exact lookup covers only the submitted keys and shared alias scope; no exact
match is not evidence that the food is absent from the whole catalog.

Candidate UUIDs and stable IDs remain observation fields. Proposed bindings stay
null. Null/missing schema review flags remain unknown; they are not changed or
interpreted as explicit approval. The existing resolver's identity eligibility
and stricter publication/accessibility questions are reported separately.
Numeric equality is decimal equality only, never source/state equivalence.
Missing/invalid nutrient text remains visible. No calories, fiber, carbohydrate
semantics, ingredient state, density or quantity is repaired. Water/salt retain
their existing typed evidence routes; a zero vector cannot approve either.

Fresh private observations on 2026-11-05:

| Environment | Shared foods | Pilot rows | Exact candidate rows | No exact match rows |
| --- | ---: | ---: | ---: | ---: |
| Staging | 2200 | 88 | 47 | 41 |
| Production | 1745 | 88 | 35 | 53 |

There are 69 food rows and 19 typed water/salt rows. Food-only exact candidate
coverage is 28/69 in Staging and 16/69 in Production. Staging has 11 distinct
candidate foods, Production 10; none is admitted by this observation. Only salt
has a complete five-axis catalog vector among these candidates. All observed
review/search flags are null or absent, and source-input nutrient differences
remain unresolved. No ambiguous eligible exact matches occurred for this key
set; this is not a claim about the whole catalog.

The private catalog snapshots, recipe rows, comparison packets and account data
are not committed. CLI inputs are the original candidate JSON, the existing
model packet containing `expandedInputModels`, and one shared lookup snapshot.
The output is an offline observation, rejected by the runtime authority decoder.

Next bounded work: inspect shared catalog candidates for the remaining labels
using explicit ingredient-state constraints, keeping discovery separate from
exact resolution. Then prepare a specific source/identity review queue with
existing evidence contracts; no automatic alias creation, flag repair, source
approval, live binding or publication. Cooking/yield checks remain deferred to
owner prelaunch testing.
