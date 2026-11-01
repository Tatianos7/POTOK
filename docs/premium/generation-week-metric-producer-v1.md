# Computed weekly metric source candidate

`createGenerationWeekMetricProducerV1` implements the existing optimization metric port from an independent request-context source, an explicit metric-definition policy and an optional independent convenience source. `createSqlGenerationWeekMetricProducerV1` reuses the existing admitted request-only preparation reader and strict context decoder. It adds no SQL, grants, connection, publisher or runtime flag. The existing SQL reader must eventually be installed and have admitted source data; a missing source yields no assessment, never fixtures or cached earlier results.

## Explicit candidate definitions

The raw `potok-generation-week-metric-policy-v1` body supplies metricPolicyRevision, optimizationPolicyRevision and the four exact algorithm identifiers below. Unknown bodies/revisions never choose a default algorithm. These are candidate scoring definitions, not a claim that a live policy was approved or published.

| Metric | Algorithm | Calculation |
| --- | --- | --- |
| targetFit | MEAN_DAILY_CALORIE_FIT_V1 | Arithmetic mean of seven existing calculateGoalTargetFitV1 calorie scores, rounded to thousandths |
| diversity | UNIQUE_RECIPE_MEAL_SHARE_V1 | Distinct selected recipe IDs divided by recipe appearances, counting a recipe once per meal slot |
| shoppingReuse | CANONICAL_FOOD_MEAL_REUSE_SHARE_V1 | (Canonical-food appearances across slots − distinct canonical-food IDs) / appearances; deduplicate each food ID within a slot |
| convenience | INDEPENDENT_WEEK_CONVENIENCE_V1 | Explicit independent normalized score; null when unavailable |

Integer arithmetic rounds count ratios to nearest thousandth. Empty denominators remain null. Different revisions of the same recipe share a recipe identity. Recipe/food names are not identity keys. Quantities or ingredient-row duplication cannot inflate appearance counts. Approved non-food definitions are excluded from this shopping metric only; they remain in the original validated recipe, nutrition and meal snapshots. Unknown cooked yield/grams are neither needed for these count metrics nor filled in.

Goal fit uses the existing daily calorie-fit formula, not a new tolerance or a weekly-total shortcut. High and low days do not cancel before scoring. Macro targets and hard source/nutrition/repetition constraints remain under the existing validators; this scalar is explicitly a calorie-fit metric. Diversity is recipe identity variety, not proof of micronutrient adequacy. Shopping reuse describes planned identity reuse, not prices, package sizes, pantry stock, actual purchases or consumption. The four optimizer weights remain unchanged.

## Independent bindings and validation

Every calculation reads the context afresh, validates its raw/canonical bytes and source bindings through the existing decoder, and checks the optimization-policy/request/input identities. The actual week passes the real V2 validator. Week/goal/plan/date/slot distribution, exact goal/balance/composition policy bodies, source constraints, per-slot nutrition/requirements and component source identities/evidence flags are checked against the independent context. Candidate preference/safety checks are reused. This does not replace final full-plan validation, warning evidence or commit-time currentness/authorization.

The convenience reply has exactly contract `potok-generation-week-convenience-v1`, requestOperationId, weekRawSha256, generationInputDigest, metricPolicyRevision, sourceRevision and score (0.000–1.000 or null). Missing data stays unknown; zero is a known score. Malformed, substituted and failed sources abort. No preparation time or ease score is inferred from ingredient counts or names.

`calculateWeekRaw` returns PARTIAL or ASSESSED with the existing metric raw DTO and a calculation receipt. `assessWeekRaw` feeds that DTO directly into the real weekly optimizer; any null metric still blocks optimization. The receipt retains policy/evidence/policy-set bindings, seven goal-fit results, selected identity counts, independent convenience revision/raw hash and computed scores. Its SHA-256 domain uses contract `potok-generation-week-metric-calculation-v1`, encoding `potok-generation-week-metric-calculation-canonical-json-v1`, key `calculation` containing content without digest/assessmentRevision.

assessmentRevision is a deterministic UUIDv8 output identity from that calculation digest. It is not a fabricated reviewer, food evidence or source-admission UUID. Repeating identical inputs produces identical output; hashes and IDs prove content binding only. Neither ASSESSED nor a receipt means APPROVED/PUBLISHED or durable source storage.

## Before live use

The metric policy must be independently admitted and pinned for the request (or through an immutable optimization-to-metric-policy binding). Merely matching its optimizationPolicyRevision or supplying constructor JSON does not do that. This package does not publish that policy or supply a live convenience source. Independent metric/receipt retention and currentness/admission still need runtime integration. Test sources and convenience scores are explicitly synthetic; the three other metrics are actually calculated from those validated fixture snapshots rather than supplied as arbitrary full-week scores.

No Staging/Production writes, catalog publication, recipe changes, deployment, route/gateway mounting or generator activation occur. Cooking remains deferred; PLAN != FACT.
