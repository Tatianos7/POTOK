# Deterministic warning assessment candidate

This inactive server module computes the five existing warning booleans from explicit numeric metrics and independently sourced thresholds. `createAssessedGenerationWarningPortV1` implements the existing preparation warning port; it does not publish source rows or activate any worker.

Inputs cross primitive raw JSON boundaries, reject duplicate/unknown/missing fields, and bind the facts to the actual request, input digest, validation evidence/policy digests, slot, decoded meal digest and assessment policy revision. The existing actual-meal warning decoder checks the output and its existing digest domain. Goal/slot/composition checks remain in that decoder. Final full-plan/set validation remains mandatory.

## Metrics and comparison semantics

The source must supply all five metrics explicitly. Numeric values and thresholds are nonnegative safe integers; negative zero, strings, booleans and fractions are invalid. Convenience is normalized to 0–10000. Basis points for deviation/utilization may exceed 10000. A null metric means unknown, never zero.

| Metric | Unit | Warning condition |
| --- | --- | --- |
| targetDeviationBasisPoints | absolute deviation in basis points | value > threshold |
| preparationMinutes | minutes | value > threshold |
| distinctShoppingItems | distinct item count | value > threshold |
| convenienceScoreBasisPoints | normalized score, higher is easier | value < threshold |
| maximumRepeatUtilizationBasisPoints | maximum utilization of applicable repeat limits | value > threshold |

Equality does not warn. All thresholds are explicit under a separate `assessmentPolicyRevision`, also pinned to the validation policy revision. **No production threshold values or scoring formula are introduced.** Thresholds in tests are synthetic examples only. A producer must document the actual deviation/scoring/repeat metric definitions in its admitted policy before live use; this comparator does not infer their meanings from nutrition/calories or approve that policy.

`assessGenerationMealWarningsRawV1` returns `BLOCKED_MISSING_ASSESSMENT_FACTS` with missing metric names and no warning payload. Otherwise it returns the existing warning raw DTO plus raw source/policy hashes for diagnostics. These hashes prove integrity, not authority, review or durable admission. `evidenceRevision` comes from the independent facts source; the evaluator does not fabricate review IDs.

The port reads sources afresh, verifies all lookup bindings, maps a missing source/metric to null, and propagates malformed-source and transport errors. It never caches earlier availability. Each source bundle has exactly `factsRaw`, `assessmentPolicyRaw`, `policiesRaw`, `trustedContextRaw`, `mealSnapshotRaw`, all primitive strings. Neither source facts nor policy may originate from generator-proposed authority payloads.

## Remaining source work and limits

Existing recipe snapshots lack preparation time, and current balance policies lack these soft thresholds. This change implements computation once those independent sources exist; it does not manufacture missing facts, approve thresholds, publish recipes, or claim live warning coverage. Shopping/repetition metrics involving multiple meals depend on the actual candidate selection. The current lookup binds a meal/request but does not prove a whole-week selection, so this preparation adapter must not be used as proof of those week-level metrics; they still require an independently bound final-plan assessment. Missing such data must remain null. A future whole-week producer needs an exact candidate-context binding, not a reused per-meal assessment.

No SQL changes, Supabase writes, deployment, route mounting, generator activation, cooking requirement or PLAN-to-FACT conversion are included.
