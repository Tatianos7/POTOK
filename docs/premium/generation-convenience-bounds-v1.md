# Optional robust comparison when weekly convenience is unknown

The explicit `optimizeGenerationWeekWithConvenienceBoundsRawV1` path keeps the existing weights, hard validation, valid-before-warning priority and deterministic SHA tie break. It does not estimate convenience, set it to zero or redistribute its 0.200 weight. The existing strict `optimizeGenerationWeekRawV1` still requires all four metrics and retains its V1 receipt/output behavior.

## Proof rather than imputation

The three other metrics must be known. When only convenience is null, its existing allowed 0.000–1.000 domain induces an interval for the final weighted score. Integer arithmetic applies the same rounding at both endpoints as the normal scorer. `score` stays null; `scoreBounds.minimum/maximum` describe mathematical limits, not an assessed score. Known convenience, including a known zero, collapses the interval to the real score.

Within the preferred validation status, a candidate can win only if its minimum score exceeds every competitor's maximum. Touching endpoints are sufficient only when that candidate also wins the existing SHA tie break. A single distinct feasible week therefore needs no convenience value to be the winner within that supplied pool. Duplicate identical week hashes are not treated as distinct alternatives; contradictory assessments for them still abort.

The prospective maximum-lower-bound candidate is confirmed against all upper bounds before a result is returned. Otherwise the result is BLOCKED_OPTIMIZATION_UNCERTAINTY with no selected week. This proof is conservative: it does not assume correlated convenience values, equal missing values, probability distributions or a midpoint. It never selects merely because a lower bound is larger.

Examples with the unchanged convenience weight:

| Scores under unknown convenience | Outcome |
| --- | --- |
| A: 0.000–0.200; B: 0.800–1.000 | B is guaranteed to win |
| A: 0.400–0.600; B: 0.480–0.680 | Overlap: obtain more data, return no proposal |
| A: 0.000–0.200; B: 0.200–0.400 | B wins only if its SHA also wins the possible endpoint tie |

Only visited alternatives are compared. BEST_EVALUATED_PREFIX never becomes a global optimum claim. Missing validation evidence, absent metric sources, unknown target/diversity/reuse, malformed/bound-to-another-request assessments and source drift still block or abort. Per-meal warning evidence remains independently required; this mode does not turn unknown warning flags, recipe/source approval or safety evidence into known values. Final independent validation/currentness can still reject the provisional plan.

## Versioned receipts and explicit integration

Bounded result receipts use `potok-generation-week-optimization-result-v2` with encoding `potok-generation-week-optimization-result-canonical-json-v2`. V1 domains and fields remain unchanged. V2 retains the same visited validation/source bindings and adds comparison ROBUST_CONVENIENCE_BOUNDS, selectedScore (nullable), selectedScoreBounds and selected unknownMetrics. Each feasible evaluation records its own nullable score, bounds and unknown metric names. Unknownness in other candidates remains visible in that ledger even if the winner's score is fully known.

The candidate metadata ledger has no full week copies, and only the prospective winner's full validator result is retained. Confirmation is a linear pass bounded by the existing 1024-visit budget. This is not a live performance certification.

`createConvenienceBoundedGenerationSelectionV1` opts into the new comparison and emits a V3 selection receipt (`potok-generation-selection-receipt-v3`, corresponding canonical-json-v3 encoding) carrying the actual result digest/raw receipt and explicit selected score/bounds/unknowns. `createConvenienceBoundedGenerationProposalV1` and `createConvenienceBoundedGenerationWorkerBindingsV1` preserve that exact digest through Graph projection, canonical request/manifest binding and fresh independent pre-record validation. Invalid/missing configuration cannot fall back to the old mode. Existing factories keep their defaults.

This can consume the real computed three-metric producer with an explicitly absent convenience source. Source admission, approved metric/generation-policy binding, per-slot generation/optimization metadata, final warning storage, runtime/gateway mounting and independent currentness are still required. Tests use synthetic source/decision/authority records where marked; the weekly bounds/proof are actually computed. Receipts are integrity/binding data, not source approval or database acceptance.

No SQL, catalog/source publication, recipe/yield changes, Staging/Production mutation, deployment, route activation or generator enablement is included. Cooking remains deferred; PLAN != FACT.
