# Missing Food Review Foundation Design

- Timestamp: 2026-08-04T00:00:00Z
- Basis: `reports/food-search-quality-candidate-resolution-audit-2026-08-04.md`
- Related status: `reports/admin-approved-alias-apply-production-smoke-final-status-2026-08-03.md`
- Scope: read-only design/audit for a Missing Food Review foundation separate from Admin-approved Alias Apply
- Verdict: **MISSING_FOOD_REVIEW_FOUNDATION_READY**

## Safety

- Design/report only.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- RPC was not called.
- No foods were created.
- No aliases were added.
- No writes were made to `foods` or `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## Problem Statement

Search Analytics/Admin Review can now reveal not-found and ambiguous food queries, and Admin-approved Alias Apply can safely apply a reviewed alias when a single exact canonical target already exists.

Current production data does not contain a safe first real alias candidate:

- `стейк` is a plausible real product intent, but no exact canonical food exists.
- `гов`, `говя`, and `говяд` are broad/prefix beef queries with several plausible canonical targets.
- typo/prefix/noise queries should not become aliases.

Therefore the next data-quality step should be Missing Food Review, not another alias apply step.

## Separation From Alias Apply

Alias Apply solves:

- query has one exact canonical target;
- query is a synonym, spelling variant, or short user phrase for an existing food;
- admin approves `query -> canonical_food_id`;
- explicit RPC inserts one `food_aliases` row.

Missing Food Review solves:

- query has real food intent;
- no exact canonical food exists;
- admin needs to decide whether to add a new canonical food, map to a future brand/barcode candidate, reject as noise, or defer.

These workflows must remain separate:

- missing food review must not insert into `food_aliases`;
- alias review must not create `foods`;
- approved alias rows must not imply missing-food approval;
- missing-food approval must not silently remap diary history.

## Classification Contract

Each reviewable query should have exactly one classification:

| Classification | Meaning | Allowed next action |
| --- | --- | --- |
| `alias_candidate` | One exact shared canonical food already exists | Admin-approved Alias Apply |
| `missing_canonical_food` | Real food intent, but no exact canonical exists | Missing Food Review |
| `ambiguous_broad_query` | Multiple plausible canonical targets or broad stem/prefix | Disambiguation/ranking review |
| `typo_or_prefix` | Incomplete, accidental, noisy, or non-food-like query | Reject/snooze/filter |

Current examples:

| Query | Classification | Reason |
| --- | --- | --- |
| `стейк` | `missing_canonical_food` | Plausible food intent; no exact shared canonical food |
| `гов` | `ambiguous_broad_query` | Broad beef prefix; many plausible beef foods |
| `говя` | `ambiguous_broad_query` | Broad beef prefix; many plausible beef foods |
| `говяд` | `ambiguous_broad_query` | Broad beef prefix; many plausible beef foods |
| `стей`, `сте`, `стейцк`, `стейц`, `стейй` | `typo_or_prefix` | Prefix/typo shape; no exact canonical |
| `ыва`, `ывап`, `ывапролд`, `ывапролдж` | `typo_or_prefix` | Test-like/noise strings |

## UI-Only First Or DB Draft

Recommendation: start with a UI-only classification layer, then draft DB persistence.

UI-only first is safe because:

- existing `food_search_events` already contains raw analytics;
- existing Admin Review can display frequent not-found/ambiguous queries;
- classification can be computed/displayed without creating foods or aliases;
- no schema change is needed to stop unsafe alias apply decisions;
- it reduces the chance of designing premature DB columns around too little data.

DB draft later is needed when:

- admins need durable classifications;
- missing-food decisions need status, reviewer, comments, and audit history;
- product wants a controlled canonical-food creation workflow;
- review volume is large enough that computed UI state is not enough.

## Proposed Missing Food Review Flow

Phase 0: classification-only UI

- Extend the existing Admin Panel/Search Review/Data Quality area.
- Show each query with a computed classification.
- Split actions by classification:
  - `alias_candidate`: allow normal queue approval/apply path;
  - `missing_canonical_food`: show "needs missing food review";
  - `ambiguous_broad_query`: show "needs disambiguation";
  - `typo_or_prefix`: show reject/snooze/noise guidance.
- Do not create foods.
- Do not add aliases.
- Do not call Alias Apply for missing/ambiguous/noise rows.

Phase 1: DB draft for missing-food queue

- Add a dedicated table, draft only first:
  - `food_missing_review_queue`
- Suggested fields:
  - `id`
  - `query`
  - `normalized_query`
  - `context`
  - `frequency`
  - `classification`
  - `status`
  - `source_event_ids`
  - `suggested_name`
  - `suggested_category`
  - `suggested_source`
  - `reviewer_id`
  - `reviewed_at`
  - `comment`
  - `metadata`
  - `created_at`
  - `updated_at`
- Allowed statuses:
  - `pending`
  - `needs_research`
  - `approved_for_food_draft`
  - `rejected`
  - `snoozed`
- Admin-only RLS should use production-correct `user_profiles.id_user = auth.uid()`.

Phase 2: missing-food draft preparation

- Approved missing-food rows create draft data only, not production foods.
- Draft should require:
  - canonical display name;
  - normalized name;
  - source classification;
  - category;
  - calories/macros/fiber with nullable fiber preserved;
  - provenance;
  - reviewer and timestamp.
- No diary/favorites/recipes recompute.

Phase 3: owner-approved food creation

- Create foods only through a separate owner-approved migration/RPC/package.
- Insert exactly reviewed foods.
- Validate duplicates, normalized-name conflicts, source, nutrition fields, and provenance.
- Post-apply counts must prove only intended `foods` rows changed.
- Do not add aliases in the same step unless separately reviewed.

Phase 4: optional alias follow-up

- After a missing canonical food exists, a separate Admin-approved Alias Apply can map the original query if it is still a valid alias.
- This should be a new review/action, not an automatic side effect of food creation.

## DB Draft Recommendation

No DB migration is required immediately for the foundation decision.

Prepare a DB draft next if the owner wants durable review state. The draft should create a dedicated missing-food queue rather than overloading `food_search_review_queue`, because the existing queue is already tied to `query -> suggested canonical -> alias apply`.

Do not extend `food_search_review_queue` into food creation state unless the product explicitly chooses a single unified queue model. A separate queue keeps the blast radius smaller and makes it harder to accidentally turn a missing food into an alias.

## Guardrails

- No automatic food creation from not-found queries.
- No automatic alias creation from missing-food rows.
- No alias for broad prefixes or typo fragments.
- No silent canonical selection for ambiguous queries.
- Keep `source='core'` clean and generic.
- Keep brand/barcode/OFF candidates in a separate layer until reviewed.
- Preserve diary snapshot immutability; do not recompute history after adding foods.
- Fiber nullability must stay intact: unknown is `null`, confirmed zero is `0`.
- Admin decisions must record reviewer, timestamp, source query, classification, and comment.

## Acceptance Criteria For A Future Missing Food MVP

- Admin can see frequent not-found queries grouped by normalized query/context.
- UI shows classification and reason.
- `missing_canonical_food` rows cannot call Alias Apply.
- `ambiguous_broad_query` rows cannot call Alias Apply without a future explicit override workflow.
- `typo_or_prefix` rows can be rejected/snoozed without creating data.
- No writes to `foods` or `food_aliases` occur in the classification phase.
- Any future DB draft is reviewed before apply.
- Any future food creation requires explicit owner approval and post-apply count validation.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Missing food treated as alias | High | Separate classification and hide Alias Apply for missing canonical rows |
| Broad prefix mapped silently | High | Classify broad prefixes as `ambiguous_broad_query` |
| Noise inflates review work | Medium | Add typo/noise classification and snooze/reject affordance |
| Food creation lacks nutrition provenance | High | Require separate missing-food draft with source/provenance |
| Core polluted by brands/OFF rows | High | Keep brand/barcode candidate layer separate |
| Historical diary changes after catalog update | High | Keep snapshot rule: no recompute/backfill |

## Recommended Next Step

Build a runtime-only Admin Review classification view first.

Suggested UI behavior:

- Add a classification badge to each Search Review item.
- Add a reason line based on exact alias/exact canonical/contains candidate checks.
- Show Alias Apply controls only for `alias_candidate` rows that are already approved.
- Show "Missing food review needed" for `missing_canonical_food`.
- Show "Disambiguation needed" for `ambiguous_broad_query`.
- Show "Noise / prefix" for `typo_or_prefix`.

After enough real data is collected, prepare a dedicated DB draft for persistent Missing Food Review.

## Final Status

Missing Food Review foundation is ready as a design direction. The immediate next step should be runtime-only classification in the existing Admin Panel/Data Quality area, with a separate DB draft later for durable missing-food review state. No foods or aliases should be created automatically.
