# Request-bound exact weekly numeric validation V3

Status: unmounted **numeric precheck only**. Not the complete existing menu
validator, Graph V3 admission, published plan or a storage/activation permit.

## Existing interfaces and values retained

The full `validateGeneratedWeekPlanTrustedV1` requires Graph V2 and three-place
actual nutrition, published manifest/eligibility, portion/composition/recipe
identity, dietary/allergen/preference evidence, repeats, warnings and other
policy checks. Exact weekly input snapshots are a distinct protocol. They are
not rounded into that legacy format or inserted into a fake Graph carrier.

The new adapter reuses:

- `GenerationValidationAuthorityPortV1.loadForProposalRaw(operation, rawSHA)` as
  the independent trusted server read signature; no new ledger/role fallback.
- Existing admitted `TrustedGenerationInputV1` metadata/digest and Goal target.
- The current Goal V1 decoder, compared in full with the admitted immutable Goal.
- Existing balance-policy snapshot decoder/digest/revision and literal component cap.
- The existing private meal-distribution decoder through an additive raw export,
  with the same dates, slot coverage/order/type, bounds and revision checks.
- Exact-week re-preparation, retained-source and Food/Nonfood event-time checks.

The V1 admitted input is used as real request/Goal/policy context, not to claim
its legacy candidate manifest admits the exact recipes. That publication and
Graph migration remains explicitly pending. The new distribution wrapper has no
policy provenance/currentness authority by itself; it only reuses representation
validation. Old bytes/decoders and policy constants are unchanged.

## Trusted V3 source package

The factory captures the read port and independent event-authority verifier.
Its only public call takes operation UUID and snapshot text. A generator cannot
supply goals, policies or source contexts as method arguments.

The port must independently load a V3 package from admitted request and current
atomic trusted-store state. It includes exact operation/proposal raw SHA, source
request and snapshot digests, admitted input raw/digest, current Goal raw, existing
balance snapshot raw, distribution raw and complete recipe source contexts.
An old V1 package is rejected; existing loaders are not automatically V3-capable.
No actual V3 database loader or Auth/JWT verification implementation is supplied.

The adapter rejects malformed/unavailable source packages, operation/proposal/
input mismatches, stale current Goal or policy, account/selection/week/timezone
substitution and changed/missing/extra slots. It re-prepares the complete exact
snapshot and source histories before checking limits. Consistent hashes do not
prove authenticity, completeness or currentness: the real read port must uphold
those contracts. A later write needs the existing transactional final recheck.

Proposal bytes are bounded to 262144 UTF8 bytes/depth12; the V3 authority wrapper
is bounded to 8388608 bytes/depth24 before the recursive duplicate scanner.
Nested protocol strings have their own smaller bounds. Lone raw surrogates,
unsafe numbers, negative zero and duplicate keys reject. Original nested raw
receipt bytes are preserved. No secrets/payloads are logged by this boundary.

## Exact checks performed

| Check | Actual | Reference |
| --- | --- | --- |
| Meal nutrition | Exact meal vector | Existing distribution meal min/max |
| Meal distribution | Same exact meal vector | Independently supplied distribution min/max |
| Day Goal | Exact day vector | Existing current/admitted daily Goal min/max |
| Week Goal | Exact week vector | Daily Goal bounds multiplied exactly by seven |
| Meal component cap | Actual component count | Existing balance-policy maxComponents=5 |

All bounds are inclusive. Supplied three-place policy decimals convert losslessly
into rationals; actual source/recipe/portion totals retain full exact precision.
Null optional Goal axes stay unspecified and are listed separately, not converted
to zero. No Goal auto-adjustment, new numeric limits, rounding or residual
allocation is introduced. Policy targets are not treated as additional hard
bounds; min/max remain the existing hard limits.

Violations identify check/scope/path/axis, exact actual value and exact limits.
A reference rounded to three places cannot mask a true violation: for example
378866123/3000000 is below a minimum 126.289 even though a three-place display
would meet that minimum. Result digests bind the exact raw source/proposal,
admitted input, Goal/policy digests and the pending gates.

## Deliberately no accepted-plan result

Every result sets `accepted=false`, `canRecord=false`, `canActivate=false`.
Numeric pass returns NUMERIC_CHECKS_PASSED_PENDING_VALIDATION; numeric violations
return NUMERIC_LIMITS_REJECTED; unavailable/inconsistent inputs return BLOCKED.
No generatedPlanRaw, storage receipt or mutable plan is returned.

Graph/publication and exact portion admission, composition/pairing/protein/produce,
canonical repeat families/recipe/ingredient/accessibility, allergen/dietary/
preference conflicts, warnings/optimization and Auth/Premium/currentness/record
checks remain mandatory. The synthetic passing fixture intentionally repeats a
recipe 28 times and has no reviewed produce/protein classification: it demonstrates
why numeric pass is not full menu acceptance. Unchecked source requirements are
not silently converted to false or approved by this gate.

No real source approval or 19-recipe admission, Supabase call, new service,
migration, diary/FACT mutation, merge/deploy or runtime/generator activation.
Parent #346 head `45db14daa9ddc0d1e50f2b19e1af97bef0d66872` passed PR checks and
PostgreSQL admission; its Edge workflow run42157526143 failed and remains blocked.
Next implement exact Graph and the remaining established validation/publication
gates, then versioned storage/readback and separately authorized rollout.
