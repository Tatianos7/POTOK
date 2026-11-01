# Bounded weighted week comparison

`optimizeGenerationWeekRawV1` compares the actual visited seven-day candidates instead of stopping at the first feasible one. It reuses the existing search input contract and real V2 week validator. It pins the trusted request/input, exact supplied goal target values, goal/target/plan/composition/balance/optimization revisions, week/timezone and decoded manifest identity. Raw policy, search, input and manifest are owned before asynchronous work. Neither the evaluator nor its hashes admit source authority or issue database acceptance.

## Scoring

The existing OptimizationPolicyV1 decoder remains authoritative: targetFit 0.400, diversity 0.250, convenience 0.200, shoppingReuse 0.150. These weights are not changed. All four metrics are required, higher-is-better normalized decimal strings from `0.000` to `1.000`. The source must implement and independently admit the actual metric definitions; this comparator does not infer convenience, manufacture default scores or claim a new live metric source.

The weighted sum uses integer thousandths and the existing meal optimizer's rounding. As in that optimizer, VALID precedes VALID_WITH_WARNINGS; weighted score follows, then the lexically smaller exact week raw SHA-256 breaks ties. Zero is known and valid. Null is unknown. Missing metrics even for a later feasible candidate withhold any earlier leader. Invalid/malformed scores and source binding substitutions abort. Contradictory assessments for a duplicate visited week also abort rather than silently changing its score.

Metrics are read through `GenerationWeekMetricsPortV1.assessWeekRaw(requestOperationId, weekRaw, generationInputDigest, optimizationPolicyRaw)`. Its primitive raw reply has exactly contract `potok-generation-week-metrics-v1`, requestOperationId, generationInputDigest, weekRawSha256, optimizationPolicyRevision, assessmentRevision, metrics. The independent source supplies the assessment revision; no reviewer/source UUID is fabricated here. Port inputs permit computation from the actual candidate rather than lookup for an unknown future hash. No cross-invocation assessment cache is introduced.

## Scope and stop states

| Result | Meaning |
| --- | --- |
| FEASIBLE_PROPOSAL + BEST_IN_VALIDATED_POOL | All combinations of the supplied validated day pools were visited and scored where feasible |
| FEASIBLE_PROPOSAL + BEST_EVALUATED_PREFIX | The budget ended before all combinations; this is best in the evaluated prefix only |
| SEARCH_LIMIT_REACHED | No feasible candidate was found before an incomplete search ended |
| NO_FEASIBLE_WEEK_IN_POOL | The supplied pool was exhausted without a feasible candidate |
| BLOCKED_OPTIMIZATION_METRICS | An evaluated feasible week has unavailable metrics; no proposal is returned |
| BLOCKED_MISSING_EVIDENCE | A visited week has unknown required validation evidence; no earlier leader is returned |

Hard-invalid weeks receive no metric request and cannot win. Structural/evidence corruption throws. The budget remains 1–1024 visited combinations, with the same seven days and 1–16 alternatives per day limits. No completeness claim covers unvisited alternatives, recipes excluded earlier, options without warning evidence, or all possible catalog menus. If search stops before visiting an unknown candidate, only the prefix scope can be claimed.

## Receipts and integration

The actual result receipt records pinned policy/manifest/input, raw search hash, evaluated/total counts, budget/scope, visited week hashes and validation digests, source assessment revision/raw hash, computed scores and exact selected week/indexes. Domain: contract `potok-generation-week-optimization-result-v1`, encoding `potok-generation-week-optimization-result-canonical-json-v1`, field `result` containing content without digest. SHA-256 covers canonical safe-integer JSON. Receipt hashes prove integrity and binding, not source admission/currentness.

`createOptimizedGenerationSelectionV1` explicitly opts the existing day preparation into this comparator. Its selection receipt uses V2 and carries both the actual week optimization receipt raw bytes and digest; warning coverage remains explicit. The first-feasible V1 path and its receipt remain unchanged. Missing metrics never trigger fallback to that old path.

`createOptimizedGenerationProposalV1` binds the producer's weekOptimizationResultDigest to the actual computed result before Graph projection. Per-slot generation/optimization decision metadata remains an explicit independent producer input; it is not minted from the weekly receipt. `createOptimizedGenerationWorkerBindingsV1` keeps canonical request/manifest binding, exact accepted bytes and the fresh independent pre-record validator. All factories remain inactive unless separately mounted/enabled. Tests still use explicit synthetic upstream metrics, per-slot optimization and final authority fixtures.

No SQL, Staging/Production mutation, source/catalog publication, dependency merge, runtime/Edge deployment, route mounting, payment work or activation is included. Live upstream metric computation/admission and per-slot decision production still need implementation. Unknown yield/grams stay unknown; cooking remains deferred; PLAN != FACT.
