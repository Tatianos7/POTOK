# Actual bounded-selection provenance

`createGenerationSelectionV1` captures a receipt from the same actual catalog/day/week invocation that selected the proposal. It adds no second source read, generator replay, cross-call cache or source-authority issuance. The existing `createGenerationDayOptionsV1` keeps its original runtime output without a receipt.

The receipt binds request/input/manifest/generation-policy/evidence/policy digests, actual configured budgets, raw search-input SHA-256, raw selected-week SHA-256, visited/total combination counts, selected option indexes and actual week-validation subject digest. Ordered slot pools retain each real prepared meal digest, source kind and isolated composition distance, plus the warning-admitted meal/evidence digests. Each candidate-set digest hashes that exact pool under `potok-generation-slot-candidate-set-v1`, including request/input/slot identity. Selected entries bind those set digests to actual chosen meal snapshot digests and source kinds.

The receipt digest is SHA-256 over canonical safe-integer JSON `{contract, encoding: 'potok-generation-selection-receipt-canonical-json-v1', receipt: contentWithoutDigest}`. The receipt contract is `potok-generation-selection-receipt-v1`. Neither a content hash nor this locally generated receipt proves independent source admission or persistent database acceptance.

## Search scope

The current search is `BOUNDED_FIRST_FEASIBLE`, not exhaustive weighted week optimization. `warningCoverage` is COMPLETE or PARTIAL according to the actual prepared options for which warning evidence was available. A feasible week with partial warning coverage remains explicitly partial; the receipt does not assert that unknown options were assessed or inferior. Counts/indexes describe the available validated day alternatives, not all conceivable catalog combinations. Isolated composition scores are the existing composition distances, not fabricated convenience/diversity/shopping scores.

No optimization result digest, optimality flag or food/reviewer approval is minted here. Real optimization policy bodies, metrics and their computation remain separate work. In particular a hash of this bounded-search receipt must not be relabeled as an optimization result.

## Stricter proposal and worker bindings

`createSelectionBoundGenerationProposalV1` passes the actual request, selected week raw bytes, internally produced receipt raw bytes and trusted context raw bytes to `GenerationSelectionDecisionPortV1.produceDecisionTraceRaw`. This avoids requiring a stored decision trace for an unknown future week hash. The producer still has to return real independently grounded generation/optimization metadata; null withholds the proposal.

Before Graph projection, the pipeline rejects mismatched request/week, slot coverage/duplicates, source kind, candidate-set digest or selected-candidate digest. In this new path `selectedCandidateDigest` is the actual chosen meal snapshot digest and `candidateSetDigest` uses the pool domain above. Graph V2 revision/manifest checks and the full independent plan validator remain mandatory. The old V1 lookup path remains unchanged for existing inactive assemblies; no default switches to the stricter path.

`createSelectionBoundGenerationWorkerBindingsV1` reuses the existing canonical loaded request/input/manifest byte binding and fresh independent pre-record validation. It does not mount an RPC/Edge route or create a connection, credential, role switch, database writer or runtime flag. Both independent validations preserve exact proposal bytes. Tests use explicitly synthetic optimization digests and authority/gateway fixtures where applicable; they are not live optimization/source publication proof.

This change prepares selection-bound integration but does not install SQL, publish real recipes/manifests, compute weighted optimization receipts, merge the draft stack, activate a gateway/route or enable generation. Unknown yields stay unknown, cooking remains deferred and PLAN != FACT.
