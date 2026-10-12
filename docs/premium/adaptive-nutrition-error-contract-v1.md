# Adaptive Nutrition persistence error contract v1

Status: design plus disposable repair only. Nothing in this package is an applied
migration, a Staging change, or a runtime activation.

## Effective-source inventory

The SELECT-only Staging inspection on 2026-10-12 found a split effective source:

- `public.adaptive_nutrition_mutate_v1(text)` is closest to
  `drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql` and has six
  explicit application `40001` raises.
- `potok_nutrition.commit_prevalidated_plan_transition_v1(...)` is closest to
  `drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql`
  and has five explicit application `40001` raises.

The 2026-09-21 persistence draft also contains an older definition of the
internal transition function. It is not the effective Staging source. The
repair therefore reads and checks each effective definition independently with
`pg_get_functiondef`; it does not replay either historical file as a migration.

## Classification of the 11 sites

`BC` means deterministic business conflict. `SI` means stored/server integrity
failure. Every raise aborts the statement and transaction, so writes from that
attempt roll back. None of these error paths creates a new receipt; an existing
receipt with the same account/key remains unchanged.

| Effective source | Line | Condition | Reachability | Current | Proposed | Rollback and receipt |
| --- | ---: | --- | --- | --- | --- | --- |
| `20260921_adaptive_nutrition_runtime_activation_v1.sql` | 320 | Same idempotency key is bound to different selection/action/canonical payload/digest | Reachable by key reuse, tampering, or a racing caller | `40001` | `PT409` / `BC: IDEMPOTENCY_PAYLOAD_MISMATCH` | Full rollback; preserve existing receipt, create none |
| same | 345 | Expected graph revision is absent for the owned selection | Reachable after stale/retired plan input | `40001` | `PT409` / `BC: STALE_PLAN_REVISION` | Full rollback; no receipt |
| same | 380 | Dated slot/snapshot is absent from the expected graph | Reachable with stale or contradictory slot binding | `40001` | `PT409` / `BC: STALE_SLOT_SNAPSHOT` | Full rollback; no receipt |
| same | 396 | Slot already has a live annotation | Reachable duplicate semantic action or race | `40001` | `PT409` / `BC: LIVE_ANNOTATION_EXISTS` | Full rollback; no receipt |
| same | 420 | Requested annotation target is missing, foreign, or already superseded | Reachable stale undo/race | `40001` | `PT409` / `BC: LIVE_ANNOTATION_REQUIRED` | Full rollback; no receipt |
| same | 447 | Replacement offer is absent, expired, stale, foreign, or already unusable | Reachable stale replacement/race | `40001` | `PT409` / `BC: LIVE_REPLACEMENT_OFFER_REQUIRED` | Full rollback; no receipt |
| `20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql` | 583 | Internal duplicate key has a different canonical binding | Reachable through replay/race at the trusted boundary | `40001` | `PT409` / `BC: IDEMPOTENCY_PAYLOAD_MISMATCH` | Full rollback; preserve existing receipt, create none |
| same | 586 | Persisted operation outcome is `in_progress` | Not produced by the normal atomic transition; reachable only through damaged/unsupported stored state | `40001` | `PT500` / `SI: OPERATION_RESULT_UNRESOLVED` | Full rollback; retain unresolved stored row for investigation, create none |
| same | 608 | Selection revision vector differs from the expected vector | Reachable concurrent plan/goal/history/diary advance | `40001` | `PT409` / `BC: STALE_PLAN_REVISION` | Full rollback; no receipt |
| same | 628 | Retraction does not supersede its live owned annotation | Reachable race or disagreement between prevalidation and locked commit | `40001` | `PT409` / `BC: LIVE_ANNOTATION_REQUIRED` | Full rollback; no receipt |
| same | 642 | Expected goal revision is no longer the selected authoritative goal | Reachable concurrent goal change | `40001` | `PT409` / `BC: STALE_GOAL_REVISION` | Full rollback; no receipt |

The classification is intentionally limited to these 11 effective sites. Other
Adaptive Nutrition and Food Evidence `40001` occurrences are separate packages.

## Wire error contract

- Business conflict: SQLSTATE `PT409`, HTTP 409, `details` exactly
  `POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1`. The message remains diagnostic; the
  client branches only on code plus details.
- Server integrity failure: SQLSTATE `PT500`, HTTP 500, `details` exactly
  `POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1`.
- Native engine serialization failure: SQLSTATE `40001`. It remains an engine
  error and is classified as `technical-failure`, never as a business conflict.
- Other structured PostgreSQL/PostgREST errors after dispatch are
  `technical-failure`, except the existing `42501` denial.
- Network exception, timeout/response loss without a structured server code,
  malformed success response, or mismatched receipt after dispatch is
  `unknown`. UNKNOWN retains the exact original raw request and idempotency key
  and uses lookup plus receipt-bound exact read. The server-generated
  `operation_id` is recovered from that receipt when it exists. It does not
  create a new key or infer rollback.

The repository lock currently installs `@supabase/supabase-js` 2.88.0. The
P5-02 client calls the mutation RPC once and contains no automatic retry loop.

The frontend runtime and write flags stay disabled. Graph v1, account/session
guards, exact-operation reads, receipt digests, and `PLAN != FACT` remain
unchanged.

## Disposable acceptance target

The transport harness is intended for PostgreSQL 17.11 and PostgREST 13.0.7.
It must prove HTTP/code/details, one execution for `PT409`, native `40001`
behavior, transaction rollback, and receipt absence/preservation. A mocked
Supabase client is only a client-classifier regression and cannot satisfy this
transport acceptance. The runner at
`scripts/acceptance/run-adaptive-nutrition-error-contract-v1.sh` creates only
throwaway local containers and never connects to Supabase or Staging.
