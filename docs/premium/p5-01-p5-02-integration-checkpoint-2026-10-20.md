# P5-01 / P5-02 integration checkpoint — 2026-10-20

Read-only review of live GitHub PR metadata, diffs and CI; based on master `0aa643850497f4398b8b44fb087b1c31fb92ac4c`. **No code branches, database, flags or deployments modified.**

## Recorded facts

| Check | P5-01 / #161 | P5-02 / #162 |
| --- | --- | --- |
| Current head | `cd90d5e61ba44c176f9f7eb23a5a3cef92196083` | `af65d4d1171f7b01f591d02ec346ac4f46f91d87` |
| GitHub status | OPEN DRAFT, mergeable (GitHub assertion) | OPEN DRAFT, mergeable (GitHub assertion) |
| Commits into master | None | None |
| Current-head workflow runs via GitHub API | **0** — no CI result proven for this head | **1 SUCCESS**, disposable acceptance run `38293448240` |
| Changed paths | 6 read-only entry/UI/service/test paths | 12 runtime/error-handling/SQL-draft/test/workflow paths |
| Overlap of changed paths between these two PRs | **0** | **0** |

No changed-path overlap does **not** prove compatibility: both packages read shared Adaptive Nutrition wire contracts, errors and state transitions. Their GitHub mergeable indicators only confirm current repository merge feasibility at inspection time. Both packages require **new current-master integration CI**, not old base-only assertions.

## P5-01 specific audit

Implements truthful `pending_generation` state for one account/selection/goal/current-week binding. Explicitly clears prior graph/slots; does not poll or dispatch generation, and rejects foreign week/timezone/invalid dates. The pending UI is a waiting message, **not** a button for actual generation. Its reported 23 targeted assertions exclude browser smoke, and no PR-head workflow run was returned by the GitHub API.

Next: prepare an isolated review/test branch from **current master** containing only this selected change, verify TypeScript/targeted tests/CI and browser/mobile smoke when test harness is available, independently check account switch and DST/week rollover; do not turn on READ flags without tested server authority.

## P5-02 specific audit

Strengthens classification of business conflicts vs native engine failures, exact accepted receipts, request digest binding, UNKNOWN quarantine and late asynchronous recovery/account switching. A disposable PostgreSQL/PostgREST CI run succeeded on the historical PR head. It includes a **SQL repair draft** but the PR explicitly disclaims application to staging or production. It **does not** implement generation.

Next: integrate independently on a current-master review branch, run new TypeScript and targeted regression suites. Confirm from current server effective signatures whether `PT409` / `PT500` are actually deployed before activating corresponding UI/writer paths. Ensure transport errors after uncertain dispatch retain original request and durable recovery; never reinterpret native engine `40001` as business conflict, replay with a new key, or consider a lookup conflict a confirmed receipt. Disposable acceptance must remain scoped; production writes separately authorized.

## Decision / sequencing

- **P5-01 can be reviewed first**, because it is read-only and does not require an active generator. No merge before review + current-head CI + owner approval.
- **P5-02 follows** with stronger server-transport requirements; keep SQL repair inactive pending explicit DB review.
- Neither PR turns on `adaptive-nutrition-generate-v2`. P5-04 hands-on test continues to require approved pilot recipe, trusted issuer, generation worker/validator and protected staging deployment.

This checkpoint is **not** a blanket approval for merge or rollout.
