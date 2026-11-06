# Exact week comparison and generator decision V3 (inactive)

## Integration boundary

This module connects independently supplied complete exact-week candidates to the existing exact Graph V3 preparation/validation and a separately versioned metric-assessment port. It does not produce a real catalog, invent scores, approve source identities, mount a runtime route or implement a database/metric issuer. The operation-only entry loads a server-owned pool with the admitted input, unchanged OptimizationPolicyV1 and explicit comparison mode/evaluation budget. Operation IDs and hashes do not replace Auth, provenance or source currentness.

The pool is bounded to 64 complete weeks, 64 evaluations and 16 MiB of raw input. Each candidate has an independently pinned actual snapshot byte SHA, and duplicate bytes/semantic snapshot identities reject. This is a provided pool, not a claim that every possible recipe/day combination has been enumerated. Graph V1/V2, the legacy optimizer/search and their three-place wire formats are unchanged.

Every visited candidate reruns exact Graph V3 preparation: source/event-time authority, exact nutrition, publication/portion/safety/preferences/composition/repeats, the ordinary-week witness and warning subject assessments. A known rejected candidate can be skipped and is retained in the receipt. A blocked candidate remains unknown and blocks selection; it cannot be treated as inferior. All candidates must use the same immutable admitted input and actual preference/safety/composition/Goal/balance/distribution context. Shared recipe/publication definitions cannot change between candidates. The exact source package is captured from the graph adapter's one store read, not fetched a second time.

## Metrics and exact comparison

An independent server assessor receives the actual canonical exact graph, input digest and policy bytes. Its versioned assessment must bind operation, input, graph bytes/digest, evaluated snapshot SHA, policy bytes/revision and an assessment revision. All four metrics are explicit rational values in [0,1]; no metric formula, convenience value, measured quantity or source authority is inferred by this adapter.

Existing weights stay targetFit 0.400, diversity 0.250, convenience 0.200 and shoppingReuse 0.150. Existing priority stays warning-free before warning-bearing weeks; ties use stable snapshot byte SHA. V3 uses exact rational weighting and comparison and does not round nutrition, metric values or weighted scores into the legacy three-place score representation. The pure score helper is arithmetic only, never an assessment issuer.

STRICT mode requires all four values. ROBUST_CONVENIENCE_BOUNDS mode permits only convenience to be unknown: its exact contribution ranges from 0 to the existing 0.200 weight. The score remains null and its bounds/unknown metric remain explicit. A candidate wins only if its lower bound defeats all same-priority competitors' upper bounds, including the existing deterministic SHA tie break at equality. Otherwise selection is blocked for uncertainty. No imputation, reweighting or silent strict-to-bounded fallback occurs.

A fully visited pool is BEST_IN_VALIDATED_POOL; a budget-limited valid result is only BEST_EVALUATED_PREFIX. With no valid visited candidate, the outcomes distinguish SEARCH_LIMIT_REACHED from NO_FEASIBLE_WEEK_IN_PROVIDED_POOL. Neither outcome proves global menu impossibility. Missing evidence never becomes a no-plan proof.

## Receipt and generator decision

The canonical optimization receipt binds source pool bytes, normalized candidate pool/order/budget, admitted input, policy, all visited validation results, graph digests, assessment bytes/revisions, exact score bounds, priority and selected index. A separate generated-week proposal binds the unchanged selected exact graph/snapshot, receipt and per-slot decision paths/subject digests. Generation-policy and manifest revisions come from the admitted input; this is not independent proof that a generation-policy issuer has approved the result.

The parent proposal resolves the child graph's pending-optimization condition by binding that exact graph to its comparison receipt; it does not mutate or relabel the child graph or make it a legacy accepted plan. Both remain authority NONE, accepted=false, canRecord=false, canActivate=false, facts empty. Final Auth/Premium, current source/metric issuance, transactional storage and persisted readback are separate requirements. Prefix scope/unknown score bounds remain visible for that final admission policy.

Readback reloads the pool, graph sources and metric assessments and recomputes the complete result before comparing canonical proposal contents. Drift that leaves the same winner but changes source/assessment bytes still changes the receipt. No cached decision is treated as current authority and there is no store write.

## Verification and limitations

Synthetic tests cover exact near-ties, weighted fractions, strict/bounded uncertainty, warning priority, SHA ties, budget scope, rejected versus unknown candidates, metric/policy/proposal substitution, context/publication drift, full receipt digests, readback and write denial. Independent Python Fraction comparisons cover 1,024 deterministic rational vectors/intervals. Existing exact source/Graph and legacy optimizer/validator tests run separately. Fixtures establish no approval for the real 19-recipe catalog.

PR349 exact head 6f08c5591a74227d50938ae89185099c171218cf passed PR Checks run42163310754 and PostgreSQL admission run42163310749. The separate Edge compatibility run42163310806 still failed; no TLS, channel-binding, source or test gate is relaxed. This stage adds no external service, paid account, runtime activation, migration, DB mutation, merge or deployment. Next: connect the exact selected proposal to final transactional server admission/storage/readback, while real catalog/source/metric issuance and application acceptance remain explicit dependencies.

Local validation: 828 existing source/Graph/validator/legacy optimizer tests plus 18 exact optimizer scenarios passed (846 tests). Targeted strict TypeScript, ESLint and production build passed. All 1,024 rational score/interval cases matched independent Python Fraction results. Existing browser-data/chunk build advisories remain. Hosted CI results must be checked separately on the published commit.
